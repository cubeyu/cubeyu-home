// hero 吉祥物的产物契约。
// 为什么单独一份：这次接线暴露的失效类是「资产在 src/ 里、构建不拷、页面 404」，
// 而当时 102 项测试与 11 项 check 全绿 —— 没有任何东西看得到 src/images/ 是否存在于产物。
// 这里钉住四件承重的事：图进了 dist、装饰对辅助技术隐藏、图集两根轴在 CSS/JS/图片像素三处
// 对得上、以及静止帧与 JS 待机帧是同一格。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIST = 'dist/index.html';
const CSS = 'dist/assets/app.css';

// 图集按内容哈希改名（build.js，为了 vercel.json 能对 /assets/images/* 开 immutable）。
// 所以这里不再断言固定文件名，而是断言更强的一条：CSS 里每个图片 url 都必须在磁盘上真存在。
// 旧写法只查"四个文件在不在"，改名/漏重写那一半它看不见；现在只要有一处没同步就红。
test('mascot images are shipped into dist and every CSS url() resolves to a real file', () => {
  const files = readdirSync('dist/assets/images');
  assert.ok(files.length >= 4, `dist/assets/images 只有 ${files.length} 个文件`);
  for (const base of ['hero-person', 'hero-person-dark', 'hero-dog', 'hero-dog-dark']) {
    assert.ok(files.some((f) => f.startsWith(`${base}.`) && f.endsWith('.webp')),
      `${base}.<hash>.webp 没进产物 —— 构建的图片拷贝被去掉了？`);
  }
  const css = readFileSync(CSS, 'utf8');
  const refs = [...css.matchAll(/url\((?:"|')?(\/assets\/images\/[^"')]+)(?:"|')?\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, `CSS 里的图集引用只有 ${refs.length} 处，少于明暗四张`);
  for (const href of new Set(refs)) {
    assert.ok(files.includes(href.split('/').pop()),
      `CSS 引用 ${href} 但磁盘上没有 —— 哈希改名后有一处没同步，线上会 404`);
  }
});

test('hero illustration is present and hidden from assistive tech', () => {
  const html = readFileSync(DIST, 'utf8');
  assert.match(html, /class="hero-illo" aria-hidden="true"/, '吉祥物必须 aria-hidden：它是纯装饰，且人物狗都是 background-image，没有可命名的内容');
  assert.match(html, /data-mascot-dog/, '狗缺少 data-mascot-dog —— mascot.js 找不到挂载点，跟随会静默失效');
});

// 图集的两根轴在四个地方必须一致：CSS 的 background-size、JS 的 COLS/ROWS、
// 图片的真实像素尺寸、以及 CSS 静止态那一格与 JS 的 IDLE。
// 任何一处漂了，狗都会显示成半只、错位一格，或鼠标一动就"啪"地跳帧 ——
// 而页面看起来仍然完全正常，所以只能靠断言钉住。
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.subarray(0, 4).toString('ascii'), 'RIFF', '不是 WebP');
  assert.equal(b.subarray(8, 12).toString('ascii'), 'WEBP', '不是 WebP');
  // 块按 2 字节对齐，所以步长要把奇数长度补成偶数
  for (let o = 12; o + 8 <= b.length; o += 8 + ((b.readUInt32LE(o + 4) + 1) & ~1)) {
    const fourcc = b.subarray(o, o + 4).toString('ascii');
    const d = o + 8;
    if (fourcc === 'VP8X') return { w: 1 + b.readUIntLE(d + 4, 3), h: 1 + b.readUIntLE(d + 7, 3) };
    if (fourcc === 'VP8 ') return { w: b.readUInt16LE(d + 6) & 0x3fff, h: b.readUInt16LE(d + 8) & 0x3fff };
    if (fourcc === 'VP8L') {
      const t = b.readUInt32LE(d + 1);
      return { w: 1 + (t & 0x3fff), h: 1 + ((t >> 14) & 0x3fff) };
    }
  }
  throw new Error('WebP 里没有 VP8/VP8L/VP8X 块');
}

