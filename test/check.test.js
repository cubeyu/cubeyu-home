// test/check.test.js —— Task 12：产物与源文件契约的断言。
// 每条断言都必须有「坏数据被抓到」与「好数据不误报」两个方向 —— 只有后者的话，
// 断言可能压根没在跑（正则永不匹配、文件名拼错、传参漏字段），等于没测。
// 分工（Task 9-10 的断言归属裁定）：本文件与 check.js 只管产物/源文件契约
// （token 残留、数量与注册表对齐、字面色值、双语成对、产物值位无字面 undefined/null、零运行时依赖、
// demo 文件与注册表互等、样式全合并、必需片段落地、canonical 与 site.url 同源）。
// color-scheme、全站唯一焦点环、!important 预算、href="#" 预算这四类「全局预算」在 test/ 里
// （前两条在 data.test.js，后两条在 budgets.test.js），这里不重复 —— 同一道门禁写两处必然漂移。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  check,
  ASSERTIONS,
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
} from '../check.js';

// 唯一的「当前树全绿」用例。未构建时跳过而不是失败：npm test 必须能脱离 npm run build 单独跑通
// （Task 1 Step 4 就是一次纯 npm test），产物不存在看起来像代码有 bug，实际只是没构建。
test('current tree passes all checks', async () => {
  if (!existsSync('dist/index.html')) return undefined;
  const r = await check();
  assert.deepEqual(r.failures, [], `unexpected failures: ${r.failures.join(' | ')}`);
  assert.equal(r.ok, true);
});

// ── 1. TOKEN_RESIDUE ──────────────────────────────────────────────
test('TOKEN_RESIDUE catches a leftover token', () => {
  assert.equal(TOKEN_RESIDUE.run({ html: '<p>{{TITLE}}</p>', files: [], pkg: '{}' }).length, 1);
  assert.equal(TOKEN_RESIDUE.run({ html: '<p>ok</p>', files: [], pkg: '{}' }).length, 0);
});

// 只匹配大写 token 约定（TITLE / HERO / SECTIONS…），故意不用 /\{\{\w+\}\}/：
// 用户哪天在文案里打两个小写花括号就误报，而文案是用户可改的内容层。
test('TOKEN_RESIDUE ignores lowercase braces in copy', () => {
  assert.equal(TOKEN_RESIDUE.run({ html: '<p>{{lower}}</p>' }).length, 0);
  assert.match(TOKEN_RESIDUE.run({ html: '<p>{{FOOTER}}</p>' })[0], /FOOTER/);
});

// ── 2. CARD_COUNT ─────────────────────────────────────────────────
test('CARD_COUNT does not hardcode 7 and catches a mismatch', () => {
  const html = '<article class="card" data-slug="a"></article><article class="card" data-slug="b"></article>';
  assert.equal(CARD_COUNT.run({ html, cards: [{ slug: 'a' }, { slug: 'b' }] }).length, 0);
  // 计划在这里写的期望是 1，但它自己的 CARD_COUNT 有两个独立计数器（<article> 数与 data-slug 数），
  // 数据少一张卡时两个数同时掉，真实输出是 2 条。判据方向没变（数据比产物多必须红），
  // 这里把条数改成实际值并顺手钉住第一条的内容，免得将来只剩一个计数器时这条用例悄悄失去意义。
  const r = CARD_COUNT.run({ html, cards: [{ slug: 'a' }] });
  assert.equal(r.length, 2, 'must fail when data has more cards than html');
  assert.match(r[0], /cards: data=1 html=2/);
  assert.match(r[1], /data-slug: data=1 html=2/);
});

test('CARD_COUNT allows demo:null cards', () => {
  const html = '<article class="card" data-slug="a"></article>';
  const r = CARD_COUNT.run({ html, cards: [{ slug: 'a', demo: null }] });
  assert.equal(r.length, 0);
});

