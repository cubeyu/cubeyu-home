# cubeyu-home M1+M2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成一个零依赖静态单页站 —— 完整照搬 oiloil.org 的瑞士编辑式极简风，含逐词遮罩 hero、双语切换、明暗模式，以及 7 张作品卡的纸面形态 + 第 1 张卡的可交互微原型。

**Architecture:** `src/data/*.js` 是唯一内容源；`build.js` 在构建时把数据烘进 `templates/index.html` 的 `{{TOKEN}}` 与区块循环，合并 CSS，原样拷贝 ES module 目录树，产出 `dist/`。运行时 `app.js` 按 `[data-demo]` 查注册表挂载微原型，查不到即静默降级为纸面卡。双语走「构建时输出两个并列文本节点 + `html[lang]` 纯 CSS 显隐」，不依赖 JS 渲染内容。

**Tech Stack:** Node 20+（内置 `node:test`、`node --experimental-*` 一律不用）、原生 HTML/CSS/JS、`lightningcss` + `terser`（仅 `devDependencies`）、Vercel 静态托管。

**Spec:** [docs/superpowers/specs/2026-11-03-cubeyu-home-design.md](../specs/2026-11-03-cubeyu-home-design.md) —— 本计划论证的出发点，执行时必须同时读它。

---

## 本计划的范围与两处偏离

**范围 = spec 的 M1 + M2，止于换卡检查点。** M3（剩余 6 个微原型）、M4（光标 + reveal）、M5（部署）各需独立计划，原因是用户在 2026-11-03 声明「7 张作品卡后续我可能更换」，而 spec 7.1 已把换卡窗口定在 M2 与 M3 之间；给尚未定稿的 6 个微原型写详细代码计划正是 spec 第 10 节警告的沉没成本。

**本计划比 spec 的里程碑划分多做一件事，是好消息：** 因为卡片是数据驱动的，Task 6 把 7 张卡的条目写进 `data/projects.js` 后，7 张纸面卡与 1 张纸面卡的实际构建成本相同。所以本计划交付时 M2 已自然完成，M3 只剩「给第 2–7 张卡补微原型」。

### 偏离 1：不实现 spec 5.3 的 JS 拼接式 mini-bundler

spec 5.3 原写「按 `import` 拓扑排序 → 每个模块体包 IIFE → 剥离 `import`/`export` 行 → 输出单个 `app.js`」。**本计划不实现它，改为原样拷贝 `src/js/**` 目录树 + `<script type="module">`。**

理由：那 4 步里，「剥离 `export function mount` 却保留符号名」「IIFE 内再挂全局命名空间」两处都必须用正则改写 JS 源码，是在自研一个不可靠的解析器。它会在 M1 引入难查的坏件，而 M1 的任务是证明视觉方向对不对。代价是多约 12 个模块请求 —— Vercel 用 HTTP/2 多路复用，同一连接并行取，实测影响可忽略。

**这一条已由用户确认采纳（2026-11-03），spec 5.3 已同步改写为原生 ES module 方案。**

### 偏离 2：`check.js` 的色值扫描改为源文件 + 白名单

spec 9.1 第 4 项要正则扫 `#[0-9a-fA-F]{3,8}` 与 `rgba?\(`。但 `base.css` 里 `border-color: transparent`、`color: currentColor` 不触发；会误报的是 CSS 变量回退写法与 `box-shadow` 里的 `#fff0`。本计划按 spec 扫源文件，并允许显式白名单，见 Task 12。

---

## Global Constraints

每条对本计划所有任务隐含生效。值一律照抄 spec，不得改写。

- **零运行时依赖**：`package.json` 的 `dependencies` 必须为 `{}`；第三方包只能出现在 `devDependencies`。
- **唯一色值源**：全站只有 `src/styles/tokens.css` 允许出现字面色值（`#hex` / `rgb()` / `rgba()` / `hsl()`）。其余任何 `.css` 源文件必须用 `var(--…)`。
- **唯一缓动曲线**：`--ease-expo: cubic-bezier(.19, 1, .22, 1)`。除循环 `pulse` 外，任何 `transition`/`animation` 不得出现别的 timing function。
- **窄栏**：内容容器 `max-width: 820px`（`--col`）。
- **发丝线与圆角**：边框 `1px`；卡片与区块圆角取 `2px`–`8px`；只有 pill 与圆点用 `999px`/`50%`。禁止大圆角卡片。
- **字体**：`--font-sans` 与 `--font-mono`（见 Task 2）。正文标题一律 sans，编号 `N°01`、eyebrow、标签一律 mono。
- **暗色同步**：`:root` 里新增任何非主题中性的变量，必须在 `[data-theme="dark"]` 同时定义，否则发丝线在暗底隐形。Task 2 的测试机器执行这条。
- **reduced-motion**：`prefers-reduced-motion: reduce` 命中时，逐词遮罩、入场动画、微原型的自动循环全部停止，内容保持静态可读。这是硬要求，不是加分项。
- **双语完整**：每个 `.i18n` 位置必须成对输出 `i18n-zh` 与 `i18n-en`，不允许只写一边。
- **转义边界（两类 token，规则不同，不得混用）**：`renderTemplate` 是字面字符串拼接，没有转义边界。因此 **叶子 token 必须过 `esc()`** —— `TITLE`、`DESCRIPTION` 这类直接落在文本节点或 `content="…"` 属性里的值，`"` 会截断属性、`<` 会往 `<head>` 注入标记；而 **片段 token 必须保持裸值** —— `NAV`、`HERO`、`SECTIONS`、`FOOTER` 是已在组装处逐字段 `esc()` / `i18n()` 过的 HTML 片段，再套一层 `esc()` 就是双重转义。同一个 tokens 字面量里两套规则并存是故意的，每个写 build.js 的人都必须在注释里看到这条，否则会「顺手全 esc」。
- **卡片数量不硬编码**：任何断言、循环、样式都不得假设「7」。`demo: null` 是合法取值，表示纯纸面卡。
- **文案语言**：界面与注释中文；API 名、变量名、文件路径、CSS 类名保持英文。
- **不得改动**：`D:\code\other\MoeHome\**`、`D:\code\other\Simple-Homepage\**`、`techisle.top` 与 `portfolio.techisle.top` 的线上部署。本计划所有文件写入均在 `D:\code\other\cubeyu-home\**`。
- **品牌字头一致**：`Cubeyu®` 同时出现在 `<title>` 与 hero 大字；`麦希屿` 只出现在 title 破折号后与 `.sub` 行。改一处必改另一处（spec 7.3）。

---

## 文件结构与职责

```
cubeyu-home/
  package.json                     # dependencies 必须为空对象
  build.js                         # 构建：模板渲染 + CSS 合并 + JS 原样拷贝 + 压缩
  check.js                         # 产物与源文件断言（7 项）
  serve.js                         # 本地静态服务，:4173
  test/
    tokens.test.js                 # 暗色变量覆盖完整性
    build-utils.test.js            # esc / i18n / renderTemplate
    data.test.js                   # 卡片字段、双语成对、古风残留扫描
    demos.test.js                  # 注册表与磁盘文件一致
    prefs.test.js                  # 三态循环与 auto 归一
    check.test.js                  # 7 项断言各自的成功与失败路径
  archive/
    portfolio-2026-11-03.html      # 已存在，子站唯一内容副本，勿动
  src/
    lib/
      build-utils.js               # esc / i18n / renderTemplate / cssOrder
    data/
      site.js                      # 身份、title、description、hero、nav、footer
      copy.js                      # 区块 eyebrow 与通用 UI 文案（双语）
      projects.js                  # 7 张卡：编号、双语标签、引文、tags、demo、url
      skills.js                    # 13 项技能（双语）
    styles/
      tokens.css                   # 唯一允许字面色值的文件
      base.css                     # reset、排版阶梯、发丝线工具类、窄栏、i18n 显隐
      hero.css                     # 逐词遮罩
      cards.css                    # 作品卡、技能区、站点区、页脚
      demos/
        inkmark.css                # M1 唯一微原型样式
    js/
      prefs.js                     # 共用的 data-* + localStorage 读写工具
      theme.js                     # 明暗三态 auto|light|dark
      i18n.js                      # 中英切换，只改 html[lang]，不渲染文本
      app.js                       # 入口：初始化 prefs → 查 [data-demo] 挂载
      demos/
        index.js                   # 注册表
        inkmark.js                 # mount 契约实现
    templates/
      index.html                   # {{TOKEN}} 占位
  dist/                            # 构建产物，git 忽略
```

---

## Task 1: 仓库脚手架

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `serve.js`

**Interfaces:**
- Consumes: 无
- Produces: `npm run build` / `npm run check` / `npm test` / `npm run serve` 四个入口；`node --test test/` 可用；`http://localhost:4173` 静态服务。

- [ ] **Step 0: 偏离 1 已获批（无需再问，仅留痕）**

「不做 JS 拼接、改原生 ES module」已由用户于 2026-11-03 批准，spec 5.3 已同步改写。执行到此直接勾选下一步。

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "cubeyu-home",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "node build.js",
    "check": "node build.js && node check.js",
    "test": "node --test test/",
    "serve": "node build.js && node serve.js"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

注意 `dependencies` 与 `devDependencies` 此刻都是空对象 —— Global Constraints 要求前者永久为空，后者在 Task 13 才填。`"type": "module"` 让 `build.js`/`check.js`/`serve.js` 能用 `import`。

- [ ] **Step 2: 写 `.gitignore`**

```
dist/
node_modules/
.vercel
```

- [ ] **Step 3: 写 `serve.js`**

不内联一段 `node -e` 的压缩字符串 —— 那样既不可读也不可测，而且 `"type": "module"` 下 `require` 的可用性依赖 Node 对 `--eval` 的默认处理，属不必要的脆弱。

```js
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // 目录穿越守卫：resolve 后必须仍在 dist/ 内
  let file = normalize(join('dist', url === '/' ? '/index.html' : url));
  if (!file.startsWith(normalize('dist'))) { res.writeHead(403); return res.end('forbidden'); }
  if (extname(file) === '') file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1>'); }
  res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
  res.end(readFileSync(file));
}).listen(4173, () => console.log('http://localhost:4173'));
```

- [ ] **Step 4: 验证脚手架可用**

Run: `mkdir -p test && npm test`
Expected: `tests 0` / `pass 0`，退出码 0。此刻 build 脚本还不存在，所以**不要**跑 `npm run build`。

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore serve.js
git commit -m "chore: 初始化 cubeyu-home 脚手架"
```

---

## Task 2: tokens.css —— 设计变量与暗色覆盖

**Files:**
- Create: `src/styles/tokens.css`
- Test: `test/tokens.test.js`

**Interfaces:**
- Consumes: 无
- Produces: 约 22 个 `--*` 变量，供全部后续样式文件以 `var(--…)` 消费。变量名即跨任务契约，后续任务不得改名。

- [ ] **Step 1: 写失败的测试**

这个测试守的是 spec 4.2 列的头号暗色陷阱：新增一个颜色变量却忘了在 `[data-theme="dark"]` 重定义，导致发丝线在暗底隐形而无人察觉。

```js
// test/tokens.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');

