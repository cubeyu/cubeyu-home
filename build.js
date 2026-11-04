// build.js —— 模板渲染 + CSS 合并与压缩 + ES module 树拷贝与压缩，产出 dist/。
// 纯顶层脚本：不 export build()，也不加「我是不是被 import」的守卫。
// 理由（spec 5.3 裁定）：M1 内没有任何模块 import 本文件（check.js 只读 dist/ 产物），
// 而那个守卫在 Windows 上不可靠 —— process.argv[1] 是反斜杠形式，
// fileURLToPath(import.meta.url) 是正斜杠形式，比较结果取决于从哪里调用 node。
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
// 内容哈希：图片文件名带上字节摘要，才能对它们开一年 immutable 缓存。
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
// Task 13：构建期压缩。两者都只在 devDependencies —— 产物本身零运行时依赖的纪律不变，
// 压缩发生在构建期，浏览器拿到的是纯字节。
// 偏离 brief 一处：brief 写的是 `codeBuffer:`，lightningcss 1.33.0 没有这个选项
// （实测报 `Error: missing field 'code'`，node/index.d.ts 里该字段就叫 `code: Uint8Array`），
// 语义相同的 `code: Buffer.from(...)` 替代，minify: true 等其余参数逐字照 brief。
import { transform } from 'lightningcss';
import { minify } from 'terser';
import { renderTemplate, cssOrder, esc, i18n } from './src/lib/build-utils.js';
// prefs.js 是零 DOM 的纯模块（模块求值期不碰任何浏览器对象），所以在 Node 里 import 它安全，
// 拿到的是同一份 DARK_QUERY 字面量 —— 内联防闪烁脚本是唯一 import 不到它的一侧（它在模块下载前
// 就执行），所以那里只能把键名再写一遍；查询串则从这里插进模板，两侧共用一个真源（审查 M2）。
import { DARK_QUERY } from './src/js/prefs.js';
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

// Task 7：导航条 + hero。nav 的语言切换控件只带 data-lang-toggle 属性，
// 行为由 Task 10 的 i18n.js 挂上；此处先把 DOM 与双语节点烘出来。
// ui.langZh / langEn 也过 esc()：这两个值今天是「中」「EN」，安全得没什么好挡的，
// 但整行别的字段都转义了，唯独这一处裸插 —— 下一段复制这行代码的人不会注意到差别。
// Task 10 补 data-labels：i18n.js 切换后要把可见文字写回按钮，而它不读 src/data/*
// （浏览器侧拿不到数据层），标签只能从 DOM 属性进来。值同样过 esc()，不照 brief 裸插。
//
// Task 9-10 审查 I3 + I4 改了这个控件的两件事，两处都指向同一条原则「无 JS 态与 JS 态
// 必须对同一个控件给出同一种承诺」：
// · I4：`<a href="#">` + preventDefault 换成 `<button type="button">`。关 JS 时那个「链接」
//   只会滚到页顶、什么都不切，Ctrl/中键还会多开一个同页标签；按钮没有默认跳转，点了不动，
//   与页脚主题开关（本来就是按钮）一致。外观由 base.css 的 `.nav button` 复位成字面文本。
// · I3：可见文字不再被收成当前语言一个词。`中 / EN` 两个选项同时在场才是「二态开关」的自证，
//   所以 langPair 一次组成、同时用作属性值与元素文字 —— 首帧写回的就是同一串，零替换
//   （主题开关烘「自动」已经是这个形状）。无障碍名改成含住可见文字的前缀式（`切换语言：中 / EN`），
//   原先「可见文字说当前语种、aria-label 说目标语种」没有任何共同子串，踩 WCAG 2.5.3 Label in Name。
// 分隔符约定：pref-ui.js 按逗号 split(',')，所以可见文字里不能出现逗号 —— test/prefs.test.js 钉住。
const langPair = `${ui.langZh} / ${ui.langEn}`;
const nav = `<nav class="col nav"><a href="/">${i18n('首页', 'Home')}</a>`
  + `<span class="nav-right">`
  + `<button type="button" data-lang-toggle data-labels="${esc(langPair)}">${esc(langPair)}</button>`
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
// 吉祥物放在 h1 内部、三行遮罩之后：它是对标题盒的装饰定位，跟着 h1 走才不会在
// 换行时错位。第 4 个子元素不影响 .lmask:nth-child(2|3) 的 stagger 选择器 —— 那两个
// 只数到 3。aria-hidden 是因为它是纯装饰（人物与狗都做 background-image，见 hero.css）。
const illo = `<span class="hero-illo" aria-hidden="true">`
  + `<span class="hero-mascot">`
  + `<span class="hero-person"></span>`
  + `<span class="hero-dog" data-mascot-dog></span>`
  + `</span></span>`;

