// test/data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/data/projects.js';
import { skills } from '../src/data/skills.js';
import { sections, ui, links } from '../src/data/copy.js';
import { site } from '../src/data/site.js';

const hasBoth = (o) => o && typeof o.zh === 'string' && o.zh.trim() !== '' && typeof o.en === 'string' && o.en.trim() !== '';

// 计划里的正则是 /^(https?:\/\/|#)$/ —— 那个 $ 让它只接受字面量 "https://"（无主机名），
// 会把 spec 7.1/7.2 已定稿的真实链接 https://hot.techisle.top 判成不合格，与 Step 7 期望的 PASS 自相矛盾。
// 这里按测试名本意修：带主机名的绝对 http(s)，或显式占位 '#'。裸 "https://" 仍不通过。
// 只写这一份：两处各抄一遍字面量，将来放松一处就会悄悄漏检。
const URL_OR_PLACEHOLDER = /^(https?:\/\/\S+|#)$/;

test('every card carries both languages', () => {
  for (const c of projects) {
    for (const key of ['label', 'cat', 'title', 'quote']) {
      assert.ok(hasBoth(c[key]), `${c.slug}.${key} must have non-empty zh and en`);
    }
    // spec 明写 demo 可以是 null，且卡数不固定，所以把形状也钉住：
    // 非空字符串或 null，别的（undefined / 数字 / 空串）直接失败并报出实际值。
    assert.ok(
      c.demo === null || (typeof c.demo === 'string' && c.demo.trim() !== ''),
      `${c.slug}.demo must be a non-empty string or null, got ${JSON.stringify(c.demo)}`,
    );
    // 判「有没有 demo」要看它是不是字符串，不能写成 c.demo !== null ——
    // 那个极性把 demo 漏写（undefined）当成「有 demo」，报错会指向 demoHint，把真凶藏起来。
    if (typeof c.demo === 'string') {
      assert.ok(hasBoth(c.demoHint), `${c.slug}.demoHint required when demo present`);
    }
  }
});

test('card numbering is sequential from N°01', () => {
  projects.forEach((c, i) => {
    assert.equal(c.no, `N°${String(i + 1).padStart(2, '0')}`, `${c.slug} should be N°${i + 1}`);
  });
});

test('slug is unique and filesystem-safe', () => {
  const slugs = projects.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/, `${s} must be lowercase-hyphen`);
});

// 原名「tags are latin strings」是假的：断言里既没有 latin 也没有非空，['', ''] 一样通过。
// 也不该去断言 latin —— 已批准文案里就有中文 tag（可视化 / 爬虫 / 键盘练习 / 单词记忆 / 博客系统）。
test('every card has at least one non-empty tag string', () => {
  for (const c of projects) {
    assert.ok(Array.isArray(c.tags) && c.tags.length >= 1, `${c.slug} needs tags`);
    for (const t of c.tags) {
      assert.equal(typeof t, 'string', `${c.slug} tag must be a string, got ${JSON.stringify(t)}`);
      assert.notEqual(t.trim(), '', `${c.slug} has an empty tag`);
    }
  }
});

// 只覆盖卡。sections 那条 `assert.match(s.url || '#', …)` 是空断言：sections 从来没有 url 键，
// `s.url || '#'` 恒等于 '#'，永远通过，删掉。要测 sections 的链接，先给它真 url 再说。
test('every card url is absolute http(s) or an explicit placeholder', () => {
  for (const c of projects) {
    assert.match(c.url, URL_OR_PLACEHOLDER, `${c.slug}.url = ${c.url} is not absolute`);
  }
});

test('skills list is the 13 finalized from spec section 8', () => {
  assert.equal(skills.length, 13);
  for (const s of skills) assert.ok(hasBoth(s));
});

// hasBoth 原先只跑在卡的 label/cat/title/quote/demoHint 与 skills 上；hero、区块标题、
// 页脚版权、站点区注记全是成对的，却不在这张网的覆盖里 —— 任一处掉成单语（EN-only / ZH-only）
// 测试不会响。这条把剩下的双语字段一次补齐。
test('hero, section titles, footer and site notes carry both languages', () => {
  site.hero.lines.forEach((line, i) => {
    assert.ok(hasBoth(line), `site.hero.lines[${i}] must have non-empty zh and en`);
  });
  // sub 原先是扁平的 subZh / subEn，形状和其余双语字段不一致，走不进通用 i18n 节点发射器。
  assert.ok(hasBoth(site.hero.sub), 'site.hero.sub must be { zh, en } with both sides non-empty');
  assert.ok(hasBoth(site.hero.scroll), 'site.hero.scroll must have non-empty zh and en');
  sections.forEach((s) => {
    assert.ok(hasBoth(s.title), `sections.${s.id}.title must have non-empty zh and en`);
  });
  assert.ok(hasBoth(ui.copyright), 'ui.copyright must have non-empty zh and en');
  links.forEach((l) => {
    assert.ok(hasBoth(l.note), `links["${l.name}"].note must have non-empty zh and en`);
  });
});

