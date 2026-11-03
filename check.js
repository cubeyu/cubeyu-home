// check.js —— 产物与源文件的契约断言，`npm run check` 的门禁（spec 9.1）。
//
// 分工（Task 9-10 的断言归属裁定，控制器定死）：本文件只管【契约】——
// token 残留、卡数与注册表对齐、字面色值泄漏、双语成对、产物值位无字面 undefined/null、零运行时依赖、
// demo 文件与注册表互等、样式全合并、必需片段落地、canonical 与 site.url 同源。
//
// NO_UNDEFINED_VALUES 是产物侧兜底：这件事的最终 owner 是 src/lib/build-utils.js 的 esc()
// —— 对 null/undefined 直接 throw（与本项目「静默空 <section> 当场红」同一纪律）。
// 但 build-utils.js 不在本任务授权文件内，故先记在这里、留给后续任务收编；
// 届时本断言继续留着也不碍事（构建期是第一道，产物侧是最后一道）。
// color-scheme、全站唯一焦点环、`!important` 预算、`href="#"` 预算这四类【全局预算】留在 test/
// （前两条在 test/data.test.js，后两条在 test/budgets.test.js），这里不重复：
// 同一道门禁写两处，改一处忘另一处就漂，而且两边都会绿一段时间。
//
// 只用 Node 内置模块（node:fs / node:path）+ 仓库自己的 ESM —— package.json 的 dependencies 必须为空。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { esc } from './src/lib/build-utils.js';

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// 递归列出目录里的文件，返回正斜杠相对仓库根的形态。
// Windows 的 readdirSync/join 给的是反斜杠，而失败信息要进 git diff 也要被断言匹配，
// 所以在这里一次性归一 —— 与 Task 4 说明过的同一个坑。
function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

export const TOKEN_RESIDUE = {
  name: 'no leftover template token',
  // 只匹配大写 token 约定（TITLE / HERO / SECTIONS…）。
  // 主防线是 renderTemplate 在替换那一刻就 throw；这里是防「模板被手改坏后绕过构建」的兜底。
  // 故意不用 /\{\{\w+\}\}/ —— 否则用户哪天在文案里打两个花括号就误报。
  run({ html }) {
    const m = html.match(/\{\{[A-Z][A-Z_]*\}\}/);
    return m ? [`leftover template token: ${m[0]}`] : [];
  },
};

