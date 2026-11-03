// mascot.js —— 狗的视线：5 列 × 3 行的双轴图集，头朝光标方向【逐步转过去】。
//
// 为什么不是"光标在哪一帧就跳哪一帧"：那样鼠标快速划过时狗头会瞬移，
// 看着像贴图切换而不是"它在看你"。这里每步最多挪一格（列、行各自独立），
// 中间角度都会被经过 —— 参照站那张 16×9 的图集之所以显得自然，一半在帧数，
// 另一半就在这个"扫过去"的节奏上。
//
// 纯计算（归一化、目标帧、逐步逼近、背景定位串）全部 export，
// test/mascot.test.js 在没有 DOM 的 Node 里逐条断言。

export const COLS = 5;
export const ROWS = 3;
export const REACH_X = 420;   // 光标横向偏离多少像素就转到极限朝向
export const REACH_Y = 260;   // 纵向同理（狗只有 89px 高，视线范围不必太大）
export const STEP_MS = 110;   // 每 110ms 最多挪一格
export const DEADZONE = 0.12; // 归一化偏移在这个范围内一律回正脸，避免小幅抖动来回转头

// 待机朝向 = 图集正中间那格（列 2 / 行 1，正脸平视）。
// 必须是【正中间】而不是"抬头"：CSS 静止态与开屏下坠的克隆体都取 background-position: 50% 50%，
// 待机若落在别的格子上，鼠标第一次移动时狗头会瞬间跳一格 —— 落下的狗和跟手的狗不是同一只。
export const IDLE = { col: 2, row: 1 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 光标相对狗头的偏移 → 归一化 [-1,1]（右为正、下为正）。
export function normalize(dx, dy) {
  return { nx: clamp(dx / REACH_X, -1, 1), ny: clamp(dy / REACH_Y, -1, 1) };
}

// 归一化偏移 → 目标帧。列 0 = 左侧脸、4 = 右侧脸；行 0 = 抬头、2 = 低头。
export function frameFor(nx, ny) {
  const c = Math.abs(nx) < DEADZONE ? IDLE.col : Math.round((nx + 1) / 2 * (COLS - 1));
  const r = Math.abs(ny) < DEADZONE ? IDLE.row : Math.round((ny + 1) / 2 * (ROWS - 1));
  return { col: clamp(c, 0, COLS - 1), row: clamp(r, 0, ROWS - 1) };
}

// 朝目标各挪最多一格；列与行独立，所以斜向移动会走"先转角再转俯仰"的连续路径。
export function stepToward(cur, target) {
  const d = (a, b) => Math.sign(b - a);
  return {
    col: cur.col === target.col ? cur.col : cur.col + d(cur.col, target.col),
    row: cur.row === target.row ? cur.row : cur.row + d(cur.row, target.row),
  };
}

export const atTarget = (cur, target) => cur.col === target.col && cur.row === target.row;

// 帧索引 → background-position 百分比。均匀格子是这条数学成立的前提，
// 由 .superpowers/build_dog_atlas.py 保证（每格宽取最大值、脚对齐底边）。
export function positionFor({ col, row }) {
  return `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;
}

export function initMascot() {
  const dog = document.querySelector('[data-mascot-dog]');
  if (!dog) return () => {};
  // 触屏没有"悬停的光标"，绑监听等于白跑一条循环。
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  let cur = { ...IDLE };
  let target = { ...IDLE };
  let raf = 0;
  let lastStep = 0;
  let head = { x: 0, y: 0 };

  const paint = () => { dog.style.backgroundPosition = positionFor(cur); };

  function tick(now) {
    raf = 0;
    if (now - lastStep >= STEP_MS) {
      const next = stepToward(cur, target);
      if (next.col !== cur.col || next.row !== cur.row) {
        cur = next;
        lastStep = now;
        paint();
      }
    }
    // 没到位就继续排帧；到位了这条循环自己停 —— 装饰不许永久空转。
    if (!atTarget(cur, target)) start();
  }

  function start() {
    if (raf || document.hidden) return;
    raf = requestAnimationFrame(tick);
  }

  // 狗头的位置每次现量：布局会变（切 tab、换行、窗口缩放），缓存下来的坐标会过期。
  function aim(x, y) {
    const r = dog.getBoundingClientRect();
    if (r.width === 0) return;                 // 面板被折叠或还没布局：不追
    head = { x: r.left + r.width * 0.5, y: r.top + r.height * 0.3 };  // 0.3 ≈ 眼睛在格子里的高度
    const n = normalize(x - head.x, y - head.y);
    target = frameFor(n.nx, n.ny);
    start();
  }

  const onMove = (e) => { if (e.pointerType !== 'touch') aim(e.clientX, e.clientY); };
  const onLeave = () => { target = { ...IDLE }; start(); };
  const onVisibility = () => { if (!document.hidden) start(); };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return function destroy() {
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    dog.style.backgroundPosition = '';
  };
}