test('hero brand head matches the document title', () => {
  // spec 7.3：Cubeyu® 必须同时出现在 title 与 hero 大字
  assert.equal(site.hero.lines[0].zh, 'Cubeyu®');
  assert.ok(site.title.startsWith('Cubeyu®'));
  // 「hero 里没有代码诗人」不再在这里单独断言：site 已经在下面的全量扫描里，
  // 同一件事写两处，将来改扫法时只会改到一处。
});

// 上面那条 hasBoth 只保证两侧都【有】，没保证两侧【同值】，而 build.js 的遮罩渲染只取 l.zh：
//   site.hero.lines.map((l) => `<span class="lmask"><span>${esc(l.zh)}</span></span>`)
// 单份渲染成立的理由是这三行是品牌字头 Cubeyu® + 拉丁动词 builds / small tools.，中英本就是同一串。
// 这个前提是承重的：lmask 节点上没有 .i18n-* 类，CSS 的语言显隐罩不到它，英文态没有第二份文字可换。
// 所以一旦有人把某行的 en 改成不同值，英文模式下就静默显示中文 —— 没有报错、没有空节点，
// 只有截图上看不出来的一处错。真要做出双语差异时得改渲染结构（每行发 zh / en 两层），不能只改数据。
test('hero mask lines are identical in both languages, as build.js assumes', () => {
  site.hero.lines.forEach((l, i) => {
    assert.equal(l.en, l.zh,
      `site.hero.lines[${i}]：遮罩行按「中英同值」设计，build.js 只渲染 l.zh，`
      + `改这一行的 en 会让英文态静默显示中文；需要双语差异时得改渲染结构，不能只改数据`);
  });
});

// Task 10 Step 5：无 JS 完整性。双语两套节点在构建时烘进产物，运行时只翻 <html lang>，
// 所以关掉 JavaScript 页面仍有全部文案 —— 这条断言扫的是 dist/，不是 src/，
// 测的正是「内容不靠运行时渲染」这件事本身（先 npm run build 再 npm test）。
test('content does not depend on JS to appear', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync('dist/index.html', 'utf8');
  assert.ok(html.includes('笔记存在自己电脑上'), 'zh copy must be baked at build time');
  assert.ok(html.includes('Your notes stay on your own machine'), 'en copy must be baked too');
});

// 审查 I2 的产物面。这个仓库此前从没设过 CSS `color-scheme`，于是暗色下 Chrome 画的是
// 近黑的 `outline: auto` 焦点环（实测约 1.04:1）、亮色调色板的原生滚动条与选区 ——
// 浏览器 UI 跟的是 color-scheme，不是我们的 data-theme。两条都要钉住：
// 1) :root 声明 light、[data-theme="dark"] 声明 dark；
// 2) 焦点环只有一条全局规则、覆盖 a / button / input / textarea / [tabindex]，那两个一次性补丁不再存在
//    （原先只有被点到过的控件有环，卡标题与页脚邮箱仍是 UA 环）。
//    input / textarea 两个名字是 Task 11 补的（控制器裁定：inkmark 的源码栏是 textarea），
//    下面的期望值跟着产物一起改，条数仍必须是 1 —— 换名不换「全站一种环」这条约束。
// 扫的是 dist/assets/app.css —— 合并后的产物才是浏览器加载的那份字节。
// 先剥注释再扫：与 check.js 的 COLOR_LEAK 同一条口径，注释里引用字面量是允许的。
test('the shipped CSS sets color-scheme and carries one global focus ring', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('dist/assets/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const scheme = [...css.matchAll(/color-scheme\s*:\s*(light|dark)/g)].map((m) => m[1]);
  assert.deepEqual(scheme, ['light', 'dark'],
    'color-scheme 必须恰好两处、且亮在前暗在后（同为 0-1-0 特异性，靠暗色块排在后面取胜）');
  assert.match(css, /:root\s*\{[^}]*color-scheme\s*:\s*light/, ':root 里要有 color-scheme: light');
  assert.match(css, /\[data-theme="dark"\]\s*\{[^}]*color-scheme\s*:\s*dark/,
    'data-theme="dark" 块里要有 color-scheme: dark，否则暗色页仍是亮调色板的滚动条与选区');
  const rings = [...css.matchAll(/([^{}]+):focus-visible\s*\{[^}]*outline[^}]*\}/g)].map((m) => m[1].trim());
  assert.deepEqual(rings, [':where(a, button, input, textarea, [tabindex])'],
    `全站只该有一条 :focus-visible 描边规则，实际有：${rings.join(' | ')}`);
});