test('dog atlas agrees across CSS background-size, JS COLS/ROWS, and the image pixels', () => {
  const css = readFileSync(CSS, 'utf8');
  const size = /background-size:\s*([\d.]+)%\s+([\d.]+)%/.exec(
    /\.hero-dog\{([^}]*)\}/s.exec(css)?.[0] ?? '');
  assert.ok(size, '.hero-dog 的 background-size 必须是 <cols*100>% <rows*100>%（双轴）');
  const cols = Math.round(Number(size[1]) / 100);
  const rows = Math.round(Number(size[2]) / 100);

  const js = readFileSync('src/js/mascot.js', 'utf8');
  assert.equal(cols, Number(/export const COLS = (\d+)/.exec(js)?.[1]), 'CSS 列数与 JS COLS 不一致');
  assert.equal(rows, Number(/export const ROWS = (\d+)/.exec(js)?.[1]), 'CSS 行数与 JS ROWS 不一致');

  // background-position 的百分数不是像素，是「(可移动距离) 的比例」：
  // 第 i 列只能取 i/(cols-1)，取 i/cols 会整体偏左一格、且永远碰不到最右帧。
  assert.match(js, /col \/ \(COLS - 1\)/, '列定位必须除以 COLS-1');
  assert.match(js, /row \/ \(ROWS - 1\)/, '行定位必须除以 ROWS-1');

  // 图片必须正好切成 cols×rows 个【等宽等高】的格子，否则上面那条百分比数学全错。
  const { w, h } = webpSize('src/images/hero-dog.webp');
  assert.equal(w % cols, 0, `图集宽 ${w} 不能被列数 ${cols} 整除 —— 格子不等宽`);
  assert.equal(h % rows, 0, `图集高 ${h} 不能被行数 ${rows} 整除 —— 格子不等高`);

  // CSS 给盒子定的宽高比必须与实际格子一致，不然图会被拉扁（background-size: 500% 300% 是铺满盒子的）。
  const ar = /aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/.exec(/\.hero-dog\{([^}]*)\}/s.exec(css)?.[0] ?? '');
  assert.ok(ar, '.hero-dog 必须有 aspect-ratio，它决定格子会不会被拉伸');
  assert.equal(Number(ar[1]) / Number(ar[2]), w / cols / (h / rows),
    `aspect-ratio ${ar[1]}/${ar[2]} 与实际格子 ${w / cols}×${h / rows} 不符，狗会被拉扁`);
});

// 静止态与待机帧必须是同一格，否则第一次 pointermove 会让狗头跳一格。
// 开屏下坠的克隆体走 loader.css 里那条共用声明，所以它也在 50% 50%。
test('the CSS rest frame is the same cell the JS idles on', () => {
  const css = readFileSync(CSS, 'utf8');
  // lightningcss 把 `50% 50%` 收成 `50%`：单值时第二轴按 CSS 规则取 center，也就是 50%。
  // 所以缺省只能补成 50，补成第一个值会把纵向静止态判错。
  const pos = /background-position:\s*([\d.]+)%(?:\s+([\d.]+)%)?/.exec(
    /\.hero-dog\{([^}]*)\}/s.exec(css)?.[0] ?? '');
  assert.ok(pos, '.hero-dog 必须显式声明静止态 background-position');
  const [xPct, yPct] = [Number(pos[1]), pos[2] === undefined ? 50 : Number(pos[2])];
  const js = readFileSync('src/js/mascot.js', 'utf8');
  const cols = Number(/export const COLS = (\d+)/.exec(js)?.[1]);
  const rows = Number(/export const ROWS = (\d+)/.exec(js)?.[1]);
  const idleCol = Number(/IDLE = \{ col: (\d+), row: (\d+) \}/.exec(js)?.[1]);
  const idleRow = Number(/IDLE = \{ col: (\d+), row: (\d+) \}/.exec(js)?.[2]);
  assert.equal(xPct, idleCol / (cols - 1) * 100, 'CSS 静止列与 JS IDLE.col 不是同一格');
  assert.equal(yPct, idleRow / (rows - 1) * 100, 'CSS 静止行与 JS IDLE.row 不是同一格');
});

test('the gaze sweeps one cell per step instead of teleporting', async () => {
  const m = await import('../src/js/mascot.js');
  // 归一化要夹紧：光标跑到页面角落时 nx 会是十几，不夹就索引到图集外面。
  assert.deepEqual(m.normalize(9999, 0), { nx: 1, ny: 0 });
  assert.deepEqual(m.normalize(-9999, -9999), { nx: -1, ny: -1 });

  // 死区：小幅抖动不该转头，否则狗在正脸和 45° 之间来回抽搐。
  assert.deepEqual(m.frameFor(0, 0), m.IDLE, '光标在狗头上时必须回正脸');
  assert.deepEqual(m.frameFor(m.DEADZONE * 0.99, -m.DEADZONE * 0.99), m.IDLE);
  assert.deepEqual(m.frameFor(1, 1), { col: m.COLS - 1, row: m.ROWS - 1 }, '右下极限要是右下角那一格');
  assert.deepEqual(m.frameFor(-1, -1), { col: 0, row: 0 }, '左上极限要是左上角那一格');

  // 每步最多挪一格（列、行各自独立）—— 这是"它在转头"和"贴图切换"的区别。
  let cur = { ...m.IDLE };
  const far = m.frameFor(-1, 1);
  const path = [];
  while (!m.atTarget(cur, far)) {
    const next = m.stepToward(cur, far);
    assert.ok(Math.abs(next.col - cur.col) <= 1 && Math.abs(next.row - cur.row) <= 1,
      `一步跳了 ${next.col - cur.col}/${next.row - cur.row} 格`);
    cur = next;
    path.push(cur);
    assert.ok(path.length < 100, '逼近不收敛');
  }
  assert.equal(path.length, Math.max(m.IDLE.col - far.col, far.row - m.IDLE.row),
    '斜向应当走对角路径（列与行同时挪），不该多绕');

  // 帧 → 背景定位串
  assert.equal(m.positionFor({ col: 0, row: 0 }), '0% 0%');
  assert.equal(m.positionFor({ col: m.COLS - 1, row: m.ROWS - 1 }), '100% 100%');
});