// demo 容器按【注册态】数，不按声明态数（Task 7-8 裁定）：
// build.js 只在名字已注册时输出 data-demo / data-demo-root，所以声明了但没注册的卡不该被期望。
test('CARD_COUNT expects demo containers only for registered demos', () => {
  const html = '<article class="card" data-slug="a"></article>';
  const cards = [{ slug: 'a', demo: 'a' }];
  assert.equal(CARD_COUNT.run({ html, cards, registry: [] }).length, 0, 'declared but unregistered = 纸面卡，不留空壳');
  assert.equal(CARD_COUNT.run({ html, cards, registry: ['a'] }).length, 2, '注册了却没容器 = 挂载点丢了');
});

test('CARD_COUNT catches a demo container that data does not declare', () => {
  const html = '<article class="card" data-slug="a" data-demo="a" data-demo-root="a"></article>';
  const r = CARD_COUNT.run({ html, cards: [{ slug: 'a', demo: null }], registry: [] });
  assert.equal(r.length, 2, `期望只报 demo 与 demo-root 两条，实际：${r.join(' | ')}`);
});

// ── 3. DEMO_REGISTRY_MATCH ────────────────────────────────────────
test('DEMO_REGISTRY_MATCH catches unregistered and orphan demos', () => {
  const cards = [{ slug: 'a', demo: 'a' }, { slug: 'b', demo: 'ghost' }];
  const bad = DEMO_REGISTRY_MATCH.run({ cards, registry: ['a'], demoFiles: ['a'] });
  assert.ok(bad.some((f) => f.includes('ghost')));
  const orphan = DEMO_REGISTRY_MATCH.run({ cards: [{ slug: 'a', demo: 'a' }], registry: ['a'], demoFiles: ['a', 'unused'] });
  assert.ok(orphan.some((f) => f.includes('unused')));
});

// 阶段语义（控制器裁定，Task 11 之后 M2 的真实状态）：六张卡声明的 demo 要到 M3 才注册。
// 把「已声明但未注册」当 error 会让 npm run check 永久红，而红门禁训练出来的动作是
// 把 projects.js 的 demo 字段删掉「修好」它 —— 那会永久删掉 M3 的实现意图，
// 而渲染器照样工作（纸面卡降级正是 spec 要求的形态）。所以这一支必须 PASS。
test('DEMO_REGISTRY_MATCH passes the M3-pending paper-card degradation', () => {
  const cards = [
    { slug: 'inkmark', demo: 'inkmark' },
    { slug: 'weflow', demo: 'weflow' },
    { slug: 'cloud-hidden', demo: 'cloud-hidden' },
  ];
  assert.deepEqual(DEMO_REGISTRY_MATCH.run({ cards, registry: ['inkmark'], demoFiles: ['inkmark'] }), []);
});

// 反向也要成立：降级态不是「不检查」。同名换成别的名字（typo）仍然抓，
// 判据是本仓库的命名约定「注册名 === 文件名 === demo 字段 === 卡片 slug」（见 check.js 注释）。
test('DEMO_REGISTRY_MATCH still catches a typo that matches no file at all', () => {
  const r = DEMO_REGISTRY_MATCH.run({ cards: [{ slug: 'inkmark', demo: 'inkmarkk' }], registry: ['inkmark'], demoFiles: ['inkmark'] });
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('inkmarkk'));
});

test('DEMO_REGISTRY_MATCH flags a file on disk that was never registered', () => {
  const r = DEMO_REGISTRY_MATCH.run({ cards: [{ slug: 'a', demo: 'a' }], registry: [], demoFiles: ['a'] });
  assert.equal(r.length, 1, `期望一条 orphan file，实际：${r.join(' | ')}`);
  assert.ok(r[0].includes('demos/a.js'));
});

test('DEMO_REGISTRY_MATCH flags a registry entry whose file is gone', () => {
  const r = DEMO_REGISTRY_MATCH.run({ cards: [], registry: ['gone'], demoFiles: [] });
  assert.equal(r.length, 1, `期望一条 registry 无文件，实际：${r.join(' | ')}`);
  assert.ok(r[0].includes('gone'));
});

