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
// demo 注册表（spec 5.1）。构建期读它只为判断「这个 demo 名到底实现了没有」。
// 在 Node 里 import 是安全的：注册表本身是 `export default {}`，Task 11 往里面加的也是函数定义；
// 实测 `node -e "import('./src/js/demos/index.js')"` 在零浏览器环境下不报错，模块求值期无人碰 document。
// 反过来说，哪天某个 demo 模块把 DOM 访问写到顶层，这行 import 会当场
// `ReferenceError: document is not defined` 把构建打断 —— 那种代码本来就既不该在构建期跑、
// 也不该在模块求值期跑，报错正是想要的行为，不是需要绕过的障碍。
import demoRegistry from './src/js/demos/index.js';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');

const tpl = readFileSync(join(root, 'src/templates/index.html'), 'utf8');
const tpl404 = readFileSync(join(root, 'src/templates/404.html'), 'utf8');

// Task 7：导航条 + hero。nav 的语言切换 <a> 只带 data-lang-toggle 属性，
// 行为由 Task 10 的 i18n.js 挂上；此处先把 DOM 与双语节点烘出来。
// ui.langZh / langEn 也过 esc()：这两个值今天是「中」「EN」，安全得没什么好挡的，
// 但整行别的字段都转义了，唯独这一处裸插 —— 下一段复制这行代码的人不会注意到差别。
const nav = `<nav class="col nav"><a href="/">${i18n('首页', 'Home')}</a>`
  + `<span class="nav-right">`
  + `<a href="#" data-lang-toggle>${esc(ui.langZh)} / ${esc(ui.langEn)}</a>`
  + `<a href="${esc(site.nav.githubUrl)}">${esc(site.nav.githubText)}</a>`
  + `</span></nav>`;

// 遮罩三行只渲染 l.zh 是故意的：这三行是品牌字头 + 拉丁动词，两种语言同值。
// 这个前提是承重的 —— 日后某行改成中英不同值，英文态会静默显示中文。
// 现行 test/data.test.js 只断言 lines[i] 两侧非空（hasBoth），没断言 l.zh === l.en，
// 补那条断言归控制器（本任务的 scope 不含 test/*）。
// 真要双语差异时得改渲染结构（i18n() 双节点 + .lmask 两层），不能只改数据。
//
// roll-band：spec 7 的 HERO 行点名 `.hero.roll-band`，它是对照参照站 DOM 的类名对应关系。
// 今天没有任何 CSS 消费它（参照站那条 band 的滚动行为属 M4 reveal/动效那一层的范畴），
// 类名先落地，省得 M4 再回来改一次产物结构。
const hero = `<header class="hero roll-band col">`
  + `<h1>` + site.hero.lines.map((l) => `<span class="lmask"><span>${esc(l.zh)}</span></span>`).join('') + `</h1>`
  // sub 的两个 span 是【两个不同内容的品牌元素】，不是同一串的两种译文，所以都不挂 i18n-*：
  // 中文名 麦 希 屿 与拉丁身份行 DEVELOPER / AI TOOLS / OPEN-SOURCE 在两种语言下同时常驻。
  // 参照站实测 DOM 同构：div.sub 下 span.zh「欧 呦」+ span.en「ENGINEER / DESIGNER / OPEN-SOURCE」。
  // 挂上双语显隐类的后果（Task 7-8 审查抓到）：中文模式整个身份行消失、英文模式只剩身份行，
  // 而 hero.css 的 flex / gap / baseline 永远只作用在一个可见子元素上。
  // data/site.js 保留 sub: { zh, en } 的形状只是因为两个值分别来自中英两块内容，不表示它们互为翻译。
  + `<div class="hero-sub"><span class="zh">${esc(site.hero.sub.zh)}</span>`
  + `<span class="en">${esc(site.hero.sub.en)}</span></div>`
  + `<div class="hero-scroll">${i18n(site.hero.scroll.zh, site.hero.scroll.en)}</div>`
  + `</header>`;