// 约束条：base.css 保留全局的 reduced-motion 归零，组件文件不得再自己声明时长。
// 这条在仓库侧能验的部分是「产物里那一段还在、形状没退」：chrome-devtools MCP 的 emulate
// 工具没有 prefers-reduced-motion 这一档（实测报 Unknown argument），运行时那一半只能在
// 真 DevTools 的 Rendering 面板里跑，见报告的「未能验证项」。
// animation-delay 必须带单位（写 0 会被解析器整条丢掉，规则序列化成空块），这条也在这里钉住。
test('the global reduced-motion zeroing ships intact', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('dist/assets/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after\s*\{([^}]*)\}/.exec(css);
  assert.ok(block, 'base.css 的全局 reduced-motion 归零块在产物里找不到了');
  const body = block[1];
  for (const decl of ['animation-duration', 'transition-duration']) {
    assert.match(body, new RegExp(`${decl}: \\.01ms !important`), `${decl} 应归到 .01ms`);
  }
  for (const decl of ['animation-delay', 'transition-delay']) {
    assert.match(body, new RegExp(`${decl}: 0s !important`), `${decl} 必须写 0s —— 无单位的 0 会被整条丢掉`);
  }
  assert.match(body, /animation-iteration-count: 1 !important/, '循环动画要停在第一帧');
  // 组件侧不许再抄时长：整份产物里 !important 只该有全局归零块那 5 条。
  // 多一条就是某个组件自己开了口子（约束条：--ease-expo 唯一、时长只在 base.css 这一处归零）。
  assert.equal([...css.matchAll(/!important/g)].length, 5,
    '产物里的 !important 只许是全局 reduced-motion 那 5 条声明');
});