// ── 4. COLOR_LEAK ─────────────────────────────────────────────────
test('COLOR_LEAK ignores tokens.css and flags source styles', () => {
  const files = [{ name: 'src/styles/tokens.css', text: '--ink: #1A1A1A;' }, { name: 'src/styles/base.css', text: 'color: #FF0000;' }];
  const r = COLOR_LEAK.run({ files });
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('base.css'));
});

test('COLOR_LEAK tolerates currentColor and transparent', () => {
  const files = [{ name: 'src/styles/base.css', text: 'border-color: transparent; color: currentColor;' }];
  assert.equal(COLOR_LEAK.run({ files }).length, 0);
});

// 必须先剥注释：注释里写「对应 #FFE28A」「暗色用 rgba(255,255,255,.14)」是文档不是声明。
// 不剥就会逼实现者删掉解释性注释来让检查变绿 —— 反向激励（Task 7-8 裁定）。
test('COLOR_LEAK ignores color values inside comments', () => {
  const files = [{ name: 'src/styles/hero.css', text: '/* 暗色下 --mark-bg 是 rgba(255,226,138,.24)，对应 #FFE28A */\nbackground: var(--mark-bg);\n' }];
  assert.equal(COLOR_LEAK.run({ files }).length, 0);
});

test('COLOR_LEAK reports the offending file, not the merged artifact', () => {
  const files = [
    { name: 'src/styles/base.css', text: 'color: #FF0000;' },
    { name: 'src/styles/cards.css', text: 'border: 1px solid rgba(0,0,0,.2);' },
  ];
  const r = COLOR_LEAK.run({ files });
  assert.equal(r.length, 2, '每个违规文件各一条，否则定位不出来源');
  assert.ok(r.some((f) => f.includes('base.css')) && r.some((f) => f.includes('cards.css')));
});

// ── 5. LANG_PAIR ──────────────────────────────────────────────────
test('LANG_PAIR catches a one-sided translation', () => {
  const html = '<span class="i18n i18n-zh">只有中文</span>';
  assert.equal(LANG_PAIR.run({ html }).length, 1);
});

test('LANG_PAIR accepts a well-formed pair', () => {
  const html = '<span class="i18n i18n-zh">甲</span><span class="i18n i18n-en">A</span>';
  assert.equal(LANG_PAIR.run({ html }).length, 0);
});

// 两侧总数相等 ≠ 成对。只比两个总数时，「zh zh en en」这种顺序坏了的发射是合法数字，
// 而 CSS 的 :lang() 显隐会把英文态画成「两行中文叠一行英文」—— 数对得上，画面是错的。
test('LANG_PAIR catches equal totals with broken pairing', () => {
  const html = '<span class="i18n i18n-zh">a</span><span class="i18n i18n-zh">b</span>'
    + '<span class="i18n i18n-en">b</span><span class="i18n i18n-en">a</span>';
  assert.equal(LANG_PAIR.run({ html }).length, 1, 'zh 与 en 各 2，但没有任何一个 zh 紧贴自己的 en');
});

test('LANG_PAIR catches an en-first slot', () => {
  const html = '<span class="i18n i18n-en">A</span><span class="i18n i18n-zh">甲</span>';
  assert.equal(LANG_PAIR.run({ html }).length, 1);
});

// I-3（修复轮裁定）：旧版注释声称「zh 紧贴 en」，但 [\s\S]*? 不是邻接约束 ——
// `zh <span class="tag">x</span> en` 会靠回溯吞掉中间的 </span> 拼成一对（假绿），
// 被非 span 内容隔开的合法对反而报红（假红）。两条不可兼得，只保一个诚实的保证：
// 【文档序严格 zh,en 交替】。配对之间夹什么 markup 都不管，顺序坏了必抓。
test('LANG_PAIR judges by document order, not markup adjacency', () => {
  const separated = '<span class="i18n i18n-zh">甲</span><em>·</em><span class="i18n i18n-en">A</span>';
  assert.deepEqual(LANG_PAIR.run({ html: separated }), [], '被非 span 内容隔开的合法对不再是假红');
  const nested = '<span class="i18n i18n-zh">甲<span class="tag">x</span></span><span class="i18n i18n-en">A</span>';
  assert.deepEqual(LANG_PAIR.run({ html: nested }), [], '交替判据不关心配对内部长什么样');
});