// Task 8：作品卡纸面形态。
//
// url === '#' 时【不输出 <a>】，标题渲染成纯文本。spec 8.1 只授权一处 '#'：
// N°07 云隐博客的落点三处记载互斥、待用户在 M1 验收时给 URL。而 projects.js 今天有六张卡
// 都是 '#'，于是产物里躺着六个点了没反应的死链接 —— 一个不骗人但什么都不做的标题
// 比一个看起来可点、点了跳到页面顶部的链接好。真实链接由 Task 14 逐项向用户索取。
const cardTitle = (p) => {
  const text = i18n(p.title.zh, p.title.en);
  return p.url === '#' ? text : `<a class="card-link" href="${esc(p.url)}">${text}</a>`;
};

// demo 区（data-demo + .card-demo 容器）与 data-demo 属性都只在【该 demo 名已在注册表里实现】时输出，
// 判据不再是 projects.js 里声明了 p.demo。理由（Task 7-8 审查项 5）：七张卡全都声明了 demo，
// 而 demo 要 Task 11 起才逐个实现 —— 按声明输出会让空心边框盒进 M1 截图，看着像半成品。
// 按注册态输出：今天注册表是空的 `export default {}`，所以是零个；
// Task 11 注册 inkmark 之后自动变成恰好一个，之后每注册一个就多一个，build.js 不再需要改。
// 顺带永久关掉计划 Task 11 Step 7 记的那个洞：注册名拼错现在渲染成一张干净的纸面卡，
// 不再留空盒子，而拼错本身仍由 check.js（Task 12）的 DEMO_REGISTRY_MATCH 抓到。
// card-hint 跟着一起走：那句话描述的是 demo 里的操作（「在左边改几个字」），
// demo 不在的时候留着它就是在指一个不存在的交互。
const hasDemo = (name) => typeof name === 'string' && Object.hasOwn(demoRegistry, name);

const cardHtml = projects.map((p) => `
    <article class="card" data-slug="${esc(p.slug)}"${hasDemo(p.demo) ? ` data-demo="${esc(p.demo)}"` : ''}>
      <div class="card-no num">${esc(p.no)}</div>
      <div>
        <div class="card-meta">
          <span class="card-label">${i18n(p.label.zh, p.label.en)}</span>
          <span class="card-cat">${i18n(p.cat.zh, p.cat.en)}</span>
        </div>
        <h3 class="card-title">${cardTitle(p)}</h3>
        <p class="card-quote">${i18n(p.quote.zh, p.quote.en)}</p>
        <div class="card-tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        ${hasDemo(p.demo) ? `<div class="card-demo" data-demo-root="${esc(p.demo)}"></div>
        <p class="card-hint">${i18n(p.demoHint.zh, p.demoHint.en)}</p>` : ''}
      </div>
    </article>`).join('');

const skillsHtml = `<div class="skills-grid rule-t">${skills.map((s) => `<span class="skill rule-b">${i18n(s.zh, s.en)}</span>`).join('')}</div>`;
const sitesHtml = `<ul class="sites rule-t">${links.map((l) => `<li class="site rule-b"><a href="${esc(l.url)}">${esc(l.name)}</a><span class="site-note">${i18n(l.note.zh, l.note.en)}</span></li>`).join('')}</ul>`;

// 页脚邮箱按 brief 写字面量。注意 links 里也有同一条 mailto:cubeyu@aliyun.com，
// 属 ledger 已记的「同一 URL 两处真源」一类问题（github / hot 同样各写两份），
// 换邮箱要改两处 —— 留给控制器决定是否从 links 取。
const footerHtml = `<footer class="col foot rule-t"><span>${i18n(ui.copyright.zh, ui.copyright.en)}</span>`
  + `<span><a href="mailto:cubeyu@aliyun.com">cubeyu@aliyun.com</a></span></footer>`;

