// 开屏幕布的承重契约。
// 这里每一条都对应一个「看起来正常、实际把主内容打死」的失效类，所以不是装饰性测试。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = () => readFileSync('dist/index.html', 'utf8');
// 断言读【源】CSS 而不是 dist/assets/app.css：产物被 lightningcss 压过，没有换行，
// @media 块的边界匹配会静默失配。源文件是否进了产物由 check.js 的 STYLESHEETS_MERGED 守。
const loaderCss = () => readFileSync('src/styles/loader.css', 'utf8');
const heroCss = () => readFileSync('src/styles/hero.css', 'utf8');
const tokenCss = () => readFileSync('src/styles/tokens.css', 'utf8');

test('loader is present, announced, and its innards are hidden from AT', () => {
  const h = html();
  assert.match(h, /class="site-loader" role="status" aria-live="polite" aria-label="正在准备首屏"/,
    '幕布必须自报状态：role=status + aria-label，否则读屏用户只看到一片静默');
  assert.match(h, /site-loader-mark" aria-hidden="true"/, '装饰性的狗图必须 aria-hidden');
  assert.match(h, /site-loader-track" aria-hidden="true"/, '进度轨不是真进度，必须对 AT 隐藏');
});

// 幕布靠 CSS 动画自己退场（不用 JS）。若退场终态不遮内容，页面会被一块 fixed 层永久盖住。
test('loader dismisses itself without JS and ends invisible', () => {
  const c = loaderCss();
  const illo = /\.site-loader\s*\{([^}]*)\}/s.exec(c)?.[1] ?? '';
  assert.match(illo, /animation:\s*site-loader-exit\b[^;]*\b(forwards|both)\b/,
    '幕布的退场动画必须带 forwards/both，否则动画结束后 fill 值失效、幕布落回原位盖住首屏');
  const kf = /@keyframes site-loader-exit\s*\{([\s\S]*?)\n\}/.exec(c)?.[1] ?? '';
  assert.match(kf, /visibility:\s*hidden/, '终态必须 visibility:hidden，否则它仍在无障碍树与绘制层里');
  assert.match(kf, /translateY\(-100%\)/, '终态必须滑出视口');
});

// 全程不吃指针：即使动画因任何原因没跑完，用户也点得到底下的东西。
test('loader never captures pointer events', () => {
  const illo = /\.site-loader\s*\{([^}]*)\}/s.exec(loaderCss())?.[1] ?? '';
  assert.match(illo, /pointer-events:\s*none/);
});

// 最关键的一条：reduced-motion 下必须【整块不存在】，而不是 animation:none。
// 参照站用 animation:none 是安全的，因为它的幕布由 JS 摘；我们的由动画摘 ——
// 关掉动画就等于让幕布永久停在首屏上。
test('reduced motion removes the loader entirely rather than freezing it on screen', () => {
  const c = loaderCss();
  const at = c.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  assert.notEqual(at, -1, 'loader.css 里必须有 reduce 块');
  const reduce = c.slice(at);
  assert.match(reduce, /\.site-loader\s*\{[^}]*display:\s*none/,
    'reduce 下必须 display:none；只写 animation:none 会让靠动画退场的幕布永久盖住页面');
});

// 幕布与 hero 入场的时序耦合：两边必须共用同一组 token，不能各写死一个数。
test('hero entrance waits for the curtain instead of playing underneath it', () => {
  assert.match(tokenCss(), /--loader-hold:\s*\.9s/, '幕布停留时长要有 token');
  assert.match(tokenCss(), /--hero-start:\s*\.95s/, 'hero 起跳时刻要有 token');
  const lmask = /\.lmask\s*>\s*span\s*\{([^}]*)\}/s.exec(heroCss())?.[1] ?? '';
  assert.match(lmask, /var\(--hero-start\)/,
    '第一行遮罩必须从 --hero-start 起跳；写死 0s 会让字在幕布底下落完，掀开时只剩静止标题');
  const illo = /\.hero-illo\s*\{([^}]*)\}/s.exec(heroCss())?.[1] ?? '';
  assert.match(illo, /calc\(var\(--hero-start\)/, '吉祥物入场同样要跟着 --hero-start');
});