// 保住的保证的另一半：错位必须抓，哪怕隔着任意 markup —— 判据只看 i18n 出现序列。
test('LANG_PAIR catches order breakage across arbitrary markup', () => {
  const bad = '<span class="i18n i18n-zh">甲</span><p>填</p>'
    + '<span class="i18n i18n-zh">乙</span><span class="i18n i18n-en">B</span>'
    + '<span class="i18n i18n-en">A</span>';
  const r = LANG_PAIR.run({ html: bad });
  assert.equal(r.length, 1);
  assert.match(r[0], /zh=2 en=2/);
  assert.match(r[0], /第 2 个槽位是 zh（期望 en）/, '断点要指到具体槽位，否则读者只能自己数');
});

// ── 5b. NO_UNDEFINED_VALUES（修复轮 I-2）───────────────────────────
// esc(undefined) 把缺文案静默烘成字符串 "undefined"：site.description / nav.githubText 等
// 无守卫字段删掉任何一个，四条老断言全绿而产物已带伤。只扫【值位】：
// 属性整值恰为 undefined/null，或元素整段文本只有这一个词 —— 不做全文档 substring 扫，
// 「undefined」是合法文案里可能出现的词。
test('NO_UNDEFINED_VALUES catches a missing site.description baked into the meta', () => {
  const r = NO_UNDEFINED_VALUES.run({ html: '<meta name="description" content="undefined">' });
  assert.equal(r.length, 1);
  assert.match(r[0], /content="undefined"/);
});

test('NO_UNDEFINED_VALUES catches the words as an element\'s whole text', () => {
  const html = '<a href="/x"><span class="nav-text">undefined</span></a><p>null</p>';
  const r = NO_UNDEFINED_VALUES.run({ html });
  assert.equal(r.length, 1, '一条消息，命中值去重后一起报');
  assert.match(r[0], />undefined</);
  assert.match(r[0], />null</);
});

test('NO_UNDEFINED_VALUES catches a null href but not multi-word attribute values', () => {
  assert.equal(NO_UNDEFINED_VALUES.run({ html: '<a href="null">x</a>' }).length, 1);
  assert.equal(NO_UNDEFINED_VALUES.run({ html: '<a title="why undefined matters">x</a>' }).length, 0);
});

test('NO_UNDEFINED_VALUES ignores the words inside prose', () => {
  const html = '<p>这段讲 undefined behavior 的引文合法</p><code>arr.length !== undefined</code>';
  assert.deepEqual(NO_UNDEFINED_VALUES.run({ html }), []);
});

// ── 6. DEPENDENCIES_EMPTY ─────────────────────────────────────────
test('DEPENDENCIES_EMPTY flags a runtime dep', () => {
  assert.equal(DEPENDENCIES_EMPTY.run({ pkg: '{"dependencies":{"vue":"^3"}}' }).length, 1);
  assert.equal(DEPENDENCIES_EMPTY.run({ pkg: '{"dependencies":{}}' }).length, 0);
});

test('DEPENDENCIES_EMPTY flags a package.json that is not JSON', () => {
  assert.equal(DEPENDENCIES_EMPTY.run({ pkg: 'not json' }).length, 1);
});

// ── 7. CSS_JS_SHIPPED ─────────────────────────────────────────────
test('CSS_JS_SHIPPED flags a demo css missing from the merge', () => {
  const r = CSS_JS_SHIPPED.run({ css: '/* --- demos/inkmark.css --- */ .a{}', demoFiles: ['inkmark', 'weflow'] });
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('weflow'));
});

test('CSS_JS_SHIPPED passes when every demo css carries its merge marker', () => {
  const css = '/* --- demos/inkmark.css --- */ .a{}';
  assert.equal(CSS_JS_SHIPPED.run({ css, demoFiles: ['inkmark'] }).length, 0);
});