export const CARD_COUNT = {
  // spec 9.1 第 2 项：不硬编码数量，三者对齐即可。用户会换卡。
  // 关键：data-demo 与 .card-demo 只在「该 demo 已在 demos/index.js 注册」时才输出
  // （Task 7-8 修复轮裁定，为了 M2 不给未实现的 demo 留空壳）。所以期望值必须按
  // 注册态算，不能按声明态算 —— 按声明算的话 M2 到 M3 之间必然失败（声明全部、注册 0）。
  // registry 有默认值：调用点忘传时退化成「不期望任何 demo 容器」，而不是在
  // registry.includes 上抛 TypeError 把 npm run check 整个跑崩。
  name: 'card count matches data',
  run({ html, cards, registry = [] }) {
    const f = [];
    const inHtml = (html.match(/<article class="card"/g) || []).length;
    if (inHtml !== cards.length) f.push(`cards: data=${cards.length} html=${inHtml}`);
    const slugged = (html.match(/data-slug="/g) || []).length;
    if (slugged !== cards.length) f.push(`data-slug: data=${cards.length} html=${slugged}`);
    const wantDemo = cards.filter((c) => c.demo && registry.includes(c.demo)).length;
    const haveDemo = (html.match(/ data-demo="/g) || []).length;
    if (haveDemo !== wantDemo) f.push(`data-demo: expected=${wantDemo} (registered) found=${haveDemo}`);
    const wantRoots = cards.filter((c) => c.demo && registry.includes(c.demo)).length;
    const haveRoots = (html.match(/data-demo-root="/g) || []).length;
    if (haveRoots !== wantRoots) f.push(`data-demo-root: expected=${wantRoots} found=${haveRoots}`);
    return f;
  },
};

// 双语成对的【文档顺序】判据，不是两个总数相比，也不再假装是邻接判据（修复轮 I-3 裁定）。
// 旧版注释声称「zh 必须紧贴它的 en」，但正则里的 [\s\S]*? 根本不是邻接约束：
// · `zh <span class="tag">x</span> en` 会靠回溯吞掉中间那个 </span> 拼成一对 —— 假绿；
// · `zh</span><em>·</em><span …en` 这种被非 span 内容隔开的合法写法反倒配不上 —— 假红。
// 两条保证不可兼得时只保一个诚实的：这里改为扫描 `class="i18n i18n-(zh|en)"` 的出现序列，
// 要求【文档序严格 zh,en 交替】且两侧总数相等 —— 配对之间夹什么 markup 都不管，
// 顺序坏了（zh zh en en / en 抢先 / 单侧漏文案）必抓；en 抢先那一支还被顺带 subsume 了。
export const LANG_PAIR = {
  name: 'every i18n slot has both languages',
  // 为什么这一版不会在「单侧漏文案」上放行（控制器裁定 5 的语义不变，实现换判据）：
  // · 只写了 zh 没写 en：zh != en，报。只写了 en 没写 zh：同上，报。
  // · 两侧总数相等但顺序坏了（zh zh en en）：文档序第 2 槽是 zh（期望 en），交替在第二槽断，报
  //   —— 这正是「只比两个总数」会放行的一种（数字完全对称，画面是错的）。
  // · en 在前 zh 在后（发射器参数写反）：第 1 槽就断，报 —— 旧版靠「zh 紧邻 en」的正则形状抓它，
  //   新版靠交替判据抓它，不再依赖跨度写法。
  // 已知盲区（不在这里补，交给 test/data.test.js 的 hasBoth 逐字段扫数据层）：
  // 整对一起删掉时序列仍严格交替、两侧仍相等 —— 那是「少一个槽位」不是「少一侧文案」，
  // 配对检查在产物面上无法与「这段本来就没有双语」区分，所以由数据层那一侧守。
  run({ html }) {
    const seq = [...html.matchAll(/class="i18n i18n-(zh|en)"/g)].map((m) => m[1]);
    const zh = seq.filter((x) => x === 'zh').length;
    const en = seq.length - zh;
    const bad = seq.findIndex((lang, i) => lang !== (i % 2 === 0 ? 'zh' : 'en'));
    if (zh === en && bad === -1) return [];
    return [`i18n unpaired: zh=${zh} en=${en}`
      + (bad === -1 ? '' : `，文档序第 ${bad + 1} 个槽位是 ${seq[bad]}（期望 ${bad % 2 === 0 ? 'zh' : 'en'}）`)
      + ' —— 按文档顺序每个 zh 槽位必须由它的 en 紧随其后（严格 zh,en 交替）'];
  },
};

// 只扫【值位】：属性整值恰好是 undefined/null，或元素的整段文本只有这一个词。
// 故意不做全文档 substring 扫 —— 「undefined」是合法文案里可能出现的词（引文、技术名词），
// 值位判据要误报除非真给什么东西起名叫 "undefined"。
const UNDEFINED_VALUE = /\b(?:href|src|content|alt|aria-label|aria-describedby|title|data-[a-z-]+)="(?:undefined|null)"|>\s*(?:undefined|null)\s*</g;

export const NO_UNDEFINED_VALUES = {
  name: 'no literal undefined/null in artifact value positions',
  // 可达路径（修复轮 I-2，评审实测）：site.description、site.nav.githubText / githubUrl
  // 都没有数据层守卫（只有 site.title 有）。删掉任何一个，esc(undefined) 会把字符串
  // "undefined" 静默烘进产物：<meta name="description" content="undefined"> 或导航里的
  // >undefined<，而 LANG_PAIR / FRAGMENTS_PRESENT / TOKEN_RESIDUE / CANONICAL 全都不响。
  // 最终 owner 应是 esc() 对 null/undefined 直接 throw（见文件头注），这条是产物侧兜底。
  run({ html }) {
    const hits = html.match(UNDEFINED_VALUE) || [];
    return hits.length
      ? [`产物值位出现字面 undefined/null：${[...new Set(hits)].slice(0, 3).join(' | ')}`
        + ' —— 数据层某字段被删了或传参漏了（esc(undefined) 会把缺值烘成字符串 "undefined"）']
      : [];
  },
};

export const DEMO_REGISTRY_MATCH = {
  name: 'demo names, registry and files all agree',
  // 三条规则按【阶段语义】拆开（控制器裁定，Task 11 之后 M2 的真实状态就是「有声明、没注册」）：
  //
  // 1) 已声明 + 已注册 + 有文件 → 健康，今天 inkmark 就是这个形态。
  // 2) 已声明 + 未注册 + 无文件，且 demo === 卡片 slug → 【不算失败】。
  //    这是 spec 要求的纸面卡降级：build.js 按注册态门禁不给未实现的 demo 留空壳，
  //    app.js 查不到注册就静默跳过（Task 11 实测过这两条）。
  //    把这一支当 error 的后果：npm run check 从 M2 到 M3 永久红，而永久红的门禁会被
  //    下一个接手的人「修好」—— 他删掉 projects.js 里的 demo 字段就绿了，
  //    于是 M3 的实现意图被永久删除，而渲染器和测试全程无感。
  // 3) 已声明 + 未注册 + 无文件，且 demo !== 卡片 slug → 【算失败】，这就是拼写错误那一支。
  //    能区分 2) 和 3) 的唯一依据是本仓库的命名约定（src/js/demos/index.js 头注）：
  //    「注册名 === 文件名 === projects.js 的 demo 字段」，而每张卡的 demo 都取自自己的 slug。
  //    所以一个既不在注册表、也没有同名文件、还和卡片 slug 不同名的名字，不可能是「待建的 demo」，
  //    只能是想写某个 demo 却写错了。代价：将来若真要给某张卡挂一个与 slug 不同名的 demo，
  //    先在 demos/index.js 注册（或建文件），这条就不会响。
  // 4) 注册了但磁盘无文件 / 磁盘有文件但未注册 → 【算失败】（M3 的半成品，两种形态都响）。
  // 收紧条件：M3 把声明的 demo 全部注册完之后，「已声明但未注册」这一支不再有任何合法来源，
  // 届时可以把 2) 也升级成 error —— 那时才是「拼写错误与待建 demo 无法混淆」的状态。
  run({ cards, registry, demoFiles }) {
    const f = [];
    for (const c of cards) {
      if (!c.demo) continue;
      if (registry.includes(c.demo) || demoFiles.includes(c.demo)) continue;
      if (c.demo !== c.slug) {
        f.push(`${c.slug}: demo '${c.demo}' 既没在 demos/index.js 注册，也没有 src/js/demos/${c.demo}.js，`
          + `且与卡片 slug '${c.slug}' 不同名 —— 按命名约定（注册名 === 文件名 === demo 字段）这更像拼写错误，不是待实现的微原型`);
      }
    }
    for (const name of registry) if (!demoFiles.includes(name)) f.push(`registry '${name}' has no file demos/${name}.js`);
    for (const file of demoFiles) {
      if (!registry.includes(file)) f.push(`orphan file demos/${file}.js（未注册）—— 卡片拿不到它，会静默降级成纸面卡`);
    }
    return f;
  },
};

export const COLOR_LEAK = {
  // spec 9.1 第 4 项：扫源文件而非合并产物，否则定位不出违规来源
  // 必须先剥注释：注释里写 "对应 #FFE28A" 或 "dark 用 rgba(255,255,255,.14)" 是文档，
  // 不是声明。不剥就会逼实现者把解释性注释删掉或改写，那是反向激励。
  name: 'no literal colors outside tokens.css',
  run({ files }) {
    const f = [];
    for (const { name, text } of files) {
      if (name.endsWith('tokens.css')) continue;
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '');
      const hits = code.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [];
      if (hits.length) f.push(`${name}: literal color(s) ${hits.slice(0, 3).join(', ')} — use var(--…)`);
    }
    return f;
  },
};

export const DEPENDENCIES_EMPTY = {
  name: 'zero runtime dependencies',
  run({ pkg }) {
    try {
      const deps = Object.keys(JSON.parse(pkg).dependencies || {});
      return deps.length ? [`runtime deps present: ${deps.join(', ')}`] : [];
    } catch { return ['package.json is not valid JSON']; }
  },
};

// 合并标记由 build.js 写入：`/* --- <cssOrder 里的路径> --- */`。
// 判据只认这个标记，不认「css 里含不含这段字节」—— 组件样式里可能正好有一行和 demo 样式
// 同值的声明，那种巧合会把「忘了登记 cssOrder」放过去。
const MERGED = (css, rel) => css.includes(`--- ${rel} ---`);

export const CSS_JS_SHIPPED = {
  name: 'every demo css merged into app.css',
  run({ css, demoFiles }) {
    // 合并时每个文件前面写了 `/* --- demos/<name>.css --- */` 标记（build.js）
    return demoFiles
      .filter((name) => !MERGED(css, `demos/${name}.css`))
      .map((name) => `demos/${name}.css not merged into app.css — register it in cssOrder`);
  },
};

export const STYLESHEETS_MERGED = {
  name: 'every source stylesheet is merged into app.css',
  // CSS_JS_SHIPPED 只看 demo 样式；这一项把同一条判据推广到 src/styles/**.css 全体。
  // 必要性：build.js 是 `cssOrder.map(...)`，磁盘上多一个文件而 cssOrder 里没有它时，
  // 构建成功、产物少一层，没有任何东西会响 —— 新加一个样式文件的人不知道 cssOrder 存在。
  // styleFiles 传的是相对 src/styles/ 的正斜杠路径，与 cssOrder 的取值同形。
  run({ css, styleFiles }) {
    return styleFiles
      .filter((rel) => !MERGED(css, rel))
      .map((rel) => `src/styles/${rel} 没进 dist/assets/app.css —— 去 src/lib/build-utils.js 的 cssOrder 里登记（顺序即层叠顺序）`);
  },
};

export const FRAGMENTS_PRESENT = {
  name: 'every required fragment lands in the html',
  // renderTemplate 的两个方向不对称：模板要一个表里没有的 token 会 throw（构建当场红），
  // 但表里给了一个 token 而模板没有它 —— 静默丢弃。真实事故：把 {{FOOTER}} 从模板删掉，
  // 构建绿灯、当时每条测试都绿灯，产物没有页脚。
  // 所以这里做正向检查：四个片段 token 各自的根元素必须在产物里出现。
  // 判据取「元素标签存在」而不是「class 串逐字相等」：class 是 build.js 里拼的，
  // 改一个类名不该让门禁变红，而片段没了就是真没了。
  // ANTI_FLASH 不列在这里 —— 它在 test/data.test.js 里已被逐字断言（内联守卫只许一段 + 语言回落那行）。
  run({ html }) {
    // 先剥 HTML 注释再查（修复轮 M-7）：元素名出现在注释里不算「落地」。
    // 否则一个陈旧的 <!-- <footer> --> 留档就能把「{{FOOTER}} 真的没了」掩掉 —— 探测返回 []。
    const live = html.replace(/<!--[\s\S]*?-->/g, '');
    const required = [
      ['NAV', /<nav\b/],
      ['HERO', /<header\b/],
      ['SECTIONS', /<section\b/],
      ['FOOTER', /<footer\b/],
    ];
    return required
      .filter(([name, re]) => !re.test(live))
      .map(([name]) => `产物里没有 {{${name}}} 片段渲染出来的根元素 —— 模板漏了这个 token，`
        + '或 build.js 的对应 renderer 被删了（renderTemplate 对「多给的 token」是静默的）');
  },
};

export const CANONICAL_MATCHES_SITE = {
  name: "canonical in the artifact equals site.url",
  // site.url 自 Task 7-8 起才是 canonical 的唯一真源（build.js 的 CANONICAL 从它取并过 esc()）。
  // 在那之前模板里硬编码了一份，两处各漂一次 —— 这是修过的第二次真源回归，所以钉成机器断言：
  // 产物 href 必须逐字等于 esc(site.url)。比 esc() 后的值而不是原值，是因为属性位按同一条纪律转义过，
  // 数据里含 & 时两侧才能对上（同测试里的 escapes 那条用例）。
  run({ html, url }) {
    const m = /<link rel="canonical" href="([^"]*)">/.exec(html);
    if (!m) return ['产物里找不到 <link rel="canonical" href="…"> —— 模板那一行没了'];
    const want = esc(url);
    return m[1] === want ? [] : [`canonical 与 src/data/site.js 的 site.url 不一致：产物 ${m[1]}，数据 ${want}`];
  },
};

// preload 清单由 build.js 从文件系统算出来（不是手写进模板的），所以它可能出两种偏差：
// ① 某个模块被 import 但没被 preload —— 那一轮 RTT 又回来了，而页面看起来一样快；
// ② 某个模块被 preload 但没人 import —— 白下载，通常是 src/js 里留了个死文件。
// 两种都不会报错、都不会被别的断言抓到，所以按真实 import 图对账。
export const MODULE_PRELOAD_COVERS_GRAPH = {
  name: 'modulepreload matches the real import graph',
  run({ html, jsModules }) {
    const entry = '/assets/js/app.js';
    if (!(entry in jsModules)) return [`产物里找不到 ${entry} —— 模板的 <script type=module> 或构建的 js 拷贝坏了`];
    const pre = new Set([...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]));
    const seen = new Set();
    const stack = [entry];
    while (stack.length) {
      const href = stack.pop();
      if (seen.has(href)) continue;
      const src = jsModules[href];
      if (src === undefined) return [`import 指向 ${href}，产物里没有这个文件`];
      seen.add(href);
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](.[^"']*)["']/g)) {
        stack.push('/' + posix.normalize(posix.join(posix.dirname(href.slice(1)), m[1])));
      }
    }
    const missing = [...seen].filter((h) => h.endsWith('.js') && h !== entry && !pre.has(h));
    const extra = [...pre].filter((h) => !seen.has(h));
    const fails = [];
    if (missing.length) fails.push(`这些模块被 import 但没有 modulepreload，入口解析完才发现它们：${missing.join(', ')}`);
    if (extra.length) fails.push(`这些模块被 preload 但入口的 import 图里没有：${extra.join(', ')}（白下载；多半是 src/js 里的死文件）`);
    return fails;
  },
};

// 全部断言。加一项就往这里加一条 —— 这是唯一的清单（修复轮 M-2）：
// check() 直接 map 它，CLI 报的条数由数组长度算出来，不写死。
// 以前这里和 check() 里的手写 run 列表是两条平行清单，能各漂一次，
// 而漂了的那次是 CLI 报数在撒谎 —— 正是本任务要消灭的失败类型。
export const ASSERTIONS = [
  TOKEN_RESIDUE,
  CARD_COUNT,
  DEMO_REGISTRY_MATCH,
  COLOR_LEAK,
  LANG_PAIR,
  NO_UNDEFINED_VALUES,
  DEPENDENCIES_EMPTY,
  CSS_JS_SHIPPED,
  STYLESHEETS_MERGED,
  FRAGMENTS_PRESENT,
  CANONICAL_MATCHES_SITE,
  MODULE_PRELOAD_COVERS_GRAPH,
];

export async function check() {
  const html = read('dist/index.html');
  const css = read('dist/assets/app.css');
  const pkg = read('package.json');
  if (!html) return { ok: false, failures: ['dist/index.html missing — run npm run build first'] };

  const { projects } = await import('./src/data/projects.js');
  const { site } = await import('./src/data/site.js');
  const demos = (await import('./src/js/demos/index.js')).default;

  const demoFiles = existsSync('src/js/demos')
    ? readdirSync('src/js/demos').filter((x) => x.endsWith('.js') && x !== 'index.js').map((x) => x.replace(/\.js$/, ''))
    : [];
  const registry = Object.keys(demos);
  // 样式契约只看 .css（修复轮 I-1）：walk 给的是目录里的一切文件，而说明文档
  // （NOTES.md / README.md 之类）挨着样式放是常态 —— 不过滤的话 STYLESHEETS_MERGED 会让
  // 那个 markdown 去 cssOrder 登记（失败消息原话如此，照做就把非 CSS 塞进了层叠），
  // COLOR_LEAK 还会把文档里引述的 rgba(…) 当字面色值报。两条消费者共用这一处清单，
  // 所以过滤放在清单建好的地方。
  const styleFiles = walk('src/styles').filter((p) => p.endsWith('.css')).map((name) => ({ name, text: read(name) }));
  // 与 cssOrder / STYLESHEETS_MERGED 同形的相对路径（去掉 src/styles/ 前缀），
  // 否则两条断言的判据字符串会因分隔符或前缀不同而各漂一次。
  const styleRels = styleFiles.map(({ name }) => name.replace(/^src\/styles\//, ''));

  // 断言只跑一遍：输入组好一份上下文交给 ASSERTIONS，运行清单由清单本身派生（修复轮 M-2）。
  // 每条断言的 run 只从 ctx 里解构自己需要的键；加断言只改 ASSERTIONS 一处，
  // CLI 报的条数（ASSERTIONS.length）不可能再和实际跑的对不上。
  const ctx = {
    html,
    css,
    pkg,
    cards: projects,
    registry,
    demoFiles,
    files: styleFiles,
    styleFiles: styleRels,
    url: site.url,
    // href -> 源码文本。键就是浏览器看到的路径，断言不必再自己拼前缀。
    jsModules: Object.fromEntries(walk('dist/assets/js').map((p) => ['/' + p.replace(/^dist\//, ''), read(p)])),
  };
  const failures = ASSERTIONS.map((a) => a.run(ctx)).flat();

  return { ok: failures.length === 0, failures };
}

// CLI 守卫：argv[1] 归一成正斜杠后必须是「根上的 check.js」——
// 只 endsWith('check.js') 会连 mycheck.js 也算数，所以要求前面是路径分隔符或整串就是它。
// 不做绝对路径相等比较（Task 4 说明过的同一个 Windows 坑）。
const invoked = process.argv[1]?.replace(/\\/g, '/');
if (invoked === 'check.js' || invoked?.endsWith('/check.js')) {
  const r = await check();
  if (r.ok) { console.log(`check passed (${ASSERTIONS.length} assertions)`); process.exit(0); }
  for (const f of r.failures) console.error('FAIL  ' + f);
  process.exit(1);
}