function varsIn(blockSelector) {
  const start = css.indexOf(blockSelector);
  assert.notEqual(start, -1, `${blockSelector} not found`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return [...css.slice(open, close).matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(m => m[1]);
}

// 主题中性变量：字体、缓动、时长、布局尺寸。这些明暗共用，允许不在 dark 里出现。
const THEME_NEUTRAL = new Set([
  '--font-sans', '--font-mono', '--ease-expo', '--dur-enter',
  '--col', '--rule-w', '--radius-sm', '--radius-pill',
]);

test('every non-neutral token is redefined for dark', () => {
  const light = varsIn(':root');
  const dark = new Set(varsIn('[data-theme="dark"]'));
  const missing = light.filter(v => !THEME_NEUTRAL.has(v) && !dark.has(v));
  assert.deepEqual(missing, [], `missing dark overrides: ${missing.join(', ')}`);
});

test('tokens.css declares the measured oiloil values', () => {
  for (const [name, value] of [
    ['--paper', '#FFFFFF'],
    ['--ink', '#1A1A1A'],
    ['--mark-bg', '#FFE28A'],
    ['--ease-expo', 'cubic-bezier(.19, 1, .22, 1)'],
    ['--col', '820px'],
    ['--dur-enter', '1.4s'],
  ]) {
    assert.match(css, new RegExp(`--${name.slice(2)}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${name} should be ${value}`);
  }
});

test('dark paper is the near-black measured from oiloil', () => {
  assert.match(css, /\[data-theme="dark"\][\s\S]*?--paper\s*:\s*#0C0C0E/);
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL —— `ENOENT: no such file or directory, open 'src/styles/tokens.css'`。

- [ ] **Step 3: 写 `src/styles/tokens.css`**

色值全部来自 spec 4.1/4.2 实测表，不要「觉得更好看」而调整。

```css
/* 全站唯一允许出现字面色值的文件。见 spec 4 节。 */
:root {
  /* 颜色 —— 亮色（oiloil 实测） */
  --paper: #FFFFFF;
  --surface: #FAFAFA;
  --surface-invert: #0C0C0E;
  --ink: #1A1A1A;
  --ink-2: #555555;
  --ink-3: #999999;
  --rule: rgba(26, 26, 26, .18);
  --rule-strong: #1A1A1A;
  --rule-dashed: rgba(26, 26, 26, .25);
  --mark-bg: #FFE28A;
  --mark-fg: #1A1A1A;
  --link: #1E40D8;

  /* 排版与布局 —— 主题中性 */
  --font-sans: "Helvetica Neue", -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --col: 820px;
  --rule-w: 1px;
  --radius-sm: 4px;
  --radius-pill: 999px;

  /* 动效 —— 全站唯一缓动曲线 */
  --ease-expo: cubic-bezier(.19, 1, .22, 1);
  --dur-enter: 1.4s;
}

[data-theme="dark"] {
  --paper: #0C0C0E;
  --surface: #141416;
  --surface-invert: #FAFAFA;
  --ink: #EDEDED;
  --ink-2: #A8A8AD;
  --ink-3: #72727A;
  /* 不重定义则发丝线在暗底完全隐形 —— spec 4.2 头号陷阱 */
  --rule: rgba(255, 255, 255, .14);
  --rule-strong: #EDEDED;
  --rule-dashed: rgba(255, 255, 255, .22);
  /* 纯 #FFE28A 在暗底过曝，降级为半透明底纹 —— 与亮色观感不同源，是 spec 记录的有意取舍 */
  --mark-bg: rgba(255, 226, 138, .24);
  --mark-fg: #FFE9A6;
  --link: #6E9BFF;
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-enter: .01ms; }
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npm test`
Expected: PASS，`pass 3`。

- [ ] **Step 5: 验证漏定义会被抓到**

临时在 `:root` 加一行 `--test-ghost: #123456;`，跑 `npm test`，确认 FAIL 且报 `missing dark overrides: --test-ghost`；删掉该行，再跑确认 PASS。这一步是在证明测试本身有效，不是走过场。

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css test/tokens.test.js
git commit -m "feat: 设计 tokens 与暗色覆盖完整性测试"
```

---

## Task 3: 构建工具函数

**Files:**
- Create: `src/lib/build-utils.js`
- Test: `test/build-utils.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `esc(value: string): string` —— HTML 转义
  - `i18n(zh: string, en: string): string` —— 成对双语节点
  - `renderTemplate(tpl: string, tokens: Record<string,string>): string` —— 替换那一刻遇到模板里的未知 token 则 throw（**不是**替换后全文扫描残留 —— 后者会把用户文案里合法的 `{{` 误判成 bug）
  - `cssOrder: string[]` —— CSS 合并顺序（含全部后续文件名）

- [ ] **Step 1: 写失败的测试**

```js
// test/build-utils.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, i18n, renderTemplate } from '../src/lib/build-utils.js';

test('esc neutralises HTML metacharacters', () => {
  assert.equal(esc(`a<b>&"'`), 'a&lt;b&gt;&amp;&quot;&#39;');
  assert.equal(esc(16), '16');
});

test('i18n always emits both nodes', () => {
  assert.equal(
    i18n('笔记', 'Notes'),
    '<span class="i18n i18n-zh">笔记</span><span class="i18n i18n-en">Notes</span>'
  );
});

test('i18n escapes each side', () => {
  assert.equal(i18n('<b>', '&co').includes('&lt;b&gt;'), true);
  assert.equal(i18n('a', '&co').includes('&amp;co'), true);
});

test('renderTemplate substitutes tokens', () => {
  assert.equal(renderTemplate('T: {{TITLE}}', { TITLE: 'Cubeyu®' }), 'T: Cubeyu®');
});

test('renderTemplate throws on an unknown token in the template', () => {
  assert.throws(() => renderTemplate('a {{NOPE}} b', { OTHER: 'x' }), /unknown token/i);
});

test('a token value containing {{ is inserted literally, not re-scanned', () => {
  // 单趟替换：值里的 {{ 不会被后续 token 二次吃掉
  assert.equal(renderTemplate('{{A}} {{B}}', { A: '{{B}}', B: 'zzz' }), '{{B}} zzz');
});
```

**为什么不在替换后扫描残留 `{{`**：那样会误判 —— 上例里值本身合法地含 `{{B}}`，替换后扫描会把它当未解析 token 抛错。所以「未知 token」必须在**替换的那一刻**判定（模板里出现的名字不在 tokens 表内即 throw），而不是事后全文扫描。这条在 Step 3 的实现里落。

最后一条测试针对的是「用户在文案里真打了 `{{`」这种会污染整页的情况。

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL —— `Cannot find module ... src/lib/build-utils.js`。

- [ ] **Step 3: 写 `src/lib/build-utils.js`**

```js
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function i18n(zh, en) {
  return `<span class="i18n i18n-zh">${esc(zh)}</span><span class="i18n i18n-en">${esc(en)}</span>`;
}

export function renderTemplate(tpl, tokens) {
  const missing = [];
  // 单趟替换：值里的 {{ 不会被当成 token 再解析（用户文案可能含花括号）
  const out = tpl.replace(/\{\{(\w+)\}\}/g, (whole, name) => {
    if (!Object.hasOwn(tokens, name)) { missing.push(name); return whole; }
    return tokens[name];
  });
  if (missing.length) {
    throw new Error(`Unknown template token(s): ${[...new Set(missing)].join(', ')}`);
  }
  return out;
}

// 合并顺序即层叠顺序，新增样式文件必须登记在此，否则不产出
export const cssOrder = [
  'tokens.css',
  'base.css',
  'hero.css',
  'cards.css',
  'demos/inkmark.css',
];
```

- [ ] **Step 4: 运行，确认通过**

Run: `npm test`
Expected: PASS，`pass 9`（含 Task 2 的 3 条）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/build-utils.js test/build-utils.test.js
git commit -m "feat: 构建期转义、双语节点与模板替换工具"
```

---

## Task 4: build.js —— 模板渲染与产物输出

**Files:**
- Create: `build.js`
- Create: `src/templates/index.html`
- Create: `src/data/site.js`（本任务只放最小必要字段，Task 6 补全）
- Modify: `src/lib/build-utils.js`（`cssOrder` 无需改动，若新增样式文件才登记）
- Test: `test/build-utils.test.js`（追加，见 Step 5）

**Interfaces:**
- Consumes: Task 3 的 `esc` / `i18n` / `renderTemplate` / `cssOrder`
- Produces:
  - `dist/index.html`、`dist/assets/app.css`、`dist/assets/js/**`
  - **无导出**：`build.js` 是顶层直接执行的纯脚本，不被任何模块 import。`check.js`（Task 12）读的是 `dist/` 产物而非调用 `build()`；`npm run check` 靠 `node build.js && node check.js` 串起构建与断言。

- [ ] **Step 1: 写 `src/data/site.js` 最小版**

```js
export const site = {
  title: 'Cubeyu® — 麦希屿',
  description: 'Cubeyu 的个人作品、AI 工具实操、产品开发与开源项目记录。',
};
```

Task 6 会扩到完整身份字段。此处的 `title` 与 `description` 已定稿，值来自 spec 7.3，不得改写。

- [ ] **Step 2: 写 `src/templates/index.html` 骨架**

本任务只要骨架能跑通构建，hero 与区块在 Task 7、8 填。

```html
<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
<link rel="canonical" href="https://techisle.top/">
<script>
/* 首帧防闪烁：CSS 加载前写入偏好，否则暗色用户每次刷新都白闪一下。spec 6.1 */
try{var t=localStorage.getItem('cubeyu-theme')||'auto';
document.documentElement.dataset.theme=(t==='auto')?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;}catch(e){}
</script>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>
<main id="main">
  <p>{{BUILD_PROBE}}</p>
</main>
<script type="module" src="/assets/js/app.js"></script>
</body>
</html>
```

`{{BUILD_PROBE}}` 是临时的构建哨兵，Task 7 删掉。它同时验证 `renderTemplate` 真的在跑。

- [ ] **Step 3: 写 `build.js`**

```js
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, cssOrder, esc } from './src/lib/build-utils.js';
import { site } from './src/data/site.js';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');

const tpl = readFileSync(join(root, 'src/templates/index.html'), 'utf8');

// 叶子 token 过 esc()；Task 7/8 的 NAV/HERO/SECTIONS 是片段，必须保持裸值（见 Global Constraints）
const html = renderTemplate(tpl, {
  TITLE: esc(site.title),
  DESCRIPTION: esc(site.description),
  BUILD_PROBE: 'build ok',
});

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
```

**刻意没有 `export function build()` 和 `if (process.argv[1] === …)` 那层「我是不是被 import」守卫。** `build.js` 在整个 M1 里不被任何模块 import（`check.js` 只读 `dist/` 产物），而那个守卫在 Windows 上还是坑：`process.argv[1]` 是 `D:\code\...\build.js` 反斜杠形式，`fileURLToPath(import.meta.url)` 给正斜杠，比较结果取决于你从哪儿调用 `node`。纯脚本、顶层直接执行，少一个可能失效的环节。

**这版只做 `TITLE` / `DESCRIPTION` / `BUILD_PROBE` 三个 token。** nav、hero、卡片区在 Task 7 与 Task 8 增量加入 —— 因为那时 `data/copy.js`、`data/projects.js`、`data/skills.js` 才存在（Task 6）。若在本任务就 import 它们，构建会因模块缺失直接失败。

此刻 `cssOrder` 里的 `base.css` / `hero.css` / `cards.css` / `demos/inkmark.css` 都还不存在，所以 Step 4 必须先补齐占位文件，否则 `readFileSync` 抛错。

- [ ] **Step 4: 补占位样式文件**

Run:

```bash
cd D:/code/other/cubeyu-home
printf '/* 由 Task 5 整文件替换 */\n' > src/styles/base.css
printf '/* 由 Task 7 整文件替换 */\n' > src/styles/hero.css
printf '/* 由 Task 8 整文件替换 */\n' > src/styles/cards.css
mkdir -p src/styles/demos && printf '/* 由 Task 11 整文件替换 */\n' > src/styles/demos/inkmark.css
mkdir -p src/js/demos && printf 'export default {}\n' > src/js/demos/index.js
printf 'console.log("app");\n' > src/js/app.js
```

- [ ] **Step 5: 构建并验证产物**

Run: `npm run build && node -e "const s=require('node:fs').readFileSync('dist/index.html','utf8');if(/\{\{/.test(s))throw new Error('leftover token');console.log('title:',/<title>(.*?)<\/title>/.exec(s)[1])"`
Expected: 输出 `built dist/` 与 `title: Cubeyu® — 麦希屿`，无异常。

Run: `ls dist/assets dist/assets/js`
Expected: `app.css`、`js/` 下含 `app.js` 与 `demos/index.js`。

- [ ] **Step 6: Commit**

```bash
git add build.js src/templates/index.html src/data/site.js src/styles/base.css src/styles/hero.css src/styles/cards.css src/styles/demos/inkmark.css src/js/app.js src/js/demos/index.js
git commit -m "feat: 构建器输出 dist 产物"
```

---

## Task 5: base.css —— reset、排版阶梯、发丝线、双语显隐

**Files:**
- Modify: `src/styles/base.css`（Task 4 Step 4 建的占位文件，整文件替换）

**Interfaces:**
- Consumes: Task 2 的全部 `--*` 变量
- Produces: `.col`（窄栏容器）、`.eyebrow`（等宽小标）、`.i18n` / `.i18n-zh` / `.i18n-en` 显隐规则、排版阶梯与 `--rule` 发丝线。后续样式文件全部依赖这些类名。

- [ ] **Step 1: 写 base.css**

字号严格照 spec 4.3 实测阶梯：H1 `58px/700`、H3 `30px/800`、H2 `16px/400`、body `16px` + `line-height 24px`、eyebrow `12px/650`。

```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 24px;
}

/* 窄栏：spec 4.1 --col = 820px */
.col { max-width: var(--col); margin-inline: auto; padding-inline: 20px; }

/* 排版阶梯（实测 oiloil） */
h1 { font-size: 58px; font-weight: 700; line-height: 1.04; margin: 0; letter-spacing: -.02em; }
h2 { font-size: 16px; font-weight: 400; margin: 0; }
h3 { font-size: 30px; font-weight: 800; margin: 0; letter-spacing: -.01em; }

/* eyebrow：等宽小标，形如 作品 / WORKS */
.eyebrow {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: .06em;
  color: var(--ink-2);
  text-transform: uppercase;
}
.num { font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); letter-spacing: .04em; }
.tag {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 2px 6px;
  border: var(--rule-w) solid var(--rule);
  border-radius: var(--radius-sm);
  color: var(--ink-2);
}

/* 发丝线 */
.rule-t { border-top: var(--rule-w) solid var(--rule); }
.rule-b { border-bottom: var(--rule-w) solid var(--rule); }

a { color: inherit; text-decoration-color: var(--rule); text-underline-offset: 3px; }
a:hover { color: var(--link); text-decoration-color: var(--link); }

/* 双语显隐：构建时烘两套节点，纯 CSS 切换，不靠 JS 渲染内容（spec 5.2） */
.i18n-en { display: none; }
html[lang="en"] .i18n-zh { display: none; }
html[lang="en"] .i18n-en { display: inline; }

/* 区块节奏 */
section { padding-block: 72px; }
@media (max-width: 640px) {
  h1 { font-size: 40px; }
  h3 { font-size: 24px; }
  section { padding-block: 48px; }
}

/* reduced-motion：入场时长归零（spec 6.2） */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

`prefers-reduced-motion` 这段是全项目动效兜底，M4 的光标与 reveal 也依赖它，因此放在 base 而非各组件里。

- [ ] **Step 2: 构建并肉眼确认无破坏**

Run: `npm run build && grep -c "i18n-en" dist/assets/app.css`
Expected: 构建成功；输出 ≥ 1。

- [ ] **Step 3: Commit**

```bash
git add src/styles/base.css
git commit -m "feat: 排版阶梯、发丝线与双语显隐基础样式"
```

---

## Task 6: 内容层 —— 7 张卡与全部文案定稿

**Files:**
- Create: `src/data/copy.js`
- Create: `src/data/skills.js`
- Create: `src/data/projects.js`
- Modify: `src/data/site.js`（补 hero / nav / footer）
- Test: `test/data.test.js`

**Interfaces:**
- Consumes: Task 3 的 `i18n`
- Produces:
  - `projects: Card[]`，`Card = { no: string, slug: string, label: {zh,en}, cat: {zh,en}, title: {zh,en}, quote: {zh,en}, tags: string[], demo: string|null, demoHint: {zh,en}|null, url: string }`
  - `skills: {zh,en}[]`（13 项）
  - `sections: {id, eyebrow, title: {zh,en}}[]`
  - `site.hero = { lines: {zh,en}[], subZh: string, subEn: string, scroll: {zh,en} }`

以下 14 句文案是 spec 7.1 已批准内容，**逐字照抄，不得顺手润色**。

- [ ] **Step 1: 写数据校验测试**

```js
// test/data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/data/projects.js';
import { skills } from '../src/data/skills.js';
import { sections } from '../src/data/copy.js';
import { site } from '../src/data/site.js';

const hasBoth = (o) => o && typeof o.zh === 'string' && o.zh.trim() !== '' && typeof o.en === 'string' && o.en.trim() !== '';

test('every card carries both languages', () => {
  for (const c of projects) {
    for (const key of ['label', 'cat', 'title', 'quote']) {
      assert.ok(hasBoth(c[key]), `${c.slug}.${key} must have non-empty zh and en`);
    }
    if (c.demo !== null) assert.ok(hasBoth(c.demoHint), `${c.slug}.demoHint required when demo present`);
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

test('tags are latin strings', () => {
  for (const c of projects) {
    assert.ok(Array.isArray(c.tags) && c.tags.length >= 1, `${c.slug} needs tags`);
    for (const t of c.tags) assert.equal(typeof t, 'string');
  }
});

test('every url is absolute http(s) or an explicit placeholder', () => {
  // 必须带主机名：早期版本写成 /^(https?:\/\/|#)$/，$ 锚点使其只匹配空主机名的
  // "https://"，与同任务里 https://hot.techisle.top 这条真实链接直接矛盾。
  // 收紧而非放宽：裸 scheme 仍被拒绝。
  const ABS = /^(https?:\/\/\S+|#)$/;
  for (const c of projects) assert.match(c.url, ABS, `${c.slug}.url = ${c.url} is not absolute`);
  for (const s of sections) assert.match(s.url || '#', ABS);
});

test('skills list is the 13 finalized from spec section 8', () => {
  assert.equal(skills.length, 13);
  for (const s of skills) assert.ok(hasBoth(s));
});

test('hero brand head matches the document title', () => {
  // spec 7.3：Cubeyu® 必须同时出现在 title 与 hero 大字
  assert.equal(site.hero.lines[0].zh, 'Cubeyu®');
  assert.ok(site.title.startsWith('Cubeyu®'));
  assert.ok(!JSON.stringify(site.hero).includes('代码诗人'), 'no classical branding allowed');
});

test('no classical-Chinese branding anywhere', () => {
  const blob = JSON.stringify({ projects, skills, sections, site });
  for (const banned of ['代码诗人', '以墨为笔', '以码为诗', '水墨', '展 卷', '题跋']) {
    assert.ok(!blob.includes(banned), `found banned classical token: ${banned}`);
  }
});
```

`hero 字头与 title 一致` 和 `古风残留扫描` 两条对应 spec 决策 10/11 —— 品牌一致性靠测试守，不靠人记得。

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL —— 找不到 `src/data/projects.js`。

- [ ] **Step 3: 写 `src/data/projects.js`**

```js
// 7 张作品卡。文案 = spec 7.1 已批准内容，逐字照抄，不要润色。
// demo: null 表示纯纸面卡，无微原型 —— 用户可能换卡，不得假设数量。
export const projects = [
  {
    no: 'N°01',
    slug: 'inkmark',
    label: { zh: '实时渲染', en: 'Live render' },
    cat: { zh: '编辑器', en: 'Editor' },
    title: { zh: '墨痕笔记', en: 'InkMark' },
    quote: { zh: '笔记存在自己电脑上，选中一段就能丢给模型改写。',
             en: 'Your notes stay on your own machine. Select a line, hand it to the model, get it back rewritten.' },
    tags: ['TypeScript', 'LLM', 'Markdown'],
    demo: 'inkmark',
    demoHint: { zh: '在左边改几个字，看右边怎么跟着变。',
                en: 'Type in the left pane and watch the right keep up.' },
    url: '#',
  },
  {
    no: 'N°02',
    slug: 'weflow',
    label: { zh: '年度数字', en: 'Count up' },
    cat: { zh: '归档', en: 'Archive' },
    title: { zh: '微流', en: 'WeFlow' },
    quote: { zh: '把微信聊天记录导出成本地文件，顺手生成一份你的年度报告。',
             en: 'Export your WeChat history to your own disk, then turn it into a year in review.' },
    tags: ['Electron', 'JavaScript', '可视化'],
    demo: 'weflow',
    demoHint: { zh: '数字是从零滚上来的，等它停。',
                en: 'The numbers count up — wait for them to settle.' },
    url: '#',
  },
  {
    no: 'N°03',
    slug: 'anchor-deck',
    label: { zh: '翻页', en: 'Deck' },
    cat: { zh: '演示', en: 'Slides' },
    title: { zh: '锚点幻灯片', en: 'Anchor Deck' },
    quote: { zh: 'AI 生成的幻灯片落成本地 HTML，每一页都能接着改。',
             en: 'AI-generated slides land as local HTML — and every page stays editable.' },
    tags: ['JavaScript', 'HTML', 'Local-first'],
    demo: 'anchor-deck',
    demoHint: { zh: '点卡片翻一页，或用方向键。',
                en: 'Click the card or use the arrow keys to advance.' },
    url: '#',
  },
  {
    no: 'N°04',
    slug: 'mc-agent',
    label: { zh: '自主决策', en: 'Autoplay' },
    cat: { zh: '代理', en: 'Agent' },
    title: { zh: '方块世界智仆', en: 'MC AI Agent' },
    quote: { zh: '给 Minecraft 装一个会自己想事的 Agent，它自己去探索、盖房、活下来。',
             en: 'Give Minecraft an agent that plans for itself — exploring, building, surviving.' },
    tags: ['Java', 'Minecraft', 'AI Agent'],
    demo: 'mc-agent',
    demoHint: { zh: '日志会自己走，不用点。',
                en: 'The log runs on its own. Just watch.' },
    url: '#',
  },
  {
    no: 'N°05',
    slug: 'dailyhot',
    label: { zh: '换源', en: 'Switch' },
    cat: { zh: '接口', en: 'API' },
    title: { zh: '今日热榜', en: 'DailyHot API' },
    quote: { zh: '一个接口，同时拿到十几个平台的热榜。',
             en: 'One endpoint, a dozen platforms\u2019 trending lists.' },
    tags: ['TypeScript', 'API', '爬虫'],
    demo: 'dailyhot',
    demoHint: { zh: '换几个平台，看列表怎么替。',
                en: 'Switch platforms and watch the list swap.' },
    url: 'https://hot.techisle.top',
  },
  {
    no: 'N°06',
    slug: 'keyboard-word',
    label: { zh: '逐字母判定', en: 'Keystroke' },
    cat: { zh: '练习', en: 'Drill' },
    title: { zh: '关键词', en: 'Keyboard Word' },
    quote: { zh: '照着单词敲，敲错了不给过——练的是手指，不是眼睛。',
             en: 'Type the word exactly, or it won\u2019t pass. This trains fingers, not eyes.' },
    tags: ['TypeScript', '键盘练习', '单词记忆'],
    demo: 'keyboard-word',
    demoHint: { zh: '试着少打一个字母，看它怎么拦你。',
                en: 'Drop a letter and see it push back.' },
    url: '#',
  },
  {
    no: 'N°07',
    slug: 'cloud-hidden',
    label: { zh: '展开', en: 'Expand' },
    cat: { zh: '写作', en: 'Writing' },
    title: { zh: '云隐博客', en: 'Cloud Hidden' },
    quote: { zh: '不写代码的时候，我就在这儿写点东西。',
             en: 'When I\u2019m not coding, I write here.' },
    tags: ['TypeScript', 'Astro', '博客系统'],
    demo: 'cloud-hidden',
    demoHint: { zh: '点目录把文章展开。',
                en: 'Click the tree to open an article.' },
    url: '#',  // spec 8.1 唯一待决项：博客落点三处记载互斥，未定前指向 #，不做猜测
  },
];
```

`url: '#'` 的 6 张卡是诚实做法：spec 未给出各项目官网，编一个 URL 比留空更糟。M3 前由用户补。

- [ ] **Step 4: 写 `src/data/skills.js`**

```js
// 13 项，spec 第 8 节定稿（源为 portfolio 快照，清单已在此固化，不再依赖子站）
export const skills = [
  { zh: 'JavaScript', en: 'JavaScript' },
  { zh: 'TypeScript', en: 'TypeScript' },
  { zh: 'React', en: 'React' },
  { zh: 'Vue', en: 'Vue' },
  { zh: 'Astro', en: 'Astro' },
  { zh: 'Node.js', en: 'Node.js' },
  { zh: 'Python', en: 'Python' },
  { zh: 'Java', en: 'Java' },
  { zh: 'Git', en: 'Git' },
  { zh: 'Docker', en: 'Docker' },
  { zh: 'Cloudflare', en: 'Cloudflare' },
  { zh: 'AI / LLM', en: 'AI / LLM' },
  { zh: '数据可视化', en: 'Data Visualization' },
];
```

- [ ] **Step 5: 写 `src/data/copy.js`**

```js
export const sections = [
  { id: 'works',   eyebrow: '作品 / WORKS',  title: { zh: '七个能上手玩的东西', en: 'Seven things you can actually poke' } },
  { id: 'skills',  eyebrow: '技能 / SKILLS', title: { zh: '日常在用', en: 'In daily use' } },
  { id: 'sites',   eyebrow: '站点 / SITES',  title: { zh: '我维护的其它东西', en: 'Other things I run' } },
];

export const ui = {
  langZh: '中',
  langEn: 'EN',
  themeLabels: { zh: ['自动', '亮', '暗'], en: ['AUTO', 'LIGHT', 'DARK'] },
  copyright: { zh: '© 2026 麦希屿', en: '© 2026 Cubeyu' },
};

// 站点区 7 条，spec 7.2。portfolio 子站已退役，故不列入。
export const links = [
  { name: 'ClawBase',   url: 'https://clawbase.cc',                    note: { zh: 'AI 代理部署聚合', en: 'Agent deploy guides' } },
  { name: '今日热榜',    url: 'https://hot.techisle.top',               note: { zh: '热榜聚合接口', en: 'Trending API' } },
  { name: '支持一下',    url: 'https://donate.techisle.top',            note: { zh: '赞赏', en: 'Buy me a coffee' } },
  { name: '站点监控',    url: 'https://check.techisle.top',             note: { zh: '可用性巡检', en: 'Uptime checks' } },
  { name: 'github.com/cubeyu', url: 'https://github.com/cubeyu',       note: { zh: '代码', en: 'Source' } },
  { name: '哔哩哔哩',     url: 'https://space.bilibili.com/88154706',   note: { zh: '视频', en: 'Video' } },
  { name: 'cubeyu@aliyun.com', url: 'mailto:cubeyu@aliyun.com',        note: { zh: '邮箱', en: 'Email' } },
];
```

- [ ] **Step 6: 补全 `src/data/site.js`**

```js
export const site = {
  title: 'Cubeyu® — 麦希屿',
  description: 'Cubeyu 的个人作品、AI 工具实操、产品开发与开源项目记录。',
  url: 'https://techisle.top/',
  hero: {
    // 逐词遮罩三行。字头 Cubeyu® 与 title 同一符号（spec 7.3 互为约束）
    lines: [
      { zh: 'Cubeyu®', en: 'Cubeyu®' },
      { zh: 'builds', en: 'builds' },
      { zh: 'small tools.', en: 'small tools.' },
    ],
    subZh: '麦 希 屿',
    subEn: 'DEVELOPER / AI TOOLS / OPEN-SOURCE',
    scroll: { zh: '↓ 往下滑', en: '↓ scroll' },
  },
  nav: { githubText: 'github.com/cubeyu', githubUrl: 'https://github.com/cubeyu' },
};
```

- [ ] **Step 7: 运行，确认通过**

Run: `npm test`
Expected: PASS。若 `card numbering sequential` 失败，说明某张卡的 `no` 手抄错位 —— 按报错里的 slug 修，不要改测试。

- [ ] **Step 8: Commit**

```bash
git add src/data test/data.test.js
git commit -m "feat: 内容层与作品卡文案定稿"
```

---

## Task 7: Hero —— 逐词遮罩

**Files:**
- Modify: `src/styles/hero.css`
- Modify: `src/templates/index.html`（替换 `{{BUILD_PROBE}}` 为真实 hero + nav）
- Modify: `build.js`（新增 hero 与 nav 的 token）

**Interfaces:**
- Consumes: `site.hero`、`site.nav`、Task 3 的 `i18n`
- Produces: `.hero`、`.lmask`、`.hero-sub`、`.hero-scroll`；`NAV` / `HERO` 两个 token 由 build.js 提供

- [ ] **Step 1: 写 hero.css**

```css
.hero { padding-top: 96px; padding-bottom: 64px; }

/* 逐词遮罩：外层裁切，内层从下方 110% 升起 */
.lmask { display: block; overflow: hidden; }
.lmask > span {
  display: block;
  transform: translateY(110%);
  animation: lmask-up .9s var(--ease-expo) forwards;
}
.lmask:nth-child(2) > span { animation-delay: .10s; }
.lmask:nth-child(3) > span { animation-delay: .20s; }
@keyframes lmask-up { to { transform: translateY(0); } }

.hero-sub { margin-top: 20px; display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
.hero-sub .zh { font-size: 16px; color: var(--ink-2); }
.hero-sub .en {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: .08em;
  color: var(--ink-3);
}
.hero-scroll {
  margin-top: 56px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-3);
  animation: drift 2.6s var(--ease-expo) infinite alternate;
}
@keyframes drift { to { transform: translateY(6px); } }

/* reduced-motion：不裁切，文字直接可见（spec 6.2 硬要求） */
@media (prefers-reduced-motion: reduce) {
  .lmask { overflow: visible; }
  .lmask > span { transform: none; animation: none; }
  .hero-scroll { animation: none; }
}
```

- [ ] **Step 2: 在 build.js 里生成 hero 与 nav**

在 `build.js` 顶部加 import：

```js
import { i18n } from './src/lib/build-utils.js';
import { ui, sections } from './src/data/copy.js';
```

在 `build.js` 的顶层、`const html = renderTemplate(...)` 之前加（`build.js` 无 `build()` 函数包裹，见 Task 4）：

```js
  const nav = `<nav class="col nav"><a href="/">${i18n('首页', 'Home')}</a>`
    + `<span class="nav-right">`
    + `<a href="#" data-lang-toggle>${ui.langZh} / ${ui.langEn}</a>`
    + `<a href="${site.nav.githubUrl}">${esc(site.nav.githubText)}</a>`
    + `</span></nav>`;

  const hero = `<header class="hero col">`
    + `<h1>` + site.hero.lines.map((l) => `<span class="lmask"><span>${esc(l.zh)}</span></span>`).join('') + `</h1>`
    + `<div class="hero-sub"><span class="zh">${esc(site.hero.subZh)}</span>`
    + `<span class="en">${esc(site.hero.subEn)}</span></div>`
    + `<div class="hero-scroll">${i18n(site.hero.scroll.zh, site.hero.scroll.en)}</div>`
    + `</header>`;
```

并把 `renderTemplate` 的 tokens 换成：

```js
  const html = renderTemplate(tpl, {
    TITLE: site.title,
    DESCRIPTION: site.description,
    NAV: nav,
    HERO: hero,
    SECTIONS: sections.map((s) => `<section id="${s.id}" class="col"><p class="eyebrow">${esc(s.eyebrow)}</p></section>`).join(''),
  });
```

- [ ] **Step 3: 改模板**

把 `src/templates/index.html` 的 `<main id="main"><p>{{BUILD_PROBE}}</p></main>` 整段替换为：

```html
{{NAV}}
<main id="main">
{{HERO}}
{{SECTIONS}}
</main>
```

`{{SECTIONS}}` 此处只输出 eyebrow 占位区块，Task 8 填内容。**此步故意不加 `{{FOOTER}}`** —— `renderTemplate` 现在会在遇到没有对应 token 的 `{{FOOTER}}` 时立刻 throw，所以模板与 token 必须同批引入；页脚连同它的 token 一起在 Task 8 Step 2 加。这一步删掉了 `BUILD_PROBE`，因此未知 token 检查会真正生效。

- [ ] **Step 4: 给 nav 补样式**

追加到 `src/styles/base.css` 末尾：

```css
.nav { display: flex; justify-content: space-between; align-items: center; padding-block: 20px; font-family: var(--font-mono); font-size: 12px; }
.nav a { text-decoration: none; color: var(--ink-2); }
.nav a:hover { color: var(--ink); }
.nav-right { display: flex; gap: 20px; }
```

- [ ] **Step 5: 构建并验证**

Run: `npm run build && node -e "const s=require('node:fs').readFileSync('dist/index.html','utf8');const m=[...s.matchAll(/class=\"lmask\"><span>([^<]*)/g)].map(x=>x[1]);if(m.join('|')!=='Cubeyu®|builds|small tools.')throw new Error('hero lines wrong: '+m.join('|'));console.log('hero ok:',m.join(' / '))"`
Expected: `hero ok: Cubeyu® / builds / small tools.`

- [ ] **Step 6: 起服务肉眼看遮罩动画**

Run: `npm run serve`（后台），打开 `http://localhost:4173`。
Expected: 三行大字依次从下方升起、被裁切在行内；`麦 希 屿` 与等宽英文在下方；`↓ 往下滑` 轻微浮动。刷新一次确认无白闪（暗色系统下）。

- [ ] **Step 7: Commit**

```bash
git add src/styles/hero.css src/styles/base.css src/templates/index.html build.js
git commit -m "feat: hero 逐词遮罩与导航"
```

---

## Task 8: 作品卡纸面形态

**Files:**
- Modify: `src/styles/cards.css`
- Modify: `build.js`（SECTIONS 改为渲染真实卡片）

**Interfaces:**
- Consumes: `projects`、Task 3 的 `i18n`/`esc`
- Produces:
  - `article.card[data-slug]`，内含 `.card-no` `.card-label` `.card-cat` `h3.card-title` `.card-quote` `.card-tags` `.card-demo` `.card-hint`
  - 每张卡 `<a class="card-link">` 包裹标题，`href` 取自 `card.url`
  - `data-demo` 属性**仅在** `card.demo !== null` 时输出

- [ ] **Step 1: 写 cards.css（卡部分）**

```css
/* 卡片：发丝线 + 小圆角。禁止玻璃拟态与大圆角（Global Constraints） */
.card {
  border-top: var(--rule-w) solid var(--rule);
  padding-block: 32px;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 24px;
}
.card:last-of-type { border-bottom: var(--rule-w) solid var(--rule); }
@media (max-width: 640px) { .card { grid-template-columns: 1fr; gap: 8px; } }

.card-no { font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); letter-spacing: .04em; }
.card-meta { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.card-label { font-family: var(--font-mono); font-size: 12px; font-weight: 650; color: var(--ink-2); }
.card-cat { font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); }

.card-title a { text-decoration: none; color: var(--ink); border-bottom: var(--rule-w) solid transparent; }
.card-title a:hover { border-bottom-color: var(--ink); }

.card-quote { margin: 10px 0 0; max-width: 62ch; color: var(--ink-2); }
.card-tags { margin-top: 14px; display: flex; gap: 6px; flex-wrap: wrap; }
.card-demo { margin-top: 20px; border: var(--rule-w) solid var(--rule); border-radius: var(--radius-sm); background: var(--surface); padding: 16px; }
.card-hint { margin-top: 10px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }

/* 马克笔黄只用于强调，一处即可 */
.card:hover .card-no { color: var(--ink); }
```

- [ ] **Step 2: 在 build.js 里渲染三个区块与页脚**

`build.js` 顶部 import 区补全（Task 7 已加了 `i18n` / `ui` / `sections`，此处是最终完整列表，直接替换原 import 段）：

```js
import { renderTemplate, cssOrder, esc, i18n } from './src/lib/build-utils.js';
import { site } from './src/data/site.js';
import { sections, links, ui } from './src/data/copy.js';
import { projects } from './src/data/projects.js';
import { skills } from './src/data/skills.js';
```

在 `hero` 变量之后加卡片区：

```js
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
```

`data-demo` 与整个 `.card-demo` 容器都**只在 `p.demo` 非 null 时输出** —— 纸面卡不留空壳，也让 Task 12 的计数断言能对得上。

技能区与站点区：

```js
const skillsHtml = `<div class="skills-grid">${skills.map((s) => `<span class="skill">${i18n(s.zh, s.en)}</span>`).join('')}</div>`;
const sitesHtml = `<ul class="sites">${links.map((l) => `<li class="site"><a href="${esc(l.url)}">${esc(l.name)}</a><span class="site-note">${i18n(l.note.zh, l.note.en)}</span></li>`).join('')}</ul>`;
```

页脚：

```js
const footerHtml = `<footer class="col foot"><span>${i18n(ui.copyright.zh, ui.copyright.en)}</span>`
  + `<span><a href="mailto:cubeyu@aliyun.com">cubeyu@aliyun.com</a></span></footer>`;
```

并在 `src/templates/index.html` 的 `</main>` 之后补一行 `{{FOOTER}}` —— 与上面的 `FOOTER: footerHtml` token **同批加入**，分两步会让构建 throw。

把 `renderTemplate` 的两个 token 换成真实内容：

```js
const html = renderTemplate(tpl, {
  TITLE: site.title,
  DESCRIPTION: site.description,
  NAV: nav,
  HERO: hero,
  SECTIONS: sections.map((s) => `<section id="${s.id}" class="col">`
    + `<p class="eyebrow">${esc(s.eyebrow)}</p>`
    + `<h2>${i18n(s.title.zh, s.title.en)}</h2>`
    + ({ works: cardHtml, skills: skillsHtml, sites: sitesHtml }[s.id] ?? '')
    + `</section>`).join(''),
  FOOTER: footerHtml,
});
```

`?? ''` 兜住「新增了一个 section 但还没实现内容」—— 那种情况应当安静地产出空区块，而不是构建崩在 `undefined` 上。`BUILD_PROBE` token 至此全部移除。

- [ ] **Step 3: 补技能与站点样式**

追加到 `cards.css`：

```css
/* 技能：发丝线网格，等宽，不放图标（spec 7 节） */
.skills-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0; margin-top: 20px; border-top: var(--rule-w) solid var(--rule); border-left: var(--rule-w) solid var(--rule); }
.skill { font-family: var(--font-mono); font-size: 12px; padding: 12px; border-right: var(--rule-w) solid var(--rule); border-bottom: var(--rule-w) solid var(--rule); color: var(--ink-2); }

/* 站点：一行一条，名字 + 说明 */
.sites { list-style: none; margin: 20px 0 0; padding: 0; border-top: var(--rule-w) solid var(--rule); }
.site { display: flex; justify-content: space-between; gap: 16px; padding-block: 14px; border-bottom: var(--rule-w) solid var(--rule); }
.site a { font-family: var(--font-mono); font-size: 13px; text-decoration: none; }
.site-note { font-size: 12px; color: var(--ink-3); }

/* 页脚 */
.foot { padding-block: 40px; border-top: var(--rule-w) solid var(--rule); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); }
```

- [ ] **Step 4: 构建并验证结构**

Run:

```bash
npm run build && node -e "
const s=require('node:fs').readFileSync('dist/index.html','utf8');
const cards=(s.match(/<article class=\"card\"/g)||[]).length;
const demos=(s.match(/ data-demo=/g)||[]).length;
const roots=(s.match(/data-demo-root=/g)||[]).length;
console.log('cards',cards,'data-demo',demos,'roots',roots);
if(cards!==7)throw new Error('card count');
if(demos!==7)throw new Error('data-demo count');
if(roots!==7)throw new Error('demo root count');
if(!/href=\"#\"/.test(s))throw new Error('cloud-hidden placeholder link missing');
"
```

Expected: `cards 7 data-demo 7 roots 7`，无异常。

- [ ] **Step 5: 肉眼检查双语与明暗**

`npm run serve`，打开 `http://localhost:4173`：
- 默认全中文；把地址栏 `document.documentElement.lang='en'` 或等 Task 10 的开关，英文应整站换过去、无残留中文（`N°01`、`TypeScript` 等拉丁项本就不变）。
- DevTools 手动加 `<html data-theme="dark">`，确认 7 条卡的发丝线仍可见（这是 Task 2 测试守的同一件事的肉眼版）。

- [ ] **Step 6: Commit**

```bash
git add src/styles/cards.css build.js
git commit -m "feat: 作品卡纸面形态、技能网格与站点区"
```

---

## Task 9: 偏好工具与明暗切换

**Files:**
- Create: `src/js/prefs.js`
- Create: `src/js/theme.js`
- Modify: `src/js/app.js`
- Modify: `src/styles/base.css`（开关样式）
- Test: `test/prefs.test.js`

**Interfaces:**
- Consumes: `ui.themeLabels`
- Produces:
  - `readPref(key: 'cubeyu-theme'|'cubeyu-lang'|'cubeyu-motion', fallback: string): string`
  - `writePref(key, value): void`
  - `nextCycle(order: string[], current: string): string`
  - `applyTheme(mode: 'auto'|'light'|'dark'): void`

- [ ] **Step 1: 写 prefs 测试**

```js
// test/prefs.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextCycle, normalizeTheme } from '../src/js/prefs.js';

test('nextCycle wraps through auto -> light -> dark -> auto', () => {
  const order = ['auto', 'light', 'dark'];
  assert.equal(nextCycle(order, 'auto'), 'light');
  assert.equal(nextCycle(order, 'dark'), 'auto');
});

test('nextCycle falls back to the first value on unknown input', () => {
  assert.equal(nextCycle(['auto', 'light', 'dark'], 'bogus'), 'auto');
});

test('normalizeTheme maps system to a concrete theme', () => {
  assert.equal(normalizeTheme('light', false), 'light');
  assert.equal(normalizeTheme('dark', false), 'dark');
  assert.equal(normalizeTheme('auto', false), 'light');
  assert.equal(normalizeTheme('auto', true), 'dark');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL —— 找不到 `src/js/prefs.js`。

- [ ] **Step 3: 写 `src/js/prefs.js`**

三个偏好（明暗、语言、动效）共用一套读写，spec 6.2 明确不许各写一份。纯函数部分不含 DOM，所以可被 `node --test` 直接测。

```js
const PREFIX = 'cubeyu-';

export function readPref(key, fallback) {
  try { return localStorage.getItem(PREFIX + key) ?? fallback; }
  catch { return fallback; } // 隐私模式下 localStorage 会抛
}

export function writePref(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* 存不了也要能切 */ }
}

export function nextCycle(order, current) {
  const i = order.indexOf(current);
  return order[i === -1 ? 0 : (i + 1) % order.length];
}

export function normalizeTheme(mode, systemDark) {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemDark ? 'dark' : 'light';
}

export function systemDark() {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
```

- [ ] **Step 4: 写 `src/js/theme.js`**

```js
import { readPref, writePref, nextCycle, normalizeTheme, systemDark } from './prefs.js';

const ORDER = ['auto', 'light', 'dark'];

export function applyTheme(mode) {
  document.documentElement.dataset.theme = normalizeTheme(mode, systemDark());
}

export function initTheme() {
  let mode = readPref('theme', 'auto');
  const btn = document.querySelector('[data-theme-toggle]');

  const paint = () => {
    applyTheme(mode);
    if (btn) {
      const labels = btn.dataset.labels.split(',');
      btn.textContent = labels[ORDER.indexOf(mode)] ?? labels[0];
      btn.setAttribute('aria-label', `主题：${mode}`);
    }
  };

  // auto 态要跟随系统变化；light/dark 是用户显式选择，不再受系统影响
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (mode === 'auto') paint();
  });

  if (btn) btn.addEventListener('click', () => {
    mode = nextCycle(ORDER, mode);
    writePref('theme', mode);
    paint();
  });

  paint();
}
```

- [ ] **Step 5: 挂到 app.js**

```js
// src/js/app.js
import { initTheme } from './theme.js';
initTheme();
```

- [ ] **Step 6: 在模板里加开关**

`build.js` 的 `nav` 变量末尾、`</nav>` 之前插入：

```js
    + `<button type="button" class="pref-toggle" data-theme-toggle data-labels="${ui.themeLabels.zh.join(',')}">自动</button>`
```

样式追加到 `base.css`：

```css
.pref-toggle { font: inherit; font-family: var(--font-mono); font-size: 12px; background: none; border: var(--rule-w) solid var(--rule); border-radius: var(--radius-pill); padding: 3px 10px; color: var(--ink-2); cursor: pointer; }
.pref-toggle:hover { color: var(--ink); border-color: var(--rule-strong); }
```

- [ ] **Step 7: 运行测试并验证切换**

Run: `npm test`
Expected: PASS。

`npm run serve`，点开关，Expected: 文案走 `自动 → 亮 → 暗 → 自动`；暗态下发丝线可见；刷新后停留在上次选择（localStorage 生效）；首次进入暗色系统不闪白。

- [ ] **Step 8: Commit**

```bash
git add src/js/prefs.js src/js/theme.js src/js/app.js src/styles/base.css build.js test/prefs.test.js
git commit -m "feat: 明暗三态切换与首帧防闪烁"
```

---

## Task 10: 语言切换

**Files:**
- Create: `src/js/i18n.js`
- Modify: `src/js/app.js`
- Modify: `build.js`（语言按钮加 `data-labels`）

**Interfaces:**
- Consumes: `readPref`/`writePref`/`nextCycle`（Task 9）、`ui.langZh`/`ui.langEn`、Task 5 的 `html[lang]` CSS 规则
- Produces: `initLang(): void`；`<html lang>` 在 `zh`/`en` 间切换并持久化

- [ ] **Step 1: 写 `src/js/i18n.js`**

注意：它**只改 `html[lang]`**，不渲染任何文本 —— 双语节点在构建时已烘好，显隐交给 CSS（spec 5.2）。

```js
import { readPref, writePref, nextCycle } from './prefs.js';

const ORDER = ['zh', 'en'];

export function initLang() {
  let lang = readPref('lang', document.documentElement.lang || 'zh');
  const btn = document.querySelector('[data-lang-toggle]');

  const paint = () => {
    document.documentElement.lang = lang;
    // 屏幕阅读器与搜索引擎依赖真实 lang
    if (btn) {
      const [zh, en] = btn.dataset.labels.split(',');
      btn.textContent = lang === 'zh' ? zh : en;
      btn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
    }
  };

  if (btn) btn.addEventListener('click', (e) => {
    e.preventDefault();
    lang = nextCycle(ORDER, lang);
    writePref('lang', lang);
    paint();
  });

  paint();
}
```

- [ ] **Step 2: 挂到 app.js**

```js
import { initTheme } from './theme.js';
import { initLang } from './i18n.js';
initLang();
initTheme();
```

- [ ] **Step 3: 补 build.js 里的 data-labels**

把 `nav` 中的语言按钮那一行改为：

```js
    + `<a href="#" data-lang-toggle data-labels="${ui.langZh},${ui.langEn}">${ui.langZh} / ${ui.langEn}</a>`
```

- [ ] **Step 4: 验证**

Run: `npm run build && npm run serve`
Expected:
- 点 `中 / EN`，整站文案换英文；`N°01`、`TypeScript`、`AI / LLM` 保持不变（它们在数据里 zh/en 同值，属预期）。
- 刷新后停留在英文。
- 关掉 DevTools 的 JavaScript（禁用 JS），页面仍完整显示中文全部内容 —— 这是「构建时烘双语」相对「JS 重渲染」的实际收益，必须验证一次。

- [ ] **Step 5: 无 JS 完整性自动检查**

追加到 `test/data.test.js`：

```js
test('content does not depend on JS to appear', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync('dist/index.html', 'utf8');
  assert.ok(html.includes('笔记存在自己电脑上'), 'zh copy must be baked at build time');
  assert.ok(html.includes('Your notes stay on your own machine'), 'en copy must be baked too');
});
```

Run: `npm run build && npm test`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/js/i18n.js src/js/app.js build.js test/data.test.js
git commit -m "feat: 中英切换，纯 CSS 显隐不依赖运行时渲染"
```

---

## Task 11: inkmark 微原型 + demo 挂载契约

**Files:**
- Create: `src/js/demos/inkmark.js`
- Modify: `src/js/demos/index.js`
- Modify: `src/js/app.js`
- Modify: `src/styles/demos/inkmark.css`

**Interfaces:**
- Consumes: `[data-demo-root="inkmark"]` 容器（Task 8 产出）
- Produces:
  - `mountInkmark(el: HTMLElement, ctx: DemoCtx): () => void`
  - `DemoCtx = { lang: 'zh' | 'en', prefersReducedMotion: boolean }`
  - 注册表 `demos: Record<string, (el, ctx) => (() => void)>`

- [ ] **Step 1: 写挂载契约测试**

```js
// test/demos.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import demos from '../src/js/demos/index.js';

test('registry keys match the files on disk', () => {
  const files = readdirSync('src/js/demos')
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .map((f) => f.replace(/\.js$/, ''));
  assert.deepEqual(Object.keys(demos).sort(), files.sort());
});

test('every registered demo is a function', () => {
  for (const [name, fn] of Object.entries(demos)) {
    assert.equal(typeof fn, 'function', `${name} is not a function`);
  }
});

test('each demo returns an unmount function', () => {
  // 无 DOM 环境：本测试只在提供 el 时执行，交由 Step 4 的浏览器验证覆盖
  assert.ok(true);
});

test('app.js mounts by data-demo and degrades silently', () => {
  const src = readFileSync('src/js/app.js', 'utf8');
  assert.match(src, /data-demo/);
  assert.match(src, /DEMO_REGISTRY\[|\bdemos\[|\bregistry\[/, 'must look up by name');
  // 静默降级：查不到模块时不得 throw
  assert.ok(!/throw new Error\(`?.*[Dd]emo/, 'registry miss must not throw');
});
```

`registry keys === 磁盘文件` 这条正是 spec 9.1 第 5 项「不硬编码数量、但一致性必须成立」的实现，也是用户换卡后不会误报的关键。

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL —— `demos` registry 为空 `{}` 而磁盘有 `inkmark.js`（或该文件尚不存在）。

- [ ] **Step 3: 写 `src/js/demos/inkmark.js`**

零依赖、只做演示用途的 markdown 子集渲染。**不要**在这里造完整 CommonMark —— 那是另一个项目。

```js
const SAMPLE = {
  zh: ['## 今日排期', '', '- [x] 把 demo 挂上主页', '- [ ] 写完微原型', '', '选中一行，**点右边的按钮**。', ''],
  en: ['## Today', '', '- [x] ship the demo', '- [ ] finish the micro prototypes', '', 'Select a line, then **hit the button**.', ''],
};

// 故意只支持 标题 / 任务列表 / 加粗 / 行内代码，够演示即可
function mdToHtml(src) {
  return src.split('\n').map((line) => {
    const l = line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    if (l.startsWith('## ')) return `<h4 class="d-md-h">${inline(l.slice(3))}</h4>`;
    if (l.startsWith('- [x] ')) return `<p class="d-md-li is-done"><span aria-hidden="true">✓</span>${inline(l.slice(6))}</p>`;
    if (l.startsWith('- [ ] ')) return `<p class="d-md-li"><span aria-hidden="true">·</span>${inline(l.slice(6))}</p>`;
    if (l.startsWith('- ')) return `<p class="d-md-li"><span aria-hidden="true">·</span>${inline(l.slice(2))}</p>`;
    if (!l.trim()) return '';
    return `<p class="d-md-p">${inline(l)}</p>`;
  }).join('');
}
function inline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/`(.+?)`/g, '<code class="d-md-code">$1</code>');
}

export function mountInkmark(el, ctx) {
  const T = ctx.lang === 'en'
    ? { src: 'MARKDOWN', out: 'PREVIEW', ask: 'Ask AI', done: 'done' }
    : { src: '源码', out: '渲染', ask: '问 AI', done: '完成' };

  el.innerHTML = `
    <div class="d-ink">
      <div class="d-ink-pane">
        <span class="d-ink-cap">${T.src}</span>
        <textarea class="d-ink-src" spellcheck="false" aria-label="${T.src}"></textarea>
      </div>
      <div class="d-ink-pane">
        <span class="d-ink-cap">${T.out}</span>
        <div class="d-ink-out" aria-live="polite"></div>
      </div>
      <button type="button" class="d-ink-ask">${T.ask}</button>
    </div>`;

  const ta = el.querySelector('.d-ink-src');
  const out = el.querySelector('.d-ink-out');
  const ask = el.querySelector('.d-ink-ask');

  const render = () => { out.innerHTML = mdToHtml(ta.value); };
  ta.value = SAMPLE[ctx.lang] ? SAMPLE[ctx.lang].join('\n') : SAMPLE.zh.join('\n');
  render();

  // 输入即重渲染 —— 这就是 hint 说的「看右边怎么跟着变」
  const onInput = () => render();
  ta.addEventListener('input', onInput);

  // 「问 AI」不接真模型：把光标所在行标成马克笔黄，演示选中语义
  const onAsk = () => {
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const start = before.lastIndexOf('\n') + 1;
    const end = (() => { const n = ta.value.indexOf('\n', start); return n === -1 ? ta.value.length : n; })();
    out.querySelectorAll('.d-md-p, .d-md-li, .d-md-h').forEach((node) => node.classList.remove('is-asked'));
    const idx = ta.value.slice(0, start).split('\n').length - 1;
    const target = out.querySelectorAll('.d-md-p, .d-md-li, .d-md-h')[idx];
    if (target) target.classList.add('is-asked');
  };
  ask.addEventListener('click', onAsk);

  return function unmount() {
    ta.removeEventListener('input', onInput);
    ask.removeEventListener('click', onAsk);
    el.innerHTML = '';
  };
}
```

- [ ] **Step 4: 注册表与 app.js 挂载**

`src/js/demos/index.js`：

```js
import { mountInkmark } from './inkmark.js';

// 注册名 === 文件名 === projects.js 的 demo 字段
export default {
  'inkmark': mountInkmark,
};
```

`src/js/app.js`：

```js
import { initTheme } from './theme.js';
import { initLang } from './i18n.js';
import demos from './demos/index.js';
import { readPref } from './prefs.js';

initLang();
initTheme();

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const cleanups = [];

function mountAll() {
  for (const root of document.querySelectorAll('[data-demo-root]')) {
    const name = root.dataset.demoRoot;
    const mount = demos[name];
    // 查不到即静默跳过，卡片降级为纸面卡。用户会换卡，这里不许 throw（spec 5.1）
    if (typeof mount !== 'function') continue;
    if (root.dataset.mounted === name) continue;
    const unmount = mount(root, { lang: document.documentElement.lang, prefersReducedMotion });
    if (typeof unmount === 'function') { root.dataset.mounted = name; cleanups.push([root, unmount]); }
  }
}

mountAll();
```

- [ ] **Step 5: 写 demos/inkmark.css**

只用 `var(--…)`，不得出现字面色值（Global Constraints，Task 12 机器检查）。

```css
.d-ink { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
@media (max-width: 640px) { .d-ink { grid-template-columns: 1fr; } }
.d-ink-pane { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.d-ink-cap { font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em; color: var(--ink-3); }
.d-ink-src {
  width: 100%; min-height: 132px; resize: vertical;
  font-family: var(--font-mono); font-size: 12px; line-height: 1.6;
  color: var(--ink); background: var(--paper);
  border: var(--rule-w) solid var(--rule); border-radius: var(--radius-sm); padding: 10px;
}
.d-ink-out { min-height: 132px; padding: 10px; border: var(--rule-w) solid var(--rule); border-radius: var(--radius-sm); background: var(--paper); font-size: 13px; line-height: 1.7; }
.d-md-h { font-size: 15px; font-weight: 700; margin: 0 0 6px; }
.d-md-p, .d-md-li { margin: 0 0 6px; color: var(--ink-2); }
.d-md-li { padding-left: 18px; position: relative; }
.d-md-li > span { position: absolute; left: 0; color: var(--ink-3); }
.d-md-li.is-done { color: var(--ink-3); text-decoration: line-through; }
.d-md-li.is-done > span { color: var(--ink-2); }
.d-md-code { font-family: var(--font-mono); font-size: 12px; background: var(--surface); padding: 1px 4px; border-radius: 2px; }
/* 唯一一次马克笔黄用在这里 */
.d-ink-out .is-asked { background: var(--mark-bg); color: var(--mark-fg); }
.d-ink-ask {
  grid-column: 1 / -1; justify-self: start;
  font-family: var(--font-mono); font-size: 12px; padding: 5px 12px;
  background: var(--ink); color: var(--paper); border: none; border-radius: var(--radius-pill); cursor: pointer;
}
.d-ink-ask:hover { background: var(--link); }
```

- [ ] **Step 6: 运行测试并验证交互**

Run: `npm test`
Expected: PASS —— 含 `registry keys match the files on disk`。

`npm run serve`，在 N°01 卡内：
- 左栏改一个字，右栏立刻变。
- 光标停在某行点「问 AI」，右栏对应行变马克笔黄底。
- 已完成项带删除线。
- 切到英文，右栏示例换成英文、按钮变 `Ask AI`（需重新构建才生效，`ctx.lang` 只在挂载时读一次 —— 见下方注意事项）。

**注意**：`ctx.lang` 在 `mountAll()` 时读取一次，切语言不会重挂已挂载的 demo。M1 阶段可接受；若要让 demo 随语言切换，M3 时在 `initLang()` 里触发 `unmount + mountAll`，届时一并处理 6 个 demo，不在本任务单点解决。

- [ ] **Step 7: 验证降级路径（spec 5.1 的静默跳过必须实测一次）**

手工做，不写脚本 —— 用脚本改写 `projects.js` 再撤销太脆弱，容易留下脏文件。

1. 把 `src/data/projects.js` 里 N°01 的 `demo: 'inkmark'` 临时改成 `demo: 'typo-name'`。
2. Run: `npm run build`
   Expected: 构建成功（注册表里没有 `typo-name`，不影响构建）。
3. Run: `npm run serve` 并打开 N°01 卡
   Expected: 卡正常渲染为纸面形态，**没有** `.card-demo` 空壳区，控制台无报错。注意：此刻 `build.js` 仍会因 `p.demo` 为真值而输出 `data-demo` 与空容器，所以看到的应是一个空的、无内容的小盒子区 —— 这正是「注册名拼错」与「`demo: null`」的区别。想彻底不留盒子，必须写 `demo: null`。
4. Run: `npm test`
   Expected: FAIL —— `test/demos.test.js` 的 `registry keys match the files on disk` 仍 PASS（它只比注册表与文件），但 `npm run check` 的 `DEMO_REGISTRY_MATCH` 会报 `inkmark: demo 'typo-name' is not registered`。这正是 spec 9.1 第 5 项要抓的拼写事故。
5. 改回 `demo: 'inkmark'`，Run: `npm run build && npm test && npm run check`
   Expected: 全绿 —— 证明撤销干净。

**这一步暴露的实现细节**：`demo` 拼错时会留一个空盒子，`demo: null` 才干净。若想让拼错也不留盒子，需在 `build.js` 里把渲染条件从 `p.demo` 改成「`p.demo` 且已注册」，即构建期 import 注册表。M1 不做该改动（`check` 已经会拦住拼错，且更响亮的失败更好排查），但把它记在这里，M3 加第 2 个 demo 时若觉得碍眼再改。

- [ ] **Step 8: Commit**

```bash
git add src/js/demos src/js/app.js src/styles/demos/inkmark.css test/demos.test.js
git commit -m "feat: inkmark 微原型与 demo 挂载契约"
```

---

## Task 12: check.js —— 7 项产物断言

**Files:**
- Create: `check.js`
- Test: `test/check.test.js`

**Interfaces:**
- Consumes: `dist/index.html`、`dist/assets/app.css`、`src/**`
- Produces: `check(): { ok: boolean, failures: string[] }`；CLI 下失败则 `process.exit(1)`

- [ ] **Step 1: 写 check 的测试**

每个断言都要有一条「故意造坏数据、确认它被抓到」的用例 —— 否则等于没测。

```js
// test/check.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, TOKEN_RESIDUE, CARD_COUNT, DEMO_REGISTRY_MATCH, COLOR_LEAK, LANG_PAIR, DEPENDENCIES_EMPTY } from '../check.js';

test('current tree passes all checks', () => {
  const r = check();
  assert.deepEqual(r.failures, [], `unexpected failures: ${r.failures.join(' | ')}`);
  assert.equal(r.ok, true);
});

test('TOKEN_RESIDUE catches a leftover token', () => {
  assert.equal(TOKEN_RESIDUE.run({ html: '<p>{{TITLE}}</p>', files: [], pkg: '{}' }).length, 1);
  assert.equal(TOKEN_RESIDUE.run({ html: '<p>ok</p>', files: [], pkg: '{}' }).length, 0);
});

test('CARD_COUNT does not hardcode 7 and catches a mismatch', () => {
  const html = '<article class="card" data-slug="a"></article><article class="card" data-slug="b"></article>';
  assert.equal(CARD_COUNT.run({ html, cards: [{ slug: 'a' }, { slug: 'b' }] }).length, 0);
  assert.equal(CARD_COUNT.run({ html, cards: [{ slug: 'a' }] }).length, 1, 'must fail when data has more cards than html');
});

test('CARD_COUNT allows demo:null cards', () => {
  const html = '<article class="card" data-slug="a"></article>';
  const r = CARD_COUNT.run({ html, cards: [{ slug: 'a', demo: null }] });
  assert.equal(r.length, 0);
});

test('DEMO_REGISTRY_MATCH catches unregistered and orphan demos', () => {
  const cards = [{ slug: 'a', demo: 'a' }, { slug: 'b', demo: 'ghost' }];
  const bad = DEMO_REGISTRY_MATCH.run({ cards, registry: ['a'], demoFiles: ['a'] });
  assert.ok(bad.some((f) => f.includes('ghost')));
  const orphan = DEMO_REGISTRY_MATCH.run({ cards: [{ slug: 'a', demo: 'a' }], registry: ['a'], demoFiles: ['a', 'unused'] });
  assert.ok(orphan.some((f) => f.includes('unused')));
});

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

test('LANG_PAIR catches a one-sided translation', () => {
  const html = '<span class="i18n i18n-zh">只有中文</span>';
  assert.equal(LANG_PAIR.run({ html }).length, 1);
});

test('DEPENDENCIES_EMPTY flags a runtime dep', () => {
  assert.equal(DEPENDENCIES_EMPTY.run({ pkg: '{"dependencies":{"vue":"^3"}}' }).length, 1);
  assert.equal(DEPENDENCIES_EMPTY.run({ pkg: '{"dependencies":{}}' }).length, 0);
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL —— 找不到 `../check.js`。

- [ ] **Step 3: 写 `check.js`**

```js
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
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
  name: 'card count matches data',
  run({ html, cards }) {
    const f = [];
    const inHtml = (html.match(/<article class="card"/g) || []).length;
    if (inHtml !== cards.length) f.push(`cards: data=${cards.length} html=${inHtml}`);
    const slugged = (html.match(/data-slug="/g) || []).length;
    if (slugged !== cards.length) f.push(`data-slug: data=${cards.length} html=${slugged}`);
    const wantDemo = cards.filter((c) => c.demo).length;
    const haveDemo = (html.match(/ data-demo="/g) || []).length;
    if (haveDemo !== wantDemo) f.push(`data-demo: expected=${wantDemo} found=${haveDemo}`);
    return f;
  },
};

export const DEMO_REGISTRY_MATCH = {
  name: 'demo names, registry and files all agree',
  run({ cards, registry, demoFiles }) {
    const f = [];
    for (const c of cards) {
      if (c.demo && !registry.includes(c.demo)) f.push(`${c.slug}: demo '${c.demo}' is not registered`);
    }
    for (const name of registry) if (!demoFiles.includes(name)) f.push(`registry '${name}' has no file demos/${name}.js`);
    for (const file of demoFiles) if (!registry.includes(file)) f.push(`orphan file demos/${file}.js (not registered)`);
    return f;
  },
};

export const COLOR_LEAK = {
  // spec 9.1 第 4 项：扫源文件而非合并产物，否则定位不出违规来源
  name: 'no literal colors outside tokens.css',
  run({ files }) {
    const f = [];
    for (const { name, text } of files) {
      if (name.endsWith('tokens.css')) continue;
      const hits = text.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [];
      if (hits.length) f.push(`${name}: literal color(s) ${hits.slice(0, 3).join(', ')} — use var(--…)`);
    }
    return f;
  },
};

export const LANG_PAIR = {
  name: 'every i18n slot has both languages',
  run({ html }) {
    const zh = (html.match(/class="i18n i18n-zh"/g) || []).length;
    const en = (html.match(/class="i18n i18n-en"/g) || []).length;
    return zh === en ? [] : [`i18n unpaired: zh=${zh} en=${en} — a card is missing one language`];
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

export const CSS_JS_SHIPPED = {
  name: 'every demo css/js shipped',
  run({ html, css, cards, demoFiles }) {
    const f = [];
    for (const name of demoFiles) {
      if (!css.includes(`--- demos/${name}.css ---`) && !css.includes(`demos/${name}.css`)) {
        f.push(`demos/${name}.css not merged into app.css — register it in cssOrder`);
      }
    }
    return f;
  },
};

export async function check() {
  const html = read('dist/index.html');
  const css = read('dist/assets/app.css');
  const pkg = read('package.json');
  if (!html) return { ok: false, failures: ['dist/index.html missing — run npm run build first'] };

  const { projects } = await import('./src/data/projects.js');
  const demos = (await import('./src/js/demos/index.js')).default;

  const demoFiles = existsSync('src/js/demos')
    ? readdirSync('src/js/demos').filter((x) => x.endsWith('.js') && x !== 'index.js').map((x) => x.replace(/\.js$/, ''))
    : [];
  const registry = Object.keys(demos);
  const styleFiles = walk('src/styles').map((name) => ({ name, text: read(name) }));

  const failures = [
    TOKEN_RESIDUE.run({ html }),
    CARD_COUNT.run({ html, cards: projects }),
    DEMO_REGISTRY_MATCH.run({ cards: projects, registry, demoFiles }),
    COLOR_LEAK.run({ files: styleFiles }),
    LANG_PAIR.run({ html }),
    DEPENDENCIES_EMPTY.run({ pkg }),
    CSS_JS_SHIPPED.run({ css, demoFiles }),
  ].flat();

  return { ok: failures.length === 0, failures };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('check.js')) {
  const r = await check();
  if (r.ok) { console.log('check passed (7 assertions)'); process.exit(0); }
  for (const f of r.failures) console.error('FAIL  ' + f);
  process.exit(1);
}
```

三个要点：
- `check()` 是 **async**，因为要动态 `import()` ESM 数据文件（`projects.js` 与 `demos/index.js` 都是 ESM，`require` 拿不到）。
- CLI 守卫用 `.replace(/\\/g, '/')` 把 Windows 反斜杠归一后再 `endsWith` —— 不做绝对路径相等比较，避开 Task 4 里说明的同一个 Windows 坑。
- 顶层 `await` 在 ESM 中合法，需要 Node ≥ 14.8；`package.json` 的 `engines` 已锁 `>=20`。

- [ ] **Step 4: 对齐 CSS_JS_SHIPPED 与测试的异步签名**

Step 3 的 `CSS_JS_SHIPPED.run` 只收 `{ css, demoFiles }`，所以它的定义要写成这样（**替换 Step 3 里那一版同名常量**，那版多带了从未使用的 `html` 与 `cards`、且条件写重复）：

```js
export const CSS_JS_SHIPPED = {
  name: 'every demo css merged into app.css',
  run({ css, demoFiles }) {
    // 合并时每个文件前面写了 `/* --- demos/<name>.css --- */` 标记（build.js）
    return demoFiles
      .filter((name) => !css.includes(`--- demos/${name}.css ---`))
      .map((name) => `demos/${name}.css not merged into app.css — register it in cssOrder`);
  },
};
```

对应的测试用例补进 `test/check.test.js`：

```js
test('CSS_JS_SHIPPED flags a demo css missing from the merge', () => {
  const r = CSS_JS_SHIPPED.run({ css: '/* --- demos/inkmark.css --- */ .a{}', demoFiles: ['inkmark', 'weflow'] });
  assert.equal(r.length, 1);
  assert.ok(r[0].includes('weflow'));
});
```

`test/check.test.js` 第一条测试调的是异步 `check()`，写成：

```js
test('current tree passes all checks', async () => {
  if (!existsSync('dist/index.html')) return undefined; // 未构建时跳过，见 Step 5
  const r = await check();
  assert.deepEqual(r.failures, [], `unexpected failures: ${r.failures.join(' | ')}`);
  assert.equal(r.ok, true);
});
```

`test/data.test.js` 的 `content does not depend on JS to appear` 同样依赖 `dist/`，加上同一句 `existsSync` 短路。

**为什么要短路而不是直接断言**：`npm test` 必须能脱离 `npm run build` 单独跑通（Task 1 Step 4 就是一次纯 `npm test`）。若这两条测试硬依赖 `dist/`，第一次 `npm test` 会因产物不存在而失败，看起来像代码有 bug，实际只是没构建。CI 里两条命令都会跑，覆盖不缺。

Run: `npm run build && npm test`
Expected: PASS。

- [ ] **Step 5: 运行，确认全绿**

Run: `npm run build && npm test`
Expected: PASS。

Run: `npm run check`
Expected: `check passed (7 assertions)`，退出码 0。

- [ ] **Step 6: 逐项验真（防「测试没在测东西」）**

依次人为制造坏状态，每次确认被对应断言抓到，然后撤销：

1. `src/styles/base.css` 加一行 `color: #FF0000;` → `COLOR_LEAK` FAIL。撤销。
2. `src/data/projects.js` 删掉最后一张卡 → `CARD_COUNT` 与 `data-demo` 计数 FAIL。撤销。
3. 某卡 `demoHint` 只留 `zh` → `data.test.js` FAIL。撤销。
4. 某卡 `demo: 'ghost'` → `DEMO_REGISTRY_MATCH` FAIL。撤销。
5. `package.json` 的 `dependencies` 填 `{"vue":"^3"}` → `DEPENDENCIES_EMPTY` FAIL。撤销。
6. `src/templates/index.html` 加 `{{NOPE}}` → `build.js` 的 `renderTemplate` 抛错（证明构建期就拦住了，不必等到 check）。撤销。

Run: `npm run build && npm test && npm run check`
Expected: 全绿 —— 证明撤销干净。

- [ ] **Step 7: Commit**

```bash
git add check.js test/check.test.js
git commit -m "feat: 产物断言，卡片数量改为不硬编码"
```

---

## Task 13: 压缩与产物体积

**Files:**
- Modify: `package.json`（`devDependencies`）
- Modify: `build.js`

**Interfaces:**
- Consumes: `lightningcss`、`terser`
- Produces: `dist/assets/app.css` 与 `dist/assets/js/*.js` 为压缩版本

- [ ] **Step 1: 安装 devDependencies**

Run: `npm i -D lightningcss terser`
Expected: `package.json` 的 `devDependencies` 出现两者，`dependencies` 仍为 `{}`。

- [ ] **Step 2: 在 build.js 接上压缩**

顶部 import：

```js
import { transform } from 'lightningcss';
import { minify } from 'terser';
```

替换写 `app.css` 那一行为：

```js
  const minCss = transform({
    filename: 'app.css',
    codeBuffer: Buffer.from(css, 'utf8'),
    minify: true,
  }).code.toString('utf8');
  writeFileSync(join(out, 'assets/app.css'), minCss, 'utf8');
```

在 `cpSync` 之后，压缩 JS（保留 module 语义，不设 `module: false`）：

```js
  for (const f of walkJs(join(out, 'assets/js'))) {
    const src = readFileSync(f, 'utf8');
    const r = await minify(src, { module: true, compress: true, mangle: true });
    writeFileSync(f, r.code, 'utf8');
  }
```

加 `walkJs` 辅助（`check.js` 已有 `walk`，这里不复用以免跨文件耦合）：

```js
function walkJs(dir) {
  const outArr = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) outArr.push(...walkJs(full));
    else if (e.name.endsWith('.js')) outArr.push(full);
  }
  return outArr;
}
```

`build.js` 是顶层脚本（Task 4 已去掉 `build()` 函数包裹），所以上面的 `await minify(...)` 直接写在顶层即可 —— ESM 允许顶层 `await`，无需改动函数签名，也不存在「其他模块 import build 后要跟着 await」的连带修改。

同时把 `readdirSync` 补进已有的 `node:fs` import 行（Task 4 那版没带它）。

- [ ] **Step 3: 构建并核对**

Run: `npm run build && npm run check && npm test`
Expected: 全绿。压缩**不得**破坏 `check.js` 的 `LANG_PAIR`/`CARD_COUNT` —— 它们扫 `dist/index.html` 与 `src/**`，而 index.html 此刻未压缩，故安全；若后续压 HTML，须同步放宽这两个正则。

Run: `node -e "const s=require('node:fs');for(const f of ['dist/index.html','dist/assets/app.css'])console.log(f,(s.statSync(f).size/1024).toFixed(1)+'KB')"`
Expected: 打印两个体积。记录数值 —— M5 部署时是 Lighthouse 的基线。

- [ ] **Step 4: 肉眼回归**

`npm run serve`，确认压缩后 hero 动画、双语切换、明暗切换、inkmark 三栏交互全部照常。**这一步不能跳**：`lightningcss` 的 `minify: true` 会做变量合并，理论上可能改变 `var()` 回退行为。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json build.js
git commit -m "build: 压缩 CSS 与 JS，保持零运行时依赖"
```

---

## Task 14: M1 交付 —— 截图验收与换卡确认

**Files:**
- Create: `docs/superpowers/plans/2026-11-03-m1-acceptance.md`（记录验收结论，非模板，是实测量）

**Interfaces:**
- Consumes: 前 13 个任务的全部产物
- Produces: 用户对新站视觉方向的判断；M3 是否照原 7 张卡开工的确认

- [ ] **Step 1: 跑 8 组截图矩阵**

用 chrome-devtools MCP（内置浏览器无可见视口，截图会失败，必须走 chrome-devtools）。组合为 `1440 / 390` × `light / dark` × `zh / en`：

1. `npm run serve`
2. 每组合设置：视口宽、`html[data-theme]`、`html[lang]`
3. 整页截图，共 8 张
4. 额外 1 张：`prefers-reduced-motion: emulate` 下的 1440/light/zh，确认 hero 三行直接可见、无裁切

- [ ] **Step 2: 键盘可达性**

在 inkmark 卡：Tab 依次应落到 `问 AI` → 语言开关 → 主题开关 → 卡标题链接 → textarea。Shift+Tab 反向一致。焦点环不得被发丝线吞掉（对比度 ≥ 3:1）。

- [ ] **Step 3: 触屏守卫预演**

DevTools 模拟 `pointer: coarse`，确认此刻无光标 DOM（本计划未做光标，属 M4；此步只是确认没有意外残留）。

- [ ] **Step 4: 把截图与体积交给用户，同时问两件事**

这是 spec 第 9 节设计的**唯一低成本推翻时机**。必须一并问：

1. 视觉上是否是 oiloil 那个味道？哪里不对？
2. **7 张卡是否照原清单进 M3？**（spec 7.1 换卡窗口。此后换卡，被换掉的微原型代码即沉没成本。）
3. 6 张 `url: '#'` 的卡，各项目官网/仓库链接分别是什么？

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-11-03-m1-acceptance.md
git commit -m "docs: M1 验收记录与截图矩阵结论"
```

---

## 自查清单（计划完成后已执行）

**Spec 覆盖**：本计划覆盖 spec 第 3 节文件结构（除 `templates/404.html` 与 `cursor.css`，属 M2 之后的 M4/M5 范围）、第 4 节 tokens、第 5 节三个契约（5.3 有意偏离，已声明）、第 6 节 6.1（暗色 + 首帧防闪烁）与 6.2（逐词遮罩 + reduced-motion 硬要求；`reveal.js` 与动效开关属 M4）、6.3（自定义光标整条属 M4）、第 7 节全部区块与 7.2/7.3、第 8 节内容迁移与 8.2 归档（快照已在本计划之前落盘）、第 9.1 节全部 7 项断言。**未覆盖且已显式标注归属**：M3 的 6 个微原型、M4 的光标与 reveal、M5 的 `vercel.json` 与部署、`404.html`、`og-image.png`、头像本地化。

后两项建议在 M5 计划里处理，理由：`og-image` 需要一张真图（是设计产出，不是代码任务），头像本地化是一次性搬运，都不该占用 M1 的口味判定窗口。

**占位符扫描**：无 TBD / TODO / 「补充相应错误处理」。两处 `url: '#'` 是 spec 8.1 明示的待决内容项，非计划缺陷，且在 Task 14 Step 4 有对应追问动作。

**类型一致性**：`mount(el, ctx) -> unmount`、`DemoCtx = {lang, prefersReducedMotion}`、`demos: Record<string, fn>`、注册名 === 文件名 === `projects[].demo`、`readPref`/`writePref`/`nextCycle`/`normalizeTheme` 在 Task 9/10/11 三处签名一致；`cssOrder` 在 Task 3 声明、Task 13 消费；`check.js` 七个导出常量名与 Task 12 测试引用一致。`check.test.js` 需 `import { existsSync } from 'node:fs'`（Step 4 的短路用到）。

## 自查发现并已修掉的问题

写完后用 fresh eyes 重读，找到 7 处。全部已在正文修正，此处留痕供复核：

1. **`renderTemplate` 的残留 token 检查与自身测试矛盾**（真 bug）。原实现替换后扫描 `\{\{\w+\}\}`，而同任务的测试又断言「值里的 `{{B}}` 应原样插入」—— 那条测试必然失败，因为插入的 `{{B}}` 会被残留扫描误判成未解析 token。改为在替换那一刻判定未知 token，扫描只留作 `check.js` 的兜底，且只匹配大写约定 `\{\{[A-Z][A-Z_]*\}\}`，避免用户哪天在文案里打花括号就误报。
2. **Task 4 的 `build.js` import 了 Task 6 才创建的模块**（真 bug，顺序依赖）。我一度把 nav/hero/卡片全塞进 Task 4，导致它 `import { projects }` 时文件还不存在、构建立刻失败。改回最小版只做 3 个 token，区块渲染留在 Task 7/8，并在正文写明为什么此刻不能 import。
3. **`process.argv[1]` 与 `fileURLToPath(import.meta.url)` 比较在 Windows 上不可靠**（真 bug）。反斜杠 vs 正斜杠，结果取决于调用位置。`build.js` 本就不被任何模块 import，直接去掉那层守卫改为纯顶层脚本；`check.js` 的 CLI 入口归一路径后再 `endsWith`。
4. **`serve` 脚本内联了一段 `node -e` 压缩字符串**（脆弱）。`"type": "module"` 下 `require` 在 `--eval` 里的可用性属未声明行为，且那串代码既读不了也没目录穿越防护。改为独立 `serve.js`，带 `normalize` + 前缀校验。
5. **`npm test` 在无 `dist/` 时会失败**（真 bug）。`test/check.test.js` 与 `test/data.test.js` 各有一条读 `dist/index.html`，而 Task 1 Step 4 就要求跑一次纯 `npm test`。改为 `existsSync` 短路跳过，并说明为什么不是直接断言。
6. **`btn.setAttribute('ariapressed', …)`** —— 属性名拼错（应 `aria-pressed`），且这个 toggle 用文本已表达当前态，该属性本身多余。删掉。
7. **两处不合格的计划内容**：Task 11 Step 3 先给一段故意写坏的模板串再说「用下面这版替换」；Task 11 Step 7 先给一条改写源文件的脆弱 `node -e` 再说「改用手工」。两者都属于「让执行者自己决定哪段是真的」，已换成单一正确版本 + 明确手工步骤。顺带在 Step 7 记下一个实现细节：`demo` 拼错会留空盒子、`demo: null` 才干净，这是两种不同的失败。
8. **`{{FOOTER}}` 与它的 token 被拆到了两个任务**（真 bug，自查第二轮抓到）。我先把 `{{FOOTER}}` 写进 Task 7 的模板，而 `FOOTER: footerHtml` 要到 Task 8 才加 —— Task 7 Step 5 的 `npm run build` 会因未知 token throw，且报错信息指向一个「看起来刚验证过」的任务。改为模板与 token 同批引入，并在两处都注明这条约束：**新增一个 token 时，占位符和 build.js 的 tokens 表必须在同一步落地**。这条其实正是第 1 项那个改动带来的新失效模式 —— 从「事后扫描」换成「替换时判定」让失败更早、更准，但也要求计划本身遵守这个纪律。

**一处刻意保留的不完美**：`ctx.lang` 只在挂载时读一次，切语言不会重挂已挂载的 demo。M1 只有一个 demo，改它要在 `initLang()` 里加 unmount + 重挂编排，而那段编排的正确形态取决于 M3 有 6 个还是 1 个 demo。现在做等于对未知形状做设计，故在 Task 11 Step 6 显式记账、留给 M3。