// ── 8. STYLESHEETS_MERGED ─────────────────────────────────────────
// 第 7 项只管 demo 样式；这一项管全部源样式：build.js 按 cssOrder 迭代，
// 新增 src/styles/*.css 却忘了登记就会被静默丢掉，构建绿灯、产物少一层。
test('STYLESHEETS_MERGED flags a source stylesheet missing from cssOrder', () => {
  const css = '/* --- tokens.css --- */\n/* --- base.css --- */';
  const r = STYLESHEETS_MERGED.run({ css, styleFiles: ['tokens.css', 'base.css', 'demos/inkmark.css'] });
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('demos/inkmark.css'));
});

test('STYLESHEETS_MERGED passes when every source sheet is registered', () => {
  const styleFiles = ['tokens.css', 'base.css', 'demos/inkmark.css'];
  const css = styleFiles.map((f) => `/* --- ${f} --- */`).join('\n');
  assert.deepEqual(STYLESHEETS_MERGED.run({ css, styleFiles }), []);
});

// ── 9. FRAGMENTS_PRESENT ──────────────────────────────────────────
// renderTemplate 对「模板要了表里没有的 token」会 throw，但对「表里有、模板没要」是沉默的
// —— 把 {{FOOTER}} 从模板里删掉，构建和当时所有测试都还是绿的，产物少一个页脚。
test('FRAGMENTS_PRESENT catches a dropped fragment placeholder', () => {
  const html = '<nav class="col nav"></nav><header class="hero"></header><section id="works"></section>';
  const r = FRAGMENTS_PRESENT.run({ html });
  assert.equal(r.length, 1, `期望只报 FOOTER，实际：${r.join(' | ')}`);
  assert.ok(r[0].includes('FOOTER'));
});

test('FRAGMENTS_PRESENT passes on a full page', () => {
  const html = '<nav class="col nav"></nav><header class="hero"></header><section id="works"></section><footer class="col foot"></footer>';
  assert.deepEqual(FRAGMENTS_PRESENT.run({ html }), []);
});

// M-7（修复轮）：旧版在整份 html 上匹配元素名，注释里的 <!-- <footer> --> 留档
// 能把「{{FOOTER}} 真的没了」掩掉 —— 探测返回 []，正好放过本断言存在的理由那种事故。
test('FRAGMENTS_PRESENT is not fooled by fragment roots parked inside comments', () => {
  const html = '<nav></nav><header></header><section></section><!-- 旧页脚留档：<footer class="col foot"></footer> -->';
  const r = FRAGMENTS_PRESENT.run({ html });
  assert.equal(r.length, 1, '注释里的 <footer> 不算落地');
  assert.ok(r[0].includes('FOOTER'));
});

// ── 10. CANONICAL_MATCHES_SITE ────────────────────────────────────
// site.url 自 Task 7-8 起是 canonical 的唯一真源（{{CANONICAL}} 从它取）。
// 这一项守的是「别退回第二处真源」：产物里的 href 必须逐字等于数据里那个值转义后的样子。
test('CANONICAL_MATCHES_SITE catches a canonical that drifted from site.url', () => {
  const html = '<link rel="canonical" href="https://old.example/">';
  const r = CANONICAL_MATCHES_SITE.run({ html, url: 'https://techisle.top/' });
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('old.example'));
});

test('CANONICAL_MATCHES_SITE passes when artifact and data agree', () => {
  const html = '<link rel="canonical" href="https://techisle.top/">';
  assert.deepEqual(CANONICAL_MATCHES_SITE.run({ html, url: 'https://techisle.top/' }), []);
});

test('CANONICAL_MATCHES_SITE escapes the same way build.js does', () => {
  const html = '<link rel="canonical" href="https://x.test/a&amp;b">';
  assert.deepEqual(CANONICAL_MATCHES_SITE.run({ html, url: 'https://x.test/a&b' }), []);
});

test('CANONICAL_MATCHES_SITE flags a missing canonical', () => {
  assert.equal(CANONICAL_MATCHES_SITE.run({ html: '<title>x</title>', url: 'https://techisle.top/' }).length, 1);
});

