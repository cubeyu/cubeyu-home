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

// ---------- 狗从幕布落到 hero（loader.js + .loader-drop） ----------
// 这块最容易犯的错不是"动画不好看"，而是装饰反过来管住了主内容。
// 参照站那版是 JS 摘幕布 + 8s 上限兜底；我们让幕布继续只归 CSS 管，
// 于是下面第一条是这一节唯一真正承重的断言。
const loaderJs = () => readFileSync('src/js/loader.js', 'utf8');

test('the drop never owns the curtain: it cannot dismiss, hide, or delay it', () => {
  const js = loaderJs();
  assert.doesNotMatch(js, /curtain\.remove\(\)/, 'loader.js 不许摘幕布 —— 它一报错首屏就永久被盖住');
  assert.doesNotMatch(js, /curtain\.style\.(display|visibility|animation)/, '也不许改幕布的可见性或动画');
  assert.doesNotMatch(js, /classList\.(add|toggle)\([^)]*(is-exiting|hidden|done)/,
    '不许用类去驱动幕布的退场，那是把 CSS 契约交出去');
  assert.match(js, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)[\s\S]{0,80}return/,
    '减弱动效下幕布整块不存在，这条装饰也必须完全不跑');
});

test('the drop timing is not a second copy of --loader-hold', () => {
  const js = loaderJs();
  // 起跳时刻听幕布自己的 animationstart：两处各写一个 .9s 迟早漂
  assert.match(js, /addEventListener\('animationstart', promote, \{ once: true \}\)/,
    '必须听 animationstart，而不是 setTimeout(900)');
  assert.doesNotMatch(js, /setTimeout\([^)]*,\s*(900|\.9)\)/, '不许把幕布时长抄进 JS');
  assert.match(tokenCss(), /--loader-drop:/, '下落时长要有 token，与 --loader-hold/--hero-start 同一组');
});

test('the clone always leaves: animationend plus a hard timeout', () => {
  const js = loaderJs();
  assert.match(js, /addEventListener\('animationend', land, \{ once: true \}\)/,
    'illo 入场结束时摘掉克隆体，那一刻真狗已经到位');
  assert.match(js, /setTimeout\(land, \d+\)/,
    'animationend 没来也必须摘 —— 否则一只 fixed 狗永久停在首屏上');
  assert.match(js, /if \(!clone\) return;/, 'land 要能被重复调用（两个来源都会触发）');
});

test('the clone lands on the dog\'s FINAL rect, not the animated one', () => {
  const js = loaderJs();
  // hero 的 illo 入场时带 translateY，量到的矩形比终点低 12%；
  // 从 computed transform 的矩阵里把当前位移减掉，才不依赖"此刻动画跑到哪了"。
  assert.match(js, /new DOMMatrixReadOnly\(getComputedStyle\(illo\)\.transform\)\.f/,
    '必须用 transform 矩阵反推动画终态的位置');
  assert.match(js, /rectInDocument\(target, ty\)/, '终态 = 当前矩形减去入场位移 ty');
  assert.match(js, /r\.top \+ window\.scrollY - \(dy \|\| 0\)/, '减位移与换算文档坐标必须在同一处算完，别两套坐标混用');
});

test('the clone lands in document coordinates, so scrolling cannot strand it', () => {
  const js = loaderJs();
  // 行首锚定：`.site-loader-mark, .loader-drop {` 里也有 `.loader-drop {` 这个子串
  const drop = /^\.loader-drop\s*\{([^}]*)\}/m.exec(readFileSync('src/styles/loader.css', 'utf8'))?.[1] ?? '';
  // 视口坐标 + fixed 的失效方式很隐蔽：狗会钉在屏幕上，用户滚一下页，
  // 它就"落在下面的 tab 条上"（用户实测抓到一次）。
  assert.match(js, /r\.left \+ window\.scrollX/, '起点矩形必须换算成文档坐标');
  assert.match(js, /r\.top \+ window\.scrollY/, '同上');
  assert.match(drop, /position:\s*absolute/,
    '克隆体必须 absolute：配合文档坐标，它才跟着页面走、始终落在真狗身上');
  assert.doesNotMatch(drop, /position:\s*fixed/,
    'fixed + 文档坐标会让狗出现在页面下方很远处（两套坐标系混用）');
});

