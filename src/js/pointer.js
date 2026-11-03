// pointer.js —— 指针场：跟随光标的点阵涟漪（canvas 层）+ 自定义光标（DOM 层）。
// 两者共用同一个 rAF 循环与同一份平滑指针（spec 6.3 与本轮"共用一个 rAF"的裁定）：
// 各自一条循环会互相抢帧，还会把 matchMedia / pointermove 绑两遍。
//
// 纯计算（点阵、衰减、波形、生成规则、颜色解析）全部 export，test/pointer.test.js
// 在无 DOM 的 Node 里直接断言 —— 与 mascot.js 的 frameFor 同一个理由。
//
// 纪律：本文件不出现任何字面色值。配色从 tokens.css 的 --field-* 读，
// 明暗切换与 data-mode 变化由 MutationObserver 重新取一遍（否则暗色下点阵还是深墨，
// 在近黑底上完全不可见 —— 那是"装饰在暗色下消失"而不是"装饰跟着主题走"）。

export const GRID = 22;            // 点阵间距 px
export const RADIUS = 180;         // 指针影响半径 px
export const SPEED = 0.42;         // 涟漪环速 px/ms（= 420 px/s）
export const WAVE_LEN = GRID * 2.5; // 波包在径向上的长度
export const MAX_RIPPLES = 10;     // 同时存活的涟漪上限，超了丢最旧的
export const MOVE_DIST = 72;       // 指针移动这么多才发一条涟漪
export const MOVE_MS = 120;        // 且距上一条这么久 —— 两条判据缺一不可，
                                   // 否则快速划动会一次生成上百条，帧时直接爆
export const MOVE_AMP = 3.2;
export const MOVE_LIFE = 1100;
export const DOWN_AMP = 9;
export const DOWN_LIFE = 1700;
export const POINTER_LERP = 0.18;  // 指针平滑：光晕是"跟上来"而不是"贴上去"
export const ALPHA_LERP = 0.08;    // 离开时整场的余晖按这一档缓灭
export const IDLE_EPS = 0.3;       // 小于这个差就不再重绘（静止即停循环，不空转）

export const smoothstep = (v) => v * v * (3 - 2 * v);

// 指针衰减：半径内 smoothstep，半径外 0。
export function pointerGain(dist) {
  return dist >= RADIUS ? 0 : smoothstep(1 - dist / RADIUS);
}

// 单条涟漪在 (age, dist) 处的位移。三段相乘：
// sin 给"波"的形状，(1−d/WAVE_LEN)² 是径向包络，(1−age/life)^1.5 是时间衰减。
export function rippleWave(ripple, dist, now) {
  const age = now - ripple.t0;
  if (age <= 0 || age >= ripple.life) return 0;
  const d = age * SPEED - dist;
  if (d < 0 || d > WAVE_LEN) return 0;
  const envelope = (1 - d / WAVE_LEN) ** 2 * (1 - age / ripple.life) ** 1.5;
  return Math.sin((d / GRID) * Math.PI * 2) * envelope * ripple.amp;
}

// 移动涟漪的生成判据（纯函数，便于断言"慢慢挪不刷屏、快速划也只每 72px 一条"）。
export function shouldSpawnMove(last, x, y, now) {
  if (!last) return true;
  return Math.hypot(x - last.x, y - last.y) >= MOVE_DIST && now - last.t >= MOVE_MS;
}

// 亮度 → 点的画法：低于阈值仍是 2×2 方点（静止态就是那张 22px 网格纸），
// 越过阈值才膨胀成圆并染色。返回 'dot' | 'tint' | 'hot'。
export function dotLevel(y) {
  if (y < 0.03) return 'dot';
  return y > 0.62 ? 'hot' : 'tint';
}