// ── 11. ASSERTIONS 清单本身（修复轮 M-2）──────────────────────────
// 旧结构是两条平行清单：ASSERTIONS 数组 + check() 里手写的 run 调用，各漂一次而 CLI 报数撒谎
// —— 正是本任务要消灭的失败类型。现在 check() 直接 map(ASSERTIONS)，运行清单由清单派生，
// 剩下的风险只有「导出了断言常量却忘了进清单」，这条用例钉的就是这一半。
// ── 12. MODULE_PRELOAD_COVERS_GRAPH ───────────────────────────────
// 这份 ctx 是合成的：断言只吃 (html, jsModules) 两个键，所以能在这里把四种形状各演一遍，
// 包括真产物里暂时没出现的"死模块"和"import 指向不存在的文件"。
const PRELOAD_MODULES = {
  '/assets/js/app.js': 'import { x } from "./theme.js";\nimport "./demos/index.js";',
  '/assets/js/theme.js': 'export const x = 1;',
  '/assets/js/demos/index.js': 'import { m } from "./inkmark.js";\nexport default { m };',
  '/assets/js/demos/inkmark.js': 'export const m = 1;',
};
const preHtml = (hrefs) => `<head>${hrefs.map((h) => `<link rel="modulepreload" href="${h}">`).join('')}`
  + '<script type="module" src="/assets/js/app.js"></script></head>';
const LEAVES = ['/assets/js/theme.js', '/assets/js/demos/index.js', '/assets/js/demos/inkmark.js'];

test('MODULE_PRELOAD_COVERS_GRAPH passes when preload matches the import graph', () => {
  assert.deepEqual(MODULE_PRELOAD_COVERS_GRAPH.run({ html: preHtml(LEAVES), jsModules: PRELOAD_MODULES }), []);
});

test('MODULE_PRELOAD_COVERS_GRAPH catches an imported module that is not preloaded', () => {
  const r = MODULE_PRELOAD_COVERS_GRAPH.run({ html: preHtml(LEAVES.slice(0, 2)), jsModules: PRELOAD_MODULES });
  assert.equal(r.length, 1, '漏一个就该报一个');
  assert.match(r[0], /demos\/inkmark\.js/, '失败信息要指名是哪个模块，否则还得自己跑一遍对账脚本');
});

test('MODULE_PRELOAD_COVERS_GRAPH catches a preloaded module nobody imports', () => {
  const r = MODULE_PRELOAD_COVERS_GRAPH.run({
    html: preHtml([...LEAVES, '/assets/js/dead.js']),
    jsModules: PRELOAD_MODULES,
  });
  assert.equal(r.length, 1);
  assert.match(r[0], /dead\.js/);
});

test('MODULE_PRELOAD_COVERS_GRAPH fails loudly when the entry or an import target is missing', () => {
  assert.match(MODULE_PRELOAD_COVERS_GRAPH.run({ html: preHtml(LEAVES), jsModules: {} })[0], /app\.js/);
  const broken = { ...PRELOAD_MODULES };
  delete broken['/assets/js/theme.js'];
  assert.match(MODULE_PRELOAD_COVERS_GRAPH.run({ html: preHtml(LEAVES), jsModules: broken })[0], /theme\.js/);
});

test('ASSERTIONS lists every exported assertion exactly once', () => {  const all = [
    TOKEN_RESIDUE, CARD_COUNT, DEMO_REGISTRY_MATCH, COLOR_LEAK, LANG_PAIR,
    NO_UNDEFINED_VALUES, DEPENDENCIES_EMPTY, CSS_JS_SHIPPED, STYLESHEETS_MERGED,
    FRAGMENTS_PRESENT, CANONICAL_MATCHES_SITE, MODULE_PRELOAD_COVERS_GRAPH,
  ];
  assert.equal(ASSERTIONS.length, all.length, '清单条数 == CLI 打印条数的基数；新增断言必须同时进这里');
  for (const a of all) {
    assert.equal(ASSERTIONS.filter((x) => x === a).length, 1, `${a.name} 必须恰好在清单里出现一次`);
  }
});
