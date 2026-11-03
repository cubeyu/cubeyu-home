// 分类切换（tab）的契约。
// 这块最容易出的错不是"切不动"，而是渐进增强的方向反过来：
// 一旦产物里预先写了 role=tab / hidden，禁 JS 的用户就只剩一个面板能看——
// 那不是装饰降级，是内容丢失。所以第一条断言判的是"产物里【没有】什么"。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sections } from '../src/data/copy.js';

const DIST = 'dist/index.html';
const CSS = 'src/styles/tabs.css';
const JS = 'src/js/tabs.js';

// 扫源码判据之前先剥注释：本站已经第三次被"注释里正好写着被禁的那个词"咬到
// （#1a1a1a21、innerHTML、prefers-reduced-motion 各一次）。与 check.js 的 COLOR_LEAK 同口径。
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('every section gets exactly one tab, and the tab points at that section', () => {
  const html = readFileSync(DIST, 'utf8');
  for (const s of sections) {
    const link = new RegExp(`<a class="tab" href="#${s.id}">`).source;
    assert.equal((html.match(new RegExp(link, 'g')) || []).length, 1,
      `区块 ${s.id} 应当有且只有一个 tab 指向它`);
    assert.ok(html.includes(`<section id="${s.id}"`), `区块 ${s.id} 的面板没在产物里`);
  }
  // 数量由数据算，不写死：用户会加区块也会砍区块
  assert.equal((html.match(/class="tab"/g) || []).length, sections.length,
    'tab 数量必须等于 sections 数量（多出来的是漏删，少了的是漏加）');
});

test('the built page is fully expanded: no tab semantics, no hidden panels', () => {
  const html = readFileSync(DIST, 'utf8');
  assert.doesNotMatch(html, /role="tab"/, '产物里不许预写 role=tab —— 那是 JS 升级时才写的');
  assert.doesNotMatch(html, /role="tabpanel"/, '同上');
  assert.doesNotMatch(html, /aria-selected/, '同上：选中态是运行期状态，烘进产物就成了谎话');
  assert.doesNotMatch(html, /<section[^>]*\shidden/, '产物里的面板必须全部展开');
  assert.doesNotMatch(html, /<nav class="tabs"[^>]*role="tablist"/, 'tablist 角色也只能由 JS 加');
});

test('tab labels are derived from the eyebrow, so the two can never disagree', () => {
  const html = readFileSync(DIST, 'utf8');
  // class 是 "tabs col"（窄栏对齐靠 .col），正则漏掉 `[^"]*` 就永远匹配不到、断言空转
  const bar = /<nav class="tabs[^"]*".*?<\/nav>/s.exec(html)?.[0] ?? '';
  assert.ok(bar.length > 0, '产物里找不到 .tabs 这一条 nav');
  for (const s of sections) {
    const [zh, en] = s.eyebrow.split(' / ');
    assert.ok(zh && en, `copy.js 里 ${s.id} 的 eyebrow "${s.eyebrow}" 不是「中文 / ENGLISH」形状`);
    assert.ok(bar.includes(zh) && bar.includes(en),
      `tab 里应当同时烘着 ${zh} 与 ${en}（双语是构建期烘的，不是 JS 写的）`);
  }
});

test('the decorative index number is hidden from assistive tech', () => {
  const html = readFileSync(DIST, 'utf8');
  assert.match(html, /<span class="reel" aria-hidden="true"><\/span>/,
    '大编号必须 aria-hidden 且内容留空：第几类只有 JS 知道，产物里写死就是第二份真源');
});

test('the upgrade is guarded, restores the flat layout on destroy, and never trusts a bad hash', () => {
  const js = readFileSync(JS, 'utf8');
  assert.match(js, /if \(tabs\.length < 2 \|\| panels\.some\(\(p\) => !p\)\) return \(\) => \{\};/,
    '区块被砍到只剩一个、或有 href 找不到面板时必须整体不升级，半升级更糟');
  assert.match(js, /return i < 0 \? null : i;/, '认不出的 hash 要回落，不许 throw');
  assert.match(js, /tab\.tabIndex = on \? 0 : -1/, 'roving tabindex：整个 tablist 在 Tab 序列里只占一格');
  assert.match(js, /ArrowRight[\s\S]{0,120}ArrowLeft[\s\S]{0,160}Home[\s\S]{0,80}End/, '方向键与 Home/End 必须齐');
  assert.match(js, /\(i \+ tabs\.length\) % tabs\.length/, '首尾环绕');
  assert.match(js, /e\.preventDefault\(\)/, '升级后必须拦住锚点默认跳转，否则和折叠态打架');
  assert.match(js, /history\.pushState/, '地址栏要跟着走（深链），但不能用 location.hash 赋值——那会触发滚动');
  assert.match(js, /panels\[i\]\.hidden = false/, 'destroy() 必须退回"全部展开"，与无 JS 的产物同构');
  for (const attr of ['role', 'aria-selected', 'aria-controls', 'aria-labelledby']) {
    assert.match(js, new RegExp(`removeAttribute\\(['"]${attr}['"]\\)`), `destroy() 漏了 ${attr}`);
  }
});