test('the drop keyframes interpolate from JS-supplied geometry only', () => {
  const c = loaderCss();
  // 行首锚定：共享声明 `.site-loader-mark, .loader-drop {` 里也有 `.loader-drop {` 这个子串，
  // 不锚行首就会抓到那条没有 z-index 的规则（判据咬到自己写的复用）。
  const drop = /^\.loader-drop\s*\{([^}]*)\}/m.exec(c)?.[1] ?? '';
  assert.match(drop, /z-index:\s*10000/, '克隆体必须高于幕布的 9999，否则它跟着幕布一起被抬走');
  assert.match(drop, /pointer-events:\s*none/, '不许吃点击：它盖在首屏上');
  // 落点误差的成因不是随机数：--drop-x/y 是【左上角之差】，而 scale() 默认绕中心，
  // 于是终态偏 (原宽−目标宽)/2 —— 实测 3.5px / 4.2px。锚到左上角后误差 0.0px。
  assert.match(drop, /transform-origin:\s*0 0/, '必须绕左上角缩放，否则狗落在目标右下各几像素处');
  assert.match(drop, /animation:\s*loader-drop var\(--loader-drop\)/, '时长走 token');
  const kf = /@keyframes loader-drop\s*\{([\s\S]*?)\n\}/.exec(c)?.[1] ?? '';
  for (const v of ['--drop-x', '--drop-y', '--drop-sx', '--drop-sy']) {
    assert.ok(kf.includes(`var(${v})`), `关键帧缺 ${v}：几何必须来自 JS 写的自定义属性，不能写死`);
  }
  assert.match(kf, /animation-timing-function:\s*var\(--ease-drop\)/, '下坠段用加速曲线');
  assert.match(kf, /animation-timing-function:\s*var\(--ease-expo\)/, '收回段用全站那条 expo');
  // 幕布上的原件与克隆体共用图集与暗色切换，分两处写迟早出现亮暗错配
  assert.match(c, /\.site-loader-mark,\s*\.loader-drop\s*\{/, '两者必须共用同一份背景声明');
  assert.equal((c.match(/hero-dog\.webp/g) || []).length, 1, '亮色图集只该出现一次');
  assert.equal((c.match(/hero-dog-dark\.webp/g) || []).length, 1, '暗色图集只该出现一次');
});

// 下落的狗落定后不能"啪"地换脸或换个比例。
// 幕布那侧的声明在 loader.css，首屏那只狗在 hero.css，两个文件、两条规则，
// 但必须是同一格帧 + 同一个格子宽高比 —— 换图集时只改一边，浏览器不会报错，
// 只会让落点那一瞬间狗头跳一格（或整只狗被拉扁）。
test('the dropped clone and the hero dog are the same cell at the same aspect', () => {
  const decls = (text, rule) => {
    const body = rule.exec(text)?.[1] ?? '';
    const pick = (re) => (re.exec(body)?.[1] ?? '').replace(/\s+/g, '');
    return {
      size: pick(/background-size:\s*([^;]+);/),
      pos: pick(/background-position:\s*([^;]+);/),
      ar: pick(/aspect-ratio:\s*([^;]+);/),
    };
  };
  const mark = decls(loaderCss(), /^\.site-loader-mark,\s*\.loader-drop\s*\{([^}]*)\}/m);
  const hero = decls(heroCss(), /^\.hero-dog\s*\{([^}]*)\}/m);
  assert.deepEqual(hero, mark, '幕布上的狗与首屏的狗必须是同一格帧、同一格子比例');
  assert.ok(mark.size, '共用规则缺 background-size（图集是双轴的，两轴都要铺满）');
});