const hero = `<header class="hero roll-band col">`
  + `<h1>` + site.hero.lines.map((l) => `<span class="lmask"><span>${esc(l.zh)}</span></span>`).join('') + illo + `</h1>`
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
// url === '#' 时【不输出 <a>】，标题渲染成纯文本。今天这三张卡都有真实仓库地址，所以产物里
// 一个 '#' 也没有；这条分支留着是因为换卡时"项目存在但地址还没定"是常态 ——
// 一个不骗人但什么都不做的标题，比一个看起来可点、点了跳到页面顶部的链接好。
// 反面证据在 Task 8 当时：那时六张卡都是 '#'，产物里躺着六个死链接。
const cardTitle = (p) => {
  const text = i18n(p.title.zh, p.title.en);
  return p.url === '#' ? text : `<a class="card-link" href="${esc(p.url)}">${text}</a>`;
};

// demo 区（data-demo + .card-demo 容器）与 data-demo 属性都只在【该 demo 名已在注册表里实现】时输出，
// 判据不是 projects.js 里声明了 p.demo。理由（Task 7-8 审查项 5）：声明是意图、注册才是实现，
// 按声明输出会让空心边框盒进截图，看着像半成品 —— 那个洞在计划 Task 11 Step 7 里记过。
// 按注册态输出：注册几个就渲染几个，M3 加 demo 时 build.js 一行都不用改；
// 注册名拼错渲染成一张干净的纸面卡，而拼错本身由 check.js 的 DEMO_REGISTRY_MATCH 抓到。
// card-hint 跟着一起走：那句话描述的是 demo 里的操作（「在左边改几个字」），
// demo 不在的时候留着它就是在指一个不存在的交互。
const hasDemo = (name) => typeof name === 'string' && Object.hasOwn(demoRegistry, name);