// 把 CSS 颜色串解析成 [r,g,b,a]，供 canvas 用不同 alpha 重绘同一个色。
// 支持 #rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba()；解析不出来就原样返回。
// 8 位 hex 不是可选项：lightningcss 会把 `rgba(26,26,26,.13)` 压成 `#1a1a1a21`，
// 而这里读的是【产物】里的自定义属性值 —— 只认 6 位的话整场静默不启动（实测踩过）。
export function parseColor(input) {
  const s = String(input).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let d = hex[1];
    if (d.length === 3 || d.length === 4) d = d.replace(/./g, (c) => c + c);
    const n = parseInt(d.slice(0, 6), 16);
    const a = d.length === 8 ? parseInt(d.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(a * 1000) / 1000];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(s);
  if (fn) {
    const p = fn[1].split(/[,/\s]+/).filter(Boolean).map((v) => parseFloat(v));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  }
  return s;
}

export const withAlpha = (rgb, a) =>
  Array.isArray(rgb) ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : rgb;

// 点阵的原点：偏移取"视口余数的一半"，让整张网格在视口里居中，边缘不出现半格。
export function lattice(w, h) {
  const cols = Math.ceil(w / GRID) + 1;
  const rows = Math.ceil(h / GRID) + 1;
  return { cols, rows, ox: (w % GRID) / 2, oy: (h % GRID) / 2 };
}

/* ===== 下面是 DOM / canvas 侧 ===== */

const HOVERABLE = 'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])';

