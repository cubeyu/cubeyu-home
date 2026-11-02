// build.js —— 模板渲染 + CSS 合并 + ES module 树拷贝，产出 dist/。
// 纯顶层脚本：不 export build()，也不加「我是不是被 import」的守卫。
// 理由（spec 5.3 裁定）：M1 内没有任何模块 import 本文件（check.js 只读 dist/ 产物），
// 而那个守卫在 Windows 上不可靠 —— process.argv[1] 是反斜杠形式，
// fileURLToPath(import.meta.url) 是正斜杠形式，比较结果取决于从哪里调用 node。
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, cssOrder, esc, i18n } from './src/lib/build-utils.js';
import { site } from './src/data/site.js';
import { ui, sections } from './src/data/copy.js';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');

const tpl = readFileSync(join(root, 'src/templates/index.html'), 'utf8');

// Task 7：导航条 + hero。nav 的语言切换 <a> 只带 data-lang-toggle 属性，
// 行为由 Task 10 的 i18n.js 挂上；此处先把 DOM 与双语节点烘出来。
const nav = `<nav class="col nav"><a href="/">${i18n('首页', 'Home')}</a>`
  + `<span class="nav-right">`
  + `<a href="#" data-lang-toggle>${ui.langZh} / ${ui.langEn}</a>`
  + `<a href="${esc(site.nav.githubUrl)}">${esc(site.nav.githubText)}</a>`
  + `</span></nav>`;

// 遮罩三行只渲染 l.zh 是故意的：这三行是品牌字头 + 拉丁动词，两种语言同值。
// 这个前提是承重的 —— 日后某行改成中英不同值，英文态会静默显示中文。
// 现行 test/data.test.js 只断言 lines[i] 两侧非空（hasBoth），没断言 l.zh === l.en，
// 补那条断言归控制器（本任务的 scope 不含 test/*）。
// 真要双语差异时得改渲染结构（i18n() 双节点 + .lmask 两层），不能只改数据。
const hero = `<header class="hero col">`
  + `<h1>` + site.hero.lines.map((l) => `<span class="lmask"><span>${esc(l.zh)}</span></span>`).join('') + `</h1>`
  // sub 同时挂 .zh/.en（供本区块样式）与 .i18n-*（供全局显隐规则），两套类名各管各的
  + `<div class="hero-sub"><span class="zh i18n i18n-zh">${esc(site.hero.sub.zh)}</span>`
  + `<span class="en i18n i18n-en">${esc(site.hero.sub.en)}</span></div>`
  + `<div class="hero-scroll">${i18n(site.hero.scroll.zh, site.hero.scroll.en)}</div>`
  + `</header>`;

// 本任务烘 nav / hero / 区块占位；卡片区随 Task 8 填入 SECTIONS，页脚随 Task 8 引入 FOOTER。
// 叶子 token（TITLE / DESCRIPTION / CANONICAL）必须过 esc()；NAV / HERO / SECTIONS / FOOTER 是片段 token，
// 组装处已逐字段转义，必须保持裸值，否则双重转义（见 Global Constraints）
// CANONICAL 取 site.url：canonical 此前在模板里硬编码，与 site.url 是同一值的两个真源，
// 现在只剩数据这一处（spec 5.3 的转义边界：属性值走 esc()，引号不能截断属性）。
const html = renderTemplate(tpl, {
  TITLE: esc(site.title),
  DESCRIPTION: esc(site.description),
  CANONICAL: esc(site.url),
  NAV: nav,
  HERO: hero,
  SECTIONS: sections.map((s) => `<section id="${s.id}" class="col"><p class="eyebrow">${esc(s.eyebrow)}</p></section>`).join(''),
});

// 合并顺序 = 层叠顺序，分隔注释形如 /* --- demos/x.css --- */，check.js 按它比对。
const css = cssOrder
  .map((f) => `/* --- ${f} --- */\n` + readFileSync(join(root, 'src/styles', f), 'utf8'))
  .join('\n');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'index.html'), html, 'utf8');
writeFileSync(join(out, 'assets/app.css'), css, 'utf8');
// 偏离 1：原样拷贝 ES module 树，不做拼接打包
cpSync(join(root, 'src/js'), join(out, 'assets/js'), { recursive: true });
console.log('built dist/');