// 焦点环的对比度：审查 I2 要的实测数字，做成【能从仓库复现】的一条，而不只是报告里的一句 prose。
// 环色取 computed outline-color 的唯一来源 --ink，底色取它压着的 --paper，两套调色板各算一次
// WCAG 1.4.11（非文本对比度，焦点指示器的门槛是 3:1）。
// 跑出来的数就打在 t.diagnostic 里（npm test 可见）：亮 17.40:1、暗 16.69:1，
// 都远过 3:1。反面对照是修之前那个 UA `outline: auto` 的约 1.04:1 —— 那是 Chrome
// 内部按 color-scheme 取的环色，仓库里算不出来，只能在浏览器里量（见报告的 MCP 步骤），
// 所以那一个数标为不可复现，而这一条算出的两个数是可复现的。
function srgb(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = hex.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  assert.ok(m, `对比度计算只吃十六进制色值，拿到的是 ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x) : [m[1].slice(0, 2), m[1].slice(2, 4), m[1].slice(4, 6)];
  const [r, g, b] = h.map((x) => parseInt(x, 16) / 255);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// 从产物的 CSS 里按块取声明：剥注释 → 定位选择器 → 取配对花括号内的体（同 tokens.test.js 的口径）
function declarations(css, selector) {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `${selector} not in the shipped css`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}' && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  return assert.fail(`${selector} block has no closing }`);
}

function tokenOf(body, name) {
  const m = body.match(new RegExp(`--${name}\\s*:\\s*([^;]+)`));
  assert.ok(m, `--${name} missing`);
  return m[1];
}

test('the focus ring clears WCAG 1.4.11 contrast on the page background, both themes', async (t) => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('dist/assets/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = declarations(css, ':root');
  const dark = declarations(css, '[data-theme="dark"]');
  const rings = {
    light: contrast(tokenOf(light, 'ink'), tokenOf(light, 'paper')),
    dark: contrast(tokenOf(dark, 'ink'), tokenOf(dark, 'paper')),
  };
  for (const [mode, ratio] of Object.entries(rings)) {
    t.diagnostic(`焦点环对比度 ${mode}: ${ratio.toFixed(2)}:1（--ink 压在 --paper 上，WCAG 1.4.11 门槛 3:1）`);
    assert.ok(ratio >= 3, `${mode} 态焦点环对比度 ${ratio.toFixed(2)}:1 低于非文本 3:1`);
  }
});

// 上面那条只说「有一条规则」，这条钉住它真的罩得住键盘可达的三类控件：
// spec 9.2 要求卡片链接可键盘到达，而 Task 9-10 的审查正是「只有开关有环」。
// 语言开关还得是控件而不是伪装成链接的 <a>（审查 I4），所以顺带扫产物 DOM 的标签名。
test('the keyboard-reachable controls are all covered by that one ring', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync('dist/index.html', 'utf8');
  assert.match(html, /<a class="card-link"/, '卡标题要渲染成真链接（可键盘到达的前提）');
  assert.match(html, /<footer[^>]*>[\s\S]*<button type="button" class="pref-toggle"/,
    '页脚主题开关必须是 button');
  assert.match(html, /<button type="button" data-lang-toggle/, '语言开关必须是 button');
  assert.ok(!/tabindex=["'][^"']*\b-1\b/.test(html),
    '产物里不该有 tabindex="-1"：那会让控件从 Tab 序列里消失，焦点环规则罩不住不存在的路径');
});

// 审查 I4 + I3 的产物面。原先的语言控件是 `<a href="#">`：关掉 JS 后它是个会滚到页顶、
// 什么都切不了的假链接，Ctrl/中键还能多开一个同页标签。现在它是真 <button type="button">，
// 无 JS 时点了不动；可见文字仍是烘进产物的两项「中 / EN」，且与 data-labels 那一项逐字相同 ——
// i18n.js 首画写回的就是这一串，所以无 JS 态与 JS 态对同一个控件给出同一种承诺。
// 这条扫 dist/ 而不是 src/：属性值与元素文字是不是同一串，只有产物说了才算。
// 两个产物分开扫：404 是刻意最小的页面（模板注释写明「除一个回首页链接外没有任何开关」），
// 所以按钮只在 index 上断言；首帧守卫与「不留死链」两条两侧都要 —— {{ANTI_FLASH}} 是同一个 token，
// 漂出第二份守卫正文就等于「一份偏好各写一遍」回来了。
test('the language control is a real button whose baked text is what JS will paint', async () => {
  const { readFileSync } = await import('node:fs');
  const pair = `${ui.langZh} / ${ui.langEn}`;
  const home = readFileSync('dist/index.html', 'utf8');
  assert.match(home, new RegExp(`<button type="button" data-lang-toggle[^>]*>${pair.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}</button>`),
    '语言开关必须是烘进产物的 <button type="button">，可见文字是两项同场的「中 / EN」');
  assert.ok(home.includes(`data-labels="${pair}"`),
    'data-labels 必须与元素文字同值 —— 首帧写回同一串，才没有「先显示 A 再变成 B」的替换');

  for (const [page, html] of [['dist/index.html', home], ['dist/404.html', readFileSync('dist/404.html', 'utf8')]]) {
    assert.ok(!html.includes('href="#"'),
      `${page}: 产物里不该有 href="#" 这种「看着能点、点了跳到页顶」的死链；卡链接按 spec 8.1 在占位时不渲染 <a>`);
    assert.match(html, /if\(l==='en'\)document\.documentElement\.lang='en'/,
      `${page}: 语言偏好必须在 <head> 的内联脚本里落定，否则英文用户 reload 先看到一帧中文`);
    assert.equal([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].length, 1,
      `${page}: 内联守卫只许一段`);
  }
});

test('no classical-Chinese branding anywhere', () => {
  // links 与 ui 同样是文案，之前没进扫描 = 网漏了两块。人工核过今天它们是干净的，
  // 补进来的意义在于以后往站点区加文案时网仍然罩得住。
  const blob = JSON.stringify({ projects, skills, sections, ui, links, site });
  for (const banned of ['代码诗人', '以墨为笔', '以码为诗', '水墨', '展 卷', '题跋']) {
    assert.ok(!blob.includes(banned), `found banned classical token: ${banned}`);
  }
});
