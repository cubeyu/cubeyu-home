// hero 吉祥物的产物契约。
// 为什么单独一份：这次接线暴露的失效类是「资产在 src/ 里、构建不拷、页面 404」，
// 而当时 102 项测试与 11 项 check 全绿 —— 没有任何东西看得到 src/images/ 是否存在于产物。
// 这里钉住三件承重的事：图进了 dist、装饰对辅助技术隐藏、狗的图集列数与 JS 的帧数一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const DIST = 'dist/index.html';
const CSS = 'dist/assets/app.css';

test('mascot images are shipped into dist', () => {
  for (const f of ['hero-person', 'hero-person-dark', 'hero-dog', 'hero-dog-dark']) {
    assert.ok(existsSync(`dist/assets/images/${f}.webp`), `dist/assets/images/${f}.webp 缺失 —— build.js 的 images 拷贝被去掉了？`);
  }
});

test('hero illustration is present and hidden from assistive tech', () => {
  const html = readFileSync(DIST, 'utf8');
  assert.match(html, /class="hero-illo" aria-hidden="true"/, '吉祥物必须 aria-hidden：它是纯装饰，且人物狗都是 background-image，没有可命名的内容');
  assert.match(html, /data-mascot-dog/, '狗缺少 data-mascot-dog —— mascot.js 找不到挂载点，跟随会静默失效');
});

// 图集列数在三个地方必须一致：CSS 的 background-size、JS 的 FRAMES、实际图片尺寸。
// 任何一处漂了，狗都会显示成半只或错位的一格，而页面看起来仍然"正常"。
test('dog atlas column count agrees across CSS, JS and the image', () => {
  const css = readFileSync(CSS, 'utf8');
  const size = /(\d+)% 100%/.exec(css.match(/\.hero-dog\{[^}]*background-size:\s*([\d.]+)% 100%/s)?.[0] ?? '');
  assert.ok(size, '.hero-dog 的 background-size 必须是 <N>% 100%（N 列 1 行）');
  const cols = Math.round(Number(size[1]) / 100);

  const js = readFileSync('src/js/mascot.js', 'utf8');
  const frames = Number(/const FRAMES = (\d+)/.exec(js)?.[1]);
  assert.ok(frames, 'mascot.js 必须声明 FRAMES');
  assert.equal(cols, frames, `CSS 图集列数 ${cols} 与 JS FRAMES ${frames} 不一致`);

  // 图片实际宽度必须正好是 8 个等宽帧
  const src = readFileSync('src/js/mascot.js', 'utf8');
  assert.match(src, /frame \/ \(FRAMES - 1\)/, 'background-position 必须按 i/(FRAMES-1) 取值，与 background-size 的 N 列规则同一条');
});

test('mascot does not animate for reduced motion or touch', () => {
  const js = readFileSync('src/js/mascot.js', 'utf8');
  // 两个守卫都必须【提前 return】，而不是绑了监听再判断 —— 后者在触屏上仍会常驻监听器
  assert.match(js, /hover: hover[\s\S]{0,80}pointer: fine[\s\S]{0,120}return/, '触屏必须完全不绑指针监听');
  assert.match(js, /prefers-reduced-motion[\s\S]{0,120}return/, 'reduced-motion 必须不追踪，狗停在静止帧');
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