test('mascot does not animate for reduced motion or touch', () => {
  const js = readFileSync('src/js/mascot.js', 'utf8');
  // 两个守卫都必须【提前 return】，而不是绑了监听再判断 —— 后者在触屏上仍会常驻监听器
  assert.match(js, /hover: hover[\s\S]{0,80}pointer: fine[\s\S]{0,120}return/, '触屏必须完全不绑指针监听');
  assert.match(js, /prefers-reduced-motion[\s\S]{0,120}return/, 'reduced-motion 必须不追踪，狗停在静止帧');
});

// 追踪循环必须是【按需排帧】：一个装饰元素不该在用户不动鼠标时空转 rAF ——
// 那会把 pointer 光斑场的空闲检测一起拖成常驻，整页永远进不了 idle。
test('the gaze loop paces itself and stops when it arrives', () => {
  const js = readFileSync('src/js/mascot.js', 'utf8');
  assert.match(js, /now - lastStep >= STEP_MS/, '每帧都要过 STEP_MS 闸门，否则转头速度跟帧率跑');
  assert.match(js, /if \(!atTarget\(cur, target\)\) start\(\)/, '到位后不得再排帧');
  assert.match(js, /if \(raf \|\| document\.hidden\) return/, '已在排帧或页面不可见时不重复排队');
  assert.match(js, /return function destroy\(\)[\s\S]*cancelAnimationFrame/, 'destroy 必须真的取消排帧并摘监听');
  const step = Number(/export const STEP_MS = (\d+)/.exec(js)?.[1]);
  assert.ok(step >= 60 && step <= 200, `STEP_MS=${step}：太短像瞬移，太长跟不上手`);
});

// 锚点契约。上一版写的是 `right: 0; height: clamp(320px, 60vh, 560px)`，人形浮在 820px
// 栏的右边缘、离最近的字 316px（实测），读起来是「一张图放在标题旁边」而不是
// 「一个人扶着字」—— 而 112 项测试与 11 项 check 全绿，没有任何东西会因此变红。
// 参照站的写法把这件事钉在 CSS 里：left/bottom/height 全是 em，em 就是 h1 的字高，
// 所以字放大时手仍然落在字尾，缩小时也不会脱开。锚点生效的前提是包含盒是 h1。
test('hero illustration is anchored to the headline in em, not to the column edge', () => {
  const css = readFileSync('src/styles/hero.css', 'utf8');
  const illo = /\.hero-illo\s*\{([^}]*)\}/s.exec(css)?.[1] ?? '';
  assert.match(illo, /left:\s*[\d.]+em/, '吉祥物必须按 em 锚在标题的字宽上，换字号才不脱开');
  assert.match(illo, /height:\s*[\d.]+em/, '高度也要按 em，人才跟着标题一起缩放');
  assert.match(illo, /bottom:\s*-[\d.]+em/, '脚的位置也要按 em，才始终垂在标题块底边以下同样多');
  assert.doesNotMatch(illo, /right:\s*\.?\d/, '不得改用 right 定位：那锚的是栏的右边缘，与标题长度无关');
  assert.match(css, /\.hero h1\s*\{[^}]*position:\s*relative/,
    'h1 必须是定位参照物 —— 挂在 .hero 上时包含盒把副行与下滑提示一起算进去，脚会落到副行以下');
  // 关掉动画后起点位移必须显式收回，否则盒子永久停在 translateY(12%)：
  // 2.3em 的人往下 39px，手掌从 x 高度顶掉进字母中间，「扶着字」变成「盖住字」。
  const reduce = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}/.exec(css)?.[1] ?? '';
  assert.match(/\.hero-illo\s*\{[^}]*\}/.exec(reduce)?.[0] ?? '', /transform:\s*none/,
    'reduced-motion 下 .hero-illo 必须 transform: none，把入场起点那 12% 收回来');
});

// 开屏"升起"的起点必须存在。第一版只抄了参照站关键帧里的 translateY(0)，
// 没抄它基础规则里的 translateY(12%) —— 起点终点都是 0，于是只剩擦开、没有升起，
// 而页面看起来完全正常：clip-path 在动、opacity 在动，没有任何东西报错。
test('hero illustration entrance actually rises, not just wipes', () => {
  const css = readFileSync('dist/assets/app.css', 'utf8');
  const illo = /\.hero-illo\{([^}]*)\}/s.exec(css)?.[1] ?? '';
  const start = /transform:\s*translateY\(([-\d.]+)%\)/.exec(illo)?.[1];
  assert.ok(start !== undefined, '.hero-illo 缺少初始 transform —— 升起动画没有起点');
  assert.notEqual(Number(start), 0, '.hero-illo 初始 translateY 为 0，升起动画等于原地不动');
  const key = /@keyframes hero-illo-enter\{([^}]*)\}/s.exec(css)?.[1] ?? '';
  assert.match(key, /transform:\s*translateY\(0(?:%|deg)?\)|transform:\s*none/,
    '关键帧必须动画到 translateY(0)，否则起点位移永远不会被收回');
});