const cardHtml = projects.map((p) => `
    <article class="card" data-slug="${esc(p.slug)}"${hasDemo(p.demo) ? ` data-demo="${esc(p.demo)}"` : ''}>
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
//
// Task 9 的明暗开关落在页脚，不照 task-9-brief Step 6 说的塞进 nav（控制器裁定，偏离已在报告里记）：
// spec 7 的 IA 表把「明暗开关」写在 FOOTER 行（`© 2026 麦希屿` + 明暗开关 + 动效开关 + 联系邮箱），
// 而参照站实测导航条只有语言切换与 github.com/cubeyu 字面文本链接两项。
// 照 brief 做会让我们的 nav 与参照站平白多出一个元素，换来的只是同一个按钮换个位置。
// 三态标签按 spec 7 的顺序排在邮箱之前，M4 的动效开关再插在它后面。
// data-labels-zh / data-labels-en 两套都烘上：theme.js 的按钮文案是 textContent 写的，
// CSS 的 .i18n-* 显隐规则罩不到 JS 运行期写入的文本，所以按钮自己按 <html lang> 取一套
// （只烘 zh 的话，英文态会留下一个中文的「暗」）。
// 两个 join 的结果都过 esc()：与 nav 的语言标签同纪律 —— 属性值一律转义，哪怕现值安全。
// 无 JS 时这个按钮是死的（主题只能靠 data-theme，纯 CSS 无法持久化偏好）：
// 文案写 auto 的中文标签「自动」，即默认态，不谎报成别的态。
const themeToggle = `<button type="button" class="pref-toggle" data-theme-toggle`
  + ` data-labels-zh="${esc(ui.themeLabels.zh.join(','))}"`
  + ` data-labels-en="${esc(ui.themeLabels.en.join(','))}">${esc(ui.themeLabels.zh[0])}</button>`;

const footerHtml = `<footer class="col foot rule-t"><span>${i18n(ui.copyright.zh, ui.copyright.en)}</span>`
  + themeToggle
  + `<span><a href="mailto:cubeyu@aliyun.com">cubeyu@aliyun.com</a></span></footer>`;

// spec 6.1 首帧防闪烁：CSS 加载前把偏好写进 <html>，否则暗色用户每次刷新白闪一下、
// 英文用户每次刷新先看到一整帧中文。
// spec 6.2 明确禁止「一份偏好各写一遍」，而这段脚本此前在 index.html 与 404.html 里逐字抄了两份，
// Task 9 的 theme.js 会成为第三份副本、'cubeyu-theme' 这个键名也会在三个地方各漂一次。
// 现在只有这一处定义，两个模板拿同一个 {{ANTI_FLASH}} 片段 token（裸值，不过 esc：
// 转义它等于把 <script> 变成页面上的一行文本）。
// 键名 cubeyu-theme / cubeyu-lang 是 prefs.js（读写走 readPref/writePref 的 PREFIX）与这里
// 唯一的共享约定，test/prefs.test.js 两侧都钉了；系统深浅的查询串不重复 —— 它从 DARK_QUERY 插进来。
//
// Task 9 实测改掉一处：写入原本在 try 里面，于是「读偏好失败」连带「写入也失败」。
// 隐私模式下 localStorage 一访问就抛（复现方法见报告：给同源 iframe 的 window 装一个
// 抛异常的 localStorage getter，让同一份 head 在它里面重跑一遍），首帧因此拿不到 data-theme，
// 暗色系统 + 存储被禁的用户照样白闪 —— 正是这段脚本存在的理由。
// 现在 try 只包住读，写入无条件执行，读不到就按默认走。
// 判据也从 `t==='auto'` 换成 `light|dark` 白名单，与 prefs.js 的 normalizeTheme 同一语义：
// 存储里是坏值（手改出来的 'blue'）时首帧就按系统色画，而不是写进 data-theme="blue"、
// 等 theme.js 再纠正回系统色 —— 中间那一帧就是白闪。
//
// Task 10 之后语言偏好也能持久化了，于是同一条缺陷换了个主体复发（审查 I1）：
// <html lang> 是模板硬编码的 `zh`，English 用户 reload 后先看到中文、等 app.js 跑完才翻成英文，
// 而这段脚本正是 spec 6.1 为「比首帧更早」准备的唯一位置。两条同一副形状：
// 受保护的读 + 不受 try 连带的写 + 白名单判据。语言这一侧的白名单只认 'en'，
// 其余值（含坏值）让模板的 `zh` 留着 —— 与 i18n.js 的 `ORDER.includes(...) ? : ORDER[0]`
// 回落同义，那侧的第 0 项就是模板默认语言。两侧一致性由 test/prefs.test.js 直接执行
// dist/index.html 里这段脚本、把结果与 normalizeTheme / i18n 的回落表对比（审查 M6）。
const antiFlash = `<script>
/* 首帧防闪烁：CSS 加载前写入偏好，否则暗色用户白闪、英文用户先看到中文。spec 6.1 */
var t='auto';try{t=localStorage.getItem('cubeyu-theme')||'auto'}catch(e){}
document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:(matchMedia('${DARK_QUERY}').matches?'dark':'light');
var l='zh';try{l=localStorage.getItem('cubeyu-lang')||'zh'}catch(e){} if(l==='en')document.documentElement.lang='en';
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
//
// modulepreload：入口 app.js 是 <script type=module> 加载的，但它 import 的 8 个模块
// 要等 app.js 下载【并解析完】才发现 —— 白多一轮往返。把这些叶子模块提前 preload，
// 浏览器就能和入口并行取。清单由文件系统算，不手写：加一个 js 文件不需要记得改模板
// （漏登记的后果是那条模块又退回一轮 RTT，看不见也测不出）。
// 入口自己不列：它已经由 <script type=module src> 取过了，再 preload 是重复声明。
const modulePreload = walkJs(join(root, 'src/js'))
  .filter((f) => basename(f) !== 'app.js')
  .map((f) => `/assets/js/${relative(join(root, 'src/js'), f).replace(/\\/g, '/')}`)
  .sort()
  .map((href) => `<link rel="modulepreload" href="${esc(href)}">`)
  .join('');

const tokens = {
  // 叶子 token（TITLE / DESCRIPTION / CANONICAL）必须过 esc()；
  // NAV / HERO / SECTIONS / FOOTER / ANTI_FLASH 是片段 token，组装处已逐字段转义，必须保持裸值，否则双重转义（见 Global Constraints）
  TITLE: esc(site.title),
  DESCRIPTION: esc(site.description),
  // CANONICAL 取 site.url：canonical 此前在模板里硬编码，与 site.url 是同一值的两个真源，现在只剩数据这一处。
  // 选 esc() 与 TITLE / DESCRIPTION 一致：它是属性值，含引号时不能截断 href="…"。
  CANONICAL: esc(site.url),
  // og:image 必须是【绝对 URL】：社交爬虫抓的是别的域，相对路径对它没有意义。
  // 基准取 site.url（与 canonical 同一个真源），不写死域名 —— 换域时只改数据层一处。
  // og:title / og:description / og:url 复用上面三个 token，不另开第二份真源。
  OG_IMAGE: esc(new URL('/og-image.png', site.url).href),
  NAV: nav,
  HERO: hero,
  SECTIONS: (() => {
    sections.forEach((s) => {
      if (!Object.hasOwn(sectionRenderers, s.id)) throw new MissingSectionRendererError(s.id);
    });
    // tab 名从 eyebrow 派生（'作品 / WORKS' → 中文态 作品、英文态 WORKS），不在 copy.js 里另开一个
    // tab 字段：两处写同一个词迟早会漂，而"区块小标"和"tab 名"必须是同一个东西。
    const tabLabel = (s) => {
      const [zh, en] = s.eyebrow.split(' / ');
      if (!en) throw new Error(`section "${s.id}" 的 eyebrow "${s.eyebrow}" 不是「中文 / ENGLISH」形状，无法派生 tab 名`);
      return i18n(zh, en);
    };
    // 产物里【没有】role=tab / aria-selected：无 JS 时这就是一排真锚点，
    // ARIA 语义由 src/js/tabs.js 在升级成 tablist 时才写上去（用户裁定的渐进增强方向）。
    // .reel 是右上角那个空心大编号，内容只有 JS 知道是第几类，所以留空。
    const tabs = `<nav class="tabs col" aria-label="内容分类"><span class="reel" aria-hidden="true"></span>`
      + sections.map((s) => `<a class="tab" href="#${esc(s.id)}">${tabLabel(s)}</a>`).join('')
      + `</nav>`;
    return tabs + sections.map((s) => `<section id="${s.id}" class="col">`
      + `<p class="eyebrow">${esc(s.eyebrow)}</p>`
      + `<h2>${i18n(s.title.zh, s.title.en)}</h2>`
      + sectionRenderers[s.id]
      + `</section>`).join('');
  })(),
  FOOTER: footerHtml,
  ANTI_FLASH: antiFlash,
  MODULE_PRELOAD: modulePreload,
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
//
// Task 13 偏离 brief 的压缩位置（必要偏离，不是风格选择）：brief 是对【合并后的整份 css】
// 调一次 transform({minify:true})。实测 minify:true 会剥掉全部注释 —— 包括上面那条
// `/* --- f --- */` 合并标记，而标记是 check.js CSS_JS_SHIPPED / STYLESHEETS_MERGED 两条
// 断言在产物上比对的契约（判据是 `css.includes('--- <rel> ---')`）。改产物去迁就压缩
// 等于削弱断言，被禁止；所以压缩按【单文件】做，标记在压缩之后逐文件补回：
// 层叠顺序仍由 cssOrder 决定，标记仍在它标注的那段压缩内容之前，两条断言的判据字节不变。
// 压缩强度不损失：lightningcss 不做跨规则的合并重排（实测合并压与分文件压的字节差异
// 只有标记行本身），var() 回退、!important、媒体查询都逐条保留 —— 回归见报告。
// Task 13 控制器裁定（审查 Important）：显式给 targets，否则移动端断点在新浏览器之外不存在。
// 不传 targets 时 lightningcss 用它内置的 browserslist 默认值（本装版本 package.json 里是
// "last 2 versions, not dead"），实测产物把 @media (max-width: 640px) 压成区间语法
// @media (width<=640px) —— 该语法要 Chrome 104+ / Safari 16.4+ / Firefox 102+，更旧的浏览器
// 整条媒体查询【解析失败被丢弃】：不报错、不进 console，手机在旧内核上直接渲染桌面布局。
// M1 验收跑在现代 Chrome，截图看不见这个洞，所以只能由产物字节层的判据兜住（见报告）。
// targets 的 API 形状按【装好的 1.33.0】核对（node/index.d.ts: targets?: Targets；
// node/targets.d.ts: { chrome?, safari?, firefox?, ... }，值是打包后的数字而非版本号字符串；
// 打包公式取 node/browserslistToTargets.js 的 parseVersion：(major<<16)|(minor<<8)|patch。
// 同文件没有直接吃 browserslist 字符串的重载 —— browserslistToTargets(browserslist: string[])
// 要求传入已展开的数组，且 browserslist 包不在 devDependencies，故用打包数字，不猜语法。
// 地板取 2021-07 ~ 2022-03 的主流版本（Chrome/Edge/Android 92、Firefox 90、Safari/iOS 15.4）：
// 比个人主页在 2026 年还要照顾的旧内核留出 4-5 年余量，且全部低于 MediaRangeSyntax 支持线。
// 它同时高于本项目 CSS 用到的其余特性线（逻辑属性 margin-inline/padding-block ≈ Chrome 87 /
// Safari 14.1，:where / :is ≈ Chrome 88 / Firefox 82 / Safari 14，:focus-visible ≈ Safari 15.4），
// 所以除媒体查询语法外不触发任何降级改写 —— 压缩行为不变，产物只回退 media 的写法（体积差见报告）。
const packTarget = (major, minor = 0, patch = 0) => (major << 16) | (minor << 8) | patch;
const cssTargets = {
  chrome: packTarget(92),
  edge: packTarget(92),
  firefox: packTarget(90),
  safari: packTarget(15, 4),
  ios_saf: packTarget(15, 4),
  android: packTarget(92),
};

const minifyCss = (filename, source) =>
  transform({ filename, code: Buffer.from(source, 'utf8'), minify: true, targets: cssTargets }).code.toString('utf8');

const css = cssOrder
  .map((f) => `/* --- ${f} --- */\n` + minifyCss(f, readFileSync(join(root, 'src/styles', f), 'utf8')))
  .join('\n');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

// ---------- 图片按内容哈希改名 ----------
// 为什么只哈希图片、不哈希 css/js：Vercel 对静态文件默认发 `max-age=0, must-revalidate`，
// 每次回访都要为 16 个文件各发一次条件请求。图片占 dist 的 72%（两张狗图集 232KB）
// 且几乎不变，是最值得上 immutable 的一档；而 app.css 与 js 模块的名字是稳定的，
// 给它们开长缓存 = 改版后用户拿到旧样式配新 HTML（旧图集文件名已经不在新部署里了）。
// 所以：图片名带哈希 → vercel.json 只对 /assets/images/* 开一年 immutable；
// css/js 保持默认再验证，一行配置都不用为它们冒险。
// 引用了这批哈希图的【只有 CSS】，所以重写点只有一处；HTML 引的那两个
// （favicon.ico / og-image.png）走下面的 src/static 通道，故意不进哈希。
const srcImages = join(root, 'src/images');
let cssOut = css;
if (existsSync(srcImages)) {
  mkdirSync(join(out, 'assets/images'), { recursive: true });
  for (const name of readdirSync(srcImages)) {
    if (name.startsWith('.')) continue;
    const bytes = readFileSync(join(srcImages, name));
    const hash = createHash('sha256').update(bytes).digest('base64url').slice(0, 10);
    const dot = name.lastIndexOf('.');
    const hashed = `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
    writeFileSync(join(out, 'assets/images', hashed), bytes);
    // split/join 而不是 replaceAll：文件名里可能带正则元字符，而这里要的是字面替换
    cssOut = cssOut.split(`/assets/images/${name}`).join(`/assets/images/${hashed}`);
  }
}

// src/static → dist 根，原样拷贝、【不哈希】。这两个名字是被外部约定锁死的：
// /favicon.ico 是浏览器不读 HTML 也会去请求的默认路径，而 og:image 的地址会被社交平台
// 按 URL 缓存 —— 名字一带哈希，抓过的预览就悬空到下次重新抓取为止，且没人通知你。
// 代价是它们拿不到 immutable，只能靠 ETag 再验证；换来的是浏览器和爬虫一定命中。
const srcStatic = join(root, 'src/static');
if (existsSync(srcStatic)) {
  for (const name of readdirSync(srcStatic)) {
    if (name.startsWith('.')) continue;
    cpSync(join(srcStatic, name), join(out, name));
  }
}

writeFileSync(join(out, 'index.html'), html, 'utf8');
// 404 复用同一份 app.css（spec 3 节：只有首页 + 一个极简 404，不另开样式入口）
writeFileSync(join(out, '404.html'), notFoundHtml, 'utf8');
writeFileSync(join(out, 'assets/app.css'), cssOut, 'utf8');
// 偏离 1：原样拷贝 ES module 树，不做拼接打包
cpSync(join(root, 'src/js'), join(out, 'assets/js'), { recursive: true });
// Task 13：压缩 dist 里的 JS 副本。src/js/** 一个字节都不动 —— build.js 顶部
// import 的是 './src/js/demos/index.js'（注册表门禁，Task 7-8 裁定），terser 只改写
// dist/assets/js/ 下的文件，两条路径互不影响；浏览器加载的与构建期读的是各自的文件。
// module: true 保留 ES module 语义（import/export 参与 tree-shaking 判定、按严格模式解析）；
// terser 不 mangle 导出名与 import 绑定名，所以跨模块的具名导出（DARK_QUERY 等）契约不变。
// 顶层 await 合法：本文件是 ESM 顶层脚本（spec 5.3 裁定不加 build() 包裹），无需函数签名改动。
for (const f of walkJs(join(out, 'assets/js'))) {
  const src = readFileSync(f, 'utf8');
  const r = await minify(src, { module: true, compress: true, mangle: true });
  writeFileSync(f, r.code, 'utf8');
}
console.log('built dist/');

// 递归收集目录下的 .js（正斜杠或反斜杠路径都直接交给 fs，不做归一 —— 归一是
// check.js 里 walk 的职责，它要把路径打进失败消息；这里只喂 writeFileSync）。
// 不复用 check.js 的 walk：跨文件耦合一份私有辅助，Task 12 动 check.js 会静默打断构建。
function walkJs(dir) {
  const outArr = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) outArr.push(...walkJs(full));
    else if (e.name.endsWith('.js')) outArr.push(full);
  }
  return outArr;
}
