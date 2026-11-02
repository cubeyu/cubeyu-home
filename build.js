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
import { sections, links, ui } from './src/data/copy.js';
import { projects } from './src/data/projects.js';
import { skills } from './src/data/skills.js';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');

const tpl = readFileSync(join(root, 'src/templates/index.html'), 'utf8');
const tpl404 = readFileSync(join(root, 'src/templates/404.html'), 'utf8');

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

// Task 8：作品卡纸面形态。data-demo 属性与 .card-demo 容器都只在 p.demo 非 null 时输出 ——
// 纸面卡不留空壳，check.js 的「条目数 === article 数 === data-demo 数」才成立（三处都不写死卡数）。
const cardHtml = projects.map((p) => `
    <article class="card" data-slug="${esc(p.slug)}"${p.demo ? ` data-demo="${esc(p.demo)}"` : ''}>
      <div class="card-no">${esc(p.no)}</div>
      <div>
        <div class="card-meta">
          <span class="card-label">${i18n(p.label.zh, p.label.en)}</span>
          <span class="card-cat">${i18n(p.cat.zh, p.cat.en)}</span>
        </div>
        <h3 class="card-title"><a class="card-link" href="${esc(p.url)}">${i18n(p.title.zh, p.title.en)}</a></h3>
        <p class="card-quote">${i18n(p.quote.zh, p.quote.en)}</p>
        <div class="card-tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        ${p.demo ? `<div class="card-demo" data-demo-root="${esc(p.demo)}"></div>
        <p class="card-hint">${i18n(p.demoHint.zh, p.demoHint.en)}</p>` : ''}
      </div>
    </article>`).join('');

const skillsHtml = `<div class="skills-grid">${skills.map((s) => `<span class="skill">${i18n(s.zh, s.en)}</span>`).join('')}</div>`;
const sitesHtml = `<ul class="sites">${links.map((l) => `<li class="site"><a href="${esc(l.url)}">${esc(l.name)}</a><span class="site-note">${i18n(l.note.zh, l.note.en)}</span></li>`).join('')}</ul>`;

// 页脚邮箱按 brief 写字面量。注意 links 里也有同一条 mailto:cubeyu@aliyun.com，
// 属 ledger 已记的「同一 URL 两处真源」一类问题（github / hot 同样各写两份），
// 换邮箱要改两处 —— 留给控制器决定是否从 links 取。
const footerHtml = `<footer class="col foot"><span>${i18n(ui.copyright.zh, ui.copyright.en)}</span>`
  + `<span><a href="mailto:cubeyu@aliyun.com">cubeyu@aliyun.com</a></span></footer>`;

// 两个模板共用同一份 token 表：值只在这里定义一次，404 不会和首页漂开。
// 表里多出的 token 对 404 无害（renderTemplate 只报「模板要了但表里没有」的反向缺失）。
const tokens = {
  // 叶子 token（TITLE / DESCRIPTION / CANONICAL）必须过 esc()；
  // NAV / HERO / SECTIONS / FOOTER 是片段 token，组装处已逐字段转义，必须保持裸值，否则双重转义（见 Global Constraints）
  TITLE: esc(site.title),
  DESCRIPTION: esc(site.description),
  // CANONICAL 取 site.url：canonical 此前在模板里硬编码，与 site.url 是同一值的两个真源，现在只剩数据这一处。
  // 选 esc() 与 TITLE / DESCRIPTION 一致：它是属性值，含引号时不能截断 href="…"。
  CANONICAL: esc(site.url),
  NAV: nav,
  HERO: hero,
  // 区块内容按 id 取；?? '' 兜住「加了 section 但还没实现内容」，
  // 那种情况产出空区块而不是让构建崩在 undefined 上。
  SECTIONS: sections.map((s) => `<section id="${s.id}" class="col">`
    + `<p class="eyebrow">${esc(s.eyebrow)}</p>`
    + `<h2>${i18n(s.title.zh, s.title.en)}</h2>`
    + ({ works: cardHtml, skills: skillsHtml, sites: sitesHtml }[s.id] ?? '')
    + `</section>`).join(''),
  FOOTER: footerHtml,
};

// renderTemplate 的报错只写 token 名；index.html 与 404.html 两个调用点并存后，
// 光看 "Unknown token(s): FOOTER" 分不清哪个模板坏了（Task 1-3 遗留的 Minor，此刻转正）。
const render = (file, text) => {
  try {
    return renderTemplate(text, tokens);
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
};

const html = render('src/templates/index.html', tpl);
const notFoundHtml = render('src/templates/404.html', tpl404);

// 合并顺序 = 层叠顺序，分隔注释形如 /* --- demos/x.css --- */，check.js 按它比对。
const css = cssOrder
  .map((f) => `/* --- ${f} --- */\n` + readFileSync(join(root, 'src/styles', f), 'utf8'))
  .join('\n');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'index.html'), html, 'utf8');
// 404 复用同一份 app.css（spec 3 节：只有首页 + 一个极简 404，不另开样式入口）
writeFileSync(join(out, '404.html'), notFoundHtml, 'utf8');
writeFileSync(join(out, 'assets/app.css'), css, 'utf8');
// 偏离 1：原样拷贝 ES module 树，不做拼接打包
cpSync(join(root, 'src/js'), join(out, 'assets/js'), { recursive: true });
console.log('built dist/');