// spec 6.1 首帧防闪烁：CSS 加载前把偏好写进 data-theme，否则暗色用户每次刷新白闪一下。
// spec 6.2 明确禁止「一份偏好各写一遍」，而这段脚本此前在 index.html 与 404.html 里逐字抄了两份，
// Task 9 的 theme.js 会成为第三份副本、'cubeyu-theme' 这个键名也会在三个地方各漂一次。
// 现在只有这一处定义，两个模板拿同一个 {{ANTI_FLASH}} 片段 token（裸值，不过 esc：
// 转义它等于把 <script> 变成页面上的一行文本）。
// 键名 cubeyu-theme 是 prefs.js（Task 9）与这里唯一的共享约定。
const antiFlash = `<script>
/* 首帧防闪烁：CSS 加载前写入偏好，否则暗色用户每次刷新都白闪一下。spec 6.1 */
try{var t=localStorage.getItem('cubeyu-theme')||'auto';
document.documentElement.dataset.theme=(t==='auto')?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;}catch(e){}
</script>`;

// 区块内容按 id 取。这里原来是 `[s.id] ?? ''`，它兜的「新增了一个 section 但还没实现内容」
// 和它掩盖的事故是同一种写法：copy.js 里把 id 打成 `works ` 或 `wroks`，`?? ''` 就安静地
// 产出一个只有 eyebrow 和标题的空 <section>，构建绿灯、产物少一整块内容，没人会发现。
// 空区块不是合法产物（三个 section 的计划只有一份），所以改成大声失败：拼错在构建期就 throw。
class MissingSectionRendererError extends Error {
  constructor(id) {
    super(`sections[].id "${id}" 在 build.js 里没有对应的 renderer —— `
      + `要么在 sectionRenderers 里补一个，要么删掉 copy.js 里这条 section（原来靠 ?? '' 兜底，会把拼错的 id 烘成空 <section> 且构建成功）`);
    this.name = 'MissingSectionRendererError';
  }
}

const sectionRenderers = { works: cardHtml, skills: skillsHtml, sites: sitesHtml };

// 两个模板共用同一份 token 表：值只在这里定义一次，404 不会和首页漂开。
// 表里多出的 token 对 404 无害（renderTemplate 只报「模板要了但表里没有」的反向缺失）。
const tokens = {
  // 叶子 token（TITLE / DESCRIPTION / CANONICAL）必须过 esc()；
  // NAV / HERO / SECTIONS / FOOTER / ANTI_FLASH 是片段 token，组装处已逐字段转义，必须保持裸值，否则双重转义（见 Global Constraints）
  TITLE: esc(site.title),
  DESCRIPTION: esc(site.description),
  // CANONICAL 取 site.url：canonical 此前在模板里硬编码，与 site.url 是同一值的两个真源，现在只剩数据这一处。
  // 选 esc() 与 TITLE / DESCRIPTION 一致：它是属性值，含引号时不能截断 href="…"。
  CANONICAL: esc(site.url),
  NAV: nav,
  HERO: hero,
  SECTIONS: sections.map((s) => {
    if (!Object.hasOwn(sectionRenderers, s.id)) throw new MissingSectionRendererError(s.id);
    return `<section id="${s.id}" class="col">`
      + `<p class="eyebrow">${esc(s.eyebrow)}</p>`
      + `<h2>${i18n(s.title.zh, s.title.en)}</h2>`
      + sectionRenderers[s.id]
      + `</section>`;
  }).join(''),
  FOOTER: footerHtml,
  ANTI_FLASH: antiFlash,
};

// renderTemplate 的报错只写 token 名；index.html 与 404.html 两个调用点并存后，
// 光看 "Unknown token(s): FOOTER" 分不清哪个模板坏了（Task 1-3 遗留的 Minor，此刻转正）。
// { cause: e } 是必需的：原来只把 e.message 拼进新 Error，栈就从 renderTemplate 内部
// 变成了这一行 —— 报错说得出哪个模板坏了，却说不出为什么，排错时得重新把代码读一遍。
const render = (file, text) => {
  try {
    return renderTemplate(text, tokens);
  } catch (e) {
    throw new Error(`${file}: ${e.message}`, { cause: e });
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