export function initPointer() {
  // 触屏不启用：没有指针可跟，绑上去只会白跑一条 rAF。
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  // 减弱动效：整场不存在，而不是"停在原地不动"。
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  if (!document.body) return () => {};

  const root = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.pointerField = '';
  document.body.prepend(canvas);
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return () => { canvas.remove(); };

  // 光标：一个点 + 一个环，环只在悬停可交互元素时撑开。
  // 用 createElement 而不是 innerHTML：本站没有不可信字符串进 DOM 这条路，
  // 但保持"JS 不写 HTML 串"这一条纪律比省两行重要（build.js 那侧全部走 esc()）。
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('i');
  dot.className = 'cursor-dot';
  const ringEl = document.createElement('i');
  ringEl.className = 'cursor-ring';
  cursor.append(dot, ringEl);
  document.body.append(cursor);

  let w = 0, h = 0, cells = null;
  let pal = null;
  let raf = 0;
  const raw = { x: -9999, y: -9999, on: false };
  const smooth = { x: -9999, y: -9999, a: 0 };
  const ripples = [];
  let lastSpawn = null;

  // 调色板只从 tokens.css 读，JS 一侧不写任何色值兜底：
  // 兜底值就是第二份真源，它会和 token 悄悄漂移（--field-dot 改了、兜底没改，
  // 明暗其中一档会隐形）。取不到合法颜色时整场【不启动】——
  // 装饰层不许 throw，也不许画出一屏错色，安静降级成"没有装饰"。
  function readPalette() {
    const cs = getComputedStyle(root);
    const pick = (name) => {
      const v = parseColor(cs.getPropertyValue(name));
      return Array.isArray(v) ? v : null;
    };
    const dot = pick('--field-dot'), ink = pick('--ink'), hot = pick('--field-hot');
    if (!dot || !ink || !hot) return false;
    pal = { dot, ink, hot };
    return true;
  }
  if (!readPalette()) {
    canvas.remove();
    cursor.remove();
    return () => {};
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 上限 2：3 倍屏上多花的像素肉眼看不出，代价是 2.25 倍填充量
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    cells = lattice(w, h);
  }

  function spawn(x, y, amp, life) {
    ripples.push({ x, y, t0: performance.now(), amp, life });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
    start();
  }

  function draw(now) {
    // 指针惯性：位置一阶低通，"在场强度"更慢地淡入淡出。
    smooth.x = smooth.x < -9e3 ? raw.x : smooth.x + (raw.x - smooth.x) * POINTER_LERP;
    smooth.y = smooth.y < -9e3 ? raw.y : smooth.y + (raw.y - smooth.y) * POINTER_LERP;
    smooth.a += ((raw.on ? 1 : 0) - smooth.a) * ALPHA_LERP;
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (now - ripples[i].t0 > ripples[i].life) ripples.splice(i, 1);
    }

    ctx2d.clearRect(0, 0, w, h);
    const { cols, rows, ox, oy } = cells;
    const near = smooth.a > 0.01;
    for (let r = 0; r < rows; r++) {
      const gy = oy + r * GRID;
      for (let c = 0; c < cols; c++) {
        const gx = ox + c * GRID;
        let px = gx, py = gy, energy = 0;

        if (near) {
          const dx = smooth.x - gx, dy = smooth.y - gy;
          const dist = Math.hypot(dx, dy);
          const gain = pointerGain(dist);
          if (gain > 0) {
            const l = gain * smooth.a;
            px += (dx / dist) * 7 * l;
            py += (dy / dist) * 7 * l;
            energy = l * 0.85;
          }
        }

        for (const rip of ripples) {
          const dx = gx - rip.x, dy = gy - rip.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.001) continue;
          const off = rippleWave(rip, dist, now);
          if (off === 0) continue;
          px += (dx / dist) * off;
          py += (dy / dist) * off;
          energy = Math.max(energy, Math.min(1, Math.abs(off) / rip.amp));
        }

        const level = dotLevel(energy);
        if (level === 'dot') {
          ctx2d.fillStyle = withAlpha(pal.dot, Array.isArray(pal.dot) ? pal.dot[3] : 1);
          ctx2d.fillRect(px - 1, py - 1, 2, 2);
        } else {
          const size = 2 + energy * 2.6;
          ctx2d.fillStyle = level === 'hot'
            ? withAlpha(pal.hot, 0.55 + energy * 0.45)
            : withAlpha(pal.ink, 0.2 + energy * 0.6);
          ctx2d.beginPath();
          ctx2d.arc(px, py, size / 2, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }
    }

    // 光标跟着同一份平滑位置走，两条循环合一。
    cursor.style.transform = `translate3d(${smooth.x}px, ${smooth.y}px, 0)`;
  }

  function frame(now) {
    raf = 0;
    draw(now);
    // 静止即停：没有涟漪、指针也安定下来时不再重绘，页面挂着一条空转的 rAF 是不可接受的。
    if (ripples.length > 0
      || Math.abs(raw.x - smooth.x) > IDLE_EPS
      || Math.abs(raw.y - smooth.y) > IDLE_EPS
      || Math.abs((raw.on ? 1 : 0) - smooth.a) > 0.01) start();
  }

  function start() {
    if (raf || document.hidden) return;
    raf = requestAnimationFrame(frame);
  }

  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    raw.x = e.clientX;
    raw.y = e.clientY;
    raw.on = true;
    const now = performance.now();
    if (shouldSpawnMove(lastSpawn, raw.x, raw.y, now)) {
      lastSpawn = { x: raw.x, y: raw.y, t: now };
      spawn(raw.x, raw.y, MOVE_AMP, MOVE_LIFE);
    } else start();
  };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    spawn(e.clientX, e.clientY, DOWN_AMP, DOWN_LIFE);
  };
  const onLeave = () => { raw.on = false; start(); };
  const onOver = (e) => { cursor.classList.toggle('is-hover', !!(e.target.closest && e.target.closest(HOVERABLE))); start(); };
  const onVisibility = () => { if (!document.hidden) start(); };
  const onTheme = () => { readPalette(); start(); };

  const observer = new MutationObserver(onTheme);
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
  const dark = matchMedia('(prefers-color-scheme: dark)');
  dark.addEventListener('change', onTheme);

  resize();
  readPalette();
  root.classList.add('has-pointer');
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  root.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  start();

  return function destroy() {
    cancelAnimationFrame(raf);
    raf = 0;
    observer.disconnect();
    dark.removeEventListener('change', onTheme);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    root.classList.remove('has-pointer');
    canvas.remove();
    cursor.remove();
  };
}