test('the panel entrance animation restarts, and is gated on the JS upgrade', () => {
  const js = readFileSync(JS, 'utf8');
  // 不强制回流的话，连续两次切到同一个面板不会重播（同名动画没被移除过）
  assert.match(js, /classList\.remove\('panel-enter'\);\s*void panel\.offsetWidth;\s*panel\.classList\.add\('panel-enter'\)/,
    '入场动画要先摘类再强制回流，否则重切不重播');
  const css = stripComments(readFileSync(CSS, 'utf8'));
  assert.match(css, /html\.has-tabs \.panel-enter/, '折叠态才该有入场动画；无 JS 时全部展开，不该有东西在动');
  // tab 名与区块 eyebrow 是同一个词（从 eyebrow 派生），折叠态下必须让 eyebrow 让位，
  // 但只能"藏"不能"删"：无 JS 时它是该区块唯一的标题。
  assert.match(css, /html\.has-tabs \.col > \.eyebrow\s*\{\s*display:\s*none/,
    '有 tab 时 eyebrow 与 tab 名重复，必须藏；无 JS 时必须还在');
  assert.doesNotMatch(css, /^\.eyebrow\s*\{[^}]*display:\s*none/m, '不许无条件藏 eyebrow——禁 JS 就没了区块标题');
  assert.doesNotMatch(css, /prefers-reduced-motion/,
    '时长由 base.css 的全局归零块统一处理，组件里再写一份就是第二个真源');
});

test('the tab bar sits below the fold, and carries the section rhythm itself', () => {
  const css = stripComments(readFileSync(CSS, 'utf8'));
  const bar = /^\.tabs\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '';
  // 首屏切到「作品 技能 站点」就是这么来的：hero 86vh + 导航行 ≈ 763px，
  // 而 .tabs 紧贴 hero 下沿长出来。参照站的 tab 条坐在第一个 section 的 12vh 上边距里，
  // 所以它天然在折叠线以下 —— 86vh + 12vh = 98vh，再叠上导航行的固定高度，任何窗口高度都落在 fold 之下。
  assert.match(bar, /margin-block-start:\s*12vh/, '.tabs 必须自己带上 12vh 的上边距');
  assert.doesNotMatch(bar, /padding-block-start/, '必须是 margin 不是 padding：.reel 按盒子高度居中，padding 会把盒子一起撑高');
  // 折叠态下这段距离只能算一次，否则 tab 条与内容之间叠出 160px+ 的空档
  assert.match(css, /html\.has-tabs section\s*\{\s*padding-block-start:\s*0/, '面板自己那份 12vh 要收掉');
});

test('the tab bar visual signature uses tokens, not literals', () => {
  const css = stripComments(readFileSync(CSS, 'utf8'));
  const band = /\.tab::after\s*\{([^}]*)\}/s.exec(css)?.[1] ?? '';
  assert.match(band, /background:\s*var\(--mark-bg\)/, '选中态那条黄带必须是全站唯一的强调色');
  assert.match(band, /transform:\s*scaleX\(0\)/, '带子是"扫过去"不是"淡入"');
  assert.match(/\.tab\[aria-selected="true"\]::after\s*\{([^}]*)\}/s.exec(css)?.[1] ?? '', /scaleX\(1\)/);
  const reel = /\.reel\s*\{([^}]*)\}/s.exec(css)?.[1] ?? '';
  assert.match(reel, /-webkit-text-stroke:\s*1px var\(--rule-ghost\)/, '空心编号必须描边，且颜色走 token');
  assert.match(reel, /color:\s*transparent/);
  assert.match(reel, /pointer-events:\s*none/, '220px 的编号盖在版心上，不能吃点击');
});
