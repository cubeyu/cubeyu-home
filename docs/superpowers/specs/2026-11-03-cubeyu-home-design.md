# cubeyu-home 设计文档

日期：2026-11-03
状态：待用户复核
参照站：https://www.oiloil.org/ （Oil® — 欧呦）
内容源：`D:\code\other\Simple-Homepage`（线上 `techisle.top`）、`https://portfolio.techisle.top`
参考实现：`D:\code\other\MoeHome`

---

## 1. 目标与非目标

### 目标

做一个单页个人主页，视觉语言完整照搬 oiloil.org 的瑞士编辑式极简风，内容全部来自麦希屿的现有站点。核心是 7 张作品卡，每张卡内嵌一个**真能操作的 CSS/JS 微原型**，而不是截图。

"观赏感"是唯一的成功标准，且由用户看截图主观判定。因此本设计的里程碑顺序（第 9 节）刻意把 hero + 1 张卡放在最前面，让口味偏差在第一轮就暴露，而不是做完 7 张才发现不像。

### 非目标（本轮明确不做）

- 不做 MoeHome 的 Memos 朋友圈、Waline/Artalk 留言板、Meting 音乐播放器、RSS 订阅、GitHub 抓星。这些依赖外部服务，与单页极简风冲突。
- 不做 8 套主题切换。只有明暗两套。
- 不做多页面。只有首页 + 一个极简 404。
- 不修改 `Simple-Homepage` 和 `MoeHome` 两个现有仓库的任何文件。
- 不把新站直接上线到 `techisle.top`。先跑 Vercel 预览域。

---

## 2. 决策记录

以下 6 个岔路已与用户逐条确认，含被否决的方案与理由。记录在此是为了实现阶段不再重新讨论。

| # | 决策 | 被否决的替代方案与否决理由 |
|---|---|---|
| 1 | 视觉另起炉灶，不沿用 MoeHome 的 `style.css` | 「保留 MoeHome 骨架只换皮」被否：MoeHome 是二次元玻璃拟态 + 网格视差 + 终端打字机，与编辑式极简对立，保留骨架等于跟自己的样式系统搏斗。 |
| 2 | 单页 + 7 作品卡，不接外部服务 | 「保留 Memos/Waline」被否：需要自托管服务，且与极简排版违和。 |
| 3 | 完整照搬 oiloil 的白底 + 马克笔黄 `#FFE28A` + 无衬线大字 | 「oiloil 骨架 + 水墨基因（宣纸白 + 印章朱红）」被否。注意：这是用户在看到明确对比后主动否决推荐方案的，选择忠于参照站而非已有品牌。 |
| 4 | 7 张卡全部做可交互微原型 | 「3 张微原型 + 4 张纸面卡」被否。 |
| 5 | 干净新仓库，MoeHome 仅当参考实现 | 「在 MoeHome 仓库内删死代码」被否：`scripts/build.js` 约 3100 行为 4 页面 + 5 个外部模块服务，删比重写更易引入坏件。 |
| 6 | 先 Vercel 预览域，验收后再切 `techisle.top`；`portfolio.techisle.top` **退役**（见 8.2） | 「直接替换线上站」被否：验收前没有退路。原方案曾定为「portfolio 保留不动」，用户在复核 spec 时改判为下线，理由是它是古风站、与新风格无关。 |
| 7 | demo 组织采用注册表模式（方案 A） | 「每卡自包含（方案 B）」被否：文案渗进行为层，`data/projects.js` 不再具备完整卡片视图，双语与暗色的改动点会散开。 |
| 8 | 双语采用构建时烘进两个文本节点 + `html[lang]` 纯 CSS 切换 | 「JS 运行时重渲染」被否：静态站不应依赖 JS 才能读到内容，且不利 SEO。 |
| 9 | 7 条作品引文全部改写为口语体 | 「引文保留文言 + 仅提示语口语」被否，用户看过三条对照样例后仍选择全改。 |
| 10 | **清除全部古风元素**：身份标签去掉「代码诗人」「以墨为笔，以码为诗」，单字印章（墨/流/锚/方/热/键/隐）不作为视觉元素出现，一律用 `N°01`–`N°07` | 用户在复核 spec 时追加要求「全面使用 oiloil 风格」。注：单字印章在 2 号决策被否「水墨基因」时已出局，此处只是把它从内容层也彻底清掉。 |
| 11 | 站点标题对齐 oiloil 实测格式 `Oil® — 欧呦`，取 `麦希屿® — cubeyu`；description 对齐其句式 | 旧值「cubeyu の水墨小筑」含「水墨」，与新视觉不符，属内容欺骗（见 8 节）。 |

---

## 3. 技术形态

零运行时依赖的静态站 + 一个约 150 行的 `build.js`。运行时依赖数量必须为 0 —— `package.json` 的 `dependencies` 字段应为空，第三方包只允许出现在 `devDependencies`（压缩用）。

构建产物 `dist/` 是一个可直接扔到任何静态托管的目录，无 Node 运行时要求。

### 文件结构

```
cubeyu-home/
  archive/
    portfolio-2026-11-03.html  # 子站退役前抓的快照，唯一内容副本（见 8.2）
  src/
    data/
      site.js          # 身份、导航、页脚、SEO（不含 analytics：见 8 节，走 Vercel 项目设置）
      projects.js      # 7 张作品卡：双语、标签、demo 注册名、demo 数据
      skills.js        # 13 项技能（双语）
      copy.js          # 通用 UI 文案双语包（区块标题、往下滑、开关标签等）
    styles/
      tokens.css       # 唯一允许出现字面色值的文件
      base.css         # reset、排版阶梯、发丝线工具类、栅格
      hero.css         # 逐词遮罩
      cards.css        # 作品卡 + 站点区 + 技能区
      cursor.css       # 自定义光标
      demos/
        inkmark.css
        weflow.css
        anchor-deck.css
        mc-agent.css
        dailyhot.css
        keyboard-word.css
        cloud-hidden.css
    js/
      cursor.js        # 移植 MoeHome CustomCursor 核心 + 补守卫
      reveal.js        # IntersectionObserver 入场
      theme.js         # 明暗三态 + localStorage
      i18n.js          # 仅负责切换 html[lang] 与记忆偏好，不渲染文本
      demos/
        index.js       # 注册表
        inkmark.js  weflow.js  anchor-deck.js
        mc-agent.js  dailyhot.js  keyboard-word.js  cloud-hidden.js
    templates/
      index.html       # {{TOKEN}} 占位模板
      404.html
  build.js
  check.js             # 产物断言脚本（约 40 行）
  vercel.json
  package.json
```

---

## 4. 设计 tokens

以下色值与尺寸**全部实测自 oiloil.org 的计算样式**，不是挑选的结果。`tokens.css` 是全站唯一允许写死色值的文件。

### 4.1 亮色（默认）

| 变量 | 值 | 用途 |
|---|---|---|
| `--paper` | `#FFFFFF` | 页面底 |
| `--surface` | `#FAFAFA` | 次级底 |
| `--surface-invert` | `#0C0C0E` | 反白区块（如终端日志 demo） |
| `--ink` | `#1A1A1A` | 正文主色 |
| `--ink-2` | `#555555` | 次级文字 |
| `--ink-3` | `#999999` | 三级文字 |
| `--rule` | `rgba(26,26,26,.18)` | 发丝线 |
| `--rule-strong` | `#1A1A1A` | 强调边框（1px solid） |
| `--rule-dashed` | `rgba(26,26,26,.25)` | 虚线 |
| `--mark-bg` | `#FFE28A` | 马克笔黄，唯一强调色 |
| `--mark-fg` | `#1A1A1A` | 黄底上的文字 |
| `--link` | `#1E40D8` | 链接蓝 |
| `--col` | `820px` | 内容窄栏最大宽度 |
| `--font-sans` | `"Helvetica Neue", -apple-system, "PingFang SC", "Noto Sans SC", sans-serif` | 正文与标题 |
| `--font-mono` | `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace` | 标签、编号、eyebrow |
| `--ease-expo` | `cubic-bezier(.19, 1, .22, 1)` | **全站唯一缓动曲线**（除循环 `pulse`） |
| `--dur-enter` | `1.4s` | 入场时长 |

### 4.2 暗色（`[data-theme="dark"]`）

暗色不是「亮色取反」，有 2 个必须显式处理的坑：

| 变量 | 值 | 说明 |
|---|---|---|
| `--paper` | `#0C0C0E` | |
| `--ink` | `#EDEDED` | |
| `--rule` | `rgba(255,255,255,.14)` | **必须重定义**：亮色的 `rgba(26,26,26,.18)` 在暗底上会完全隐形 |
| `--rule-strong` | `#EDEDED` | |
| `--mark-bg` | `rgba(255,226,138,.24)` | **必须降透明度**：纯 `#FFE28A` 在暗底上过曝刺眼 |
| `--mark-fg` | `#FFE9A6` | 暗色下黄字配透明黄底 |

已知取舍：暗色下「马克笔黄」从实心亮黄块变成半透明黄底纹，与亮色观感不同源。这是有意的，用户已在第 2 节确认时知情同意。

### 4.3 排版阶梯（实测 oiloil）

| 层级 | 字号 / 字重 |
|---|---|
| H1（hero） | `58px / 700` |
| H3（卡标题） | `30px / 800` |
| H2（区块标题） | `16px / 400` |
| eyebrow（区块小标） | `12px / 650`，等宽，`中文 / ENGLISH` 形式 |
| body | `16px / 400`，`line-height: 24px` |

圆角纪律：卡片与区块用 `2px`–`8px`，只有 pill 与圆点用 `999px`/`50%`。**不使用 MoeHome 那种大圆角玻璃卡片。**

---

## 5. 模块契约

### 5.1 demo 注册表

所有微原型实现同一契约：

```js
// src/js/demos/index.js
import inkmark from './inkmark.js';
// ...7 个
export default { inkmark, weflow, 'anchor-deck': anchorDeck, /* ... */ };

// 每个 demo 模块
export function mount(el, ctx) {
  // 建立交互；返回卸载函数
  return function unmount() {}
}
// ctx = { lang: 'zh'|'en', prefersReducedMotion: boolean }
```

`app.js` 渲染卡后，按 `[data-demo]` 属性查表挂载。**查不到对应模块时静默跳过，卡片降级为纯静态卡且不报错** —— 这是后续砍卡的退路。

`ctx.lang` 供 demo 内部少数需要 JS 参与文案的场景（如 `keyboard-word` 的目标单词）。**能用 CSS `[lang]` 切换的一律不用 JS**，保持 i18n 路径单一。

### 5.2 双语数据形状

`data/projects.js` 每条采用 `{ zh, en }` 平行结构，构建时输出两个并列文本节点：

```html
<p class="card-quote">
  <span class="i18n i18n-zh">笔记存在自己电脑上，选中一段就能丢给模型改写。</span>
  <span class="i18n i18n-en">Your notes stay on your own machine.</span>
</p>
```

CSS：`html[lang="zh"] .i18n-en { display: none }`，反之同理。默认 `lang="zh"`。偏好存 localStorage，由 `i18n.js` 切换 `<html lang>`。

代价：HTML 内文本量翻倍。单页量级下 gzip 后约多几 KB，可接受。

### 5.3 build.js

约 150 行，做四件事：

1. 读 `src/data/*` → 渲染 `templates/index.html`，替换 `{{TOKEN}}` 与循环区块（照 MoeHome 的 token 替换思路，但只支持我们需要的 `{{TITLE}}` 形式与一个卡片段的循环拼装）。
2. 按固定顺序合并 `src/styles/**` → 单个 `dist/assets/app.css`。
3. **`src/js/**` → 单个 `dist/assets/app.js`，以 `type="module"` 引入。**
   这里有个约束要讲清楚：没有打包器，`terser` 不解析 `import`，所以「合并成单文件」和「保留 ES module 语义」天然冲突。采用极简拼接而非引入 bundler：
   - 按相对 `import` 关系做拓扑排序（我们的代码全在自己手里，依赖图是静态可读的）；
   - 每个源文件的模块体被包进一层 IIFE，**再**把该文件导出的符号显式挂进共享的 `window.__DEMO__` / `window.__MOD__` 命名空间。用 IIFE 是必需的，因为 7 个 demo 拼进同一作用域后 `mount`、`el`、`cleanup` 这类局部名必然冲突；
   - 剥离源文件里的 `import` / `export` 语句行。
   
   代价与边界：拼接依赖「所有 `src/js/**` 都写成上述形状」这一纪律，`check.js` 第 5 项负责兜底。**不引入 bundler** —— 为一个单页站加 Rollup/esbuild 与第 1 节的零依赖取向不符，而 20 次模块请求换成 1 次请求对首屏确实值得省。
4. 调 `lightningcss` / `terser` 压缩（`devDependencies`）。

必须检查：模板渲染后若仍有 `{{` 残留，构建直接失败退出非零。这条由 `check.js` 兜底。

---

## 6. 三条横切机制

### 6.1 暗色

见 4.2。实现要点：`theme.js` 管三态 `auto|light|dark` + localStorage；`auto` 跟随 `prefers-color-scheme` 并监听其变化。切换通过在 `<html>` 上写 `data-theme` 完成，组件样式零改动。

首帧防闪烁：`build.js` 在 `<head>` 内联一段 3 行脚本，在 CSS 加载前把 localStorage 的偏好写进 `data-theme`。这是静态站明暗切换的必做项，否则暗色用户每次刷新都白闪一下。

### 6.2 动效

- **全站只用 `--ease-expo` 一条缓动曲线**。这是 oiloil 质感来源之一。
- hero 逐词遮罩：`.lmask { overflow: hidden }` + 内层 `span { transform: translateY(110%) → 0 }`，按词 stagger。
- `reveal.js`：单个 IntersectionObserver，元素进视口加 `.in` 触发 `fadeup`。**不做 scroll 驱动的滚动动画**（实测 oiloil 也没有，它只有入场 + 卡内 CSS 自循环）。

`prefers-reduced-motion: reduce` 命中时：

- 关掉 lmask、reveal、自定义光标；
- **停止 7 个 demo 的自动循环**（`mc-agent` 的日志打字、`weflow` 的数字滚动、`dailyhot` 的列表轮播），demo 降级为静态可读状态；
- `--dur-enter` 归零。

页脚额外提供手动「动效」开关，覆盖系统偏好（参照 oiloil 的 `button.motion-permission「开启体感」`）。参照站自己放了授权按钮，说明动效开销确实需要用户同意。

`motion` 偏好与主题一样是三态，存 localStorage：`auto`（默认，跟随 `prefers-reduced-motion`）/ `on`（强制开）/ `off`（强制关）。生效公式：`motion === 'on' || (motion === 'auto' && !prefersReducedMotion)`。`i18n`、`theme`、`motion` 三个偏好共用同一个 `data-*` + localStorage 读写工具，不各写一份。

### 6.3 自定义光标

移植 `MoeHome/src/app.js:1220` 的 `CustomCursor` **核心算法**（rAF + `lerp 0.15` 拖尾 + 悬停可交互元素加 `.hover`），视觉改为 8px 实心点跟随、悬停撑成 32px 空心环。

已核实该实现缺 4 项守卫，移植时必须补上：

1. 只在 `(hover: hover) and (pointer: fine)` 下启用 —— 原实现无此判断，触屏设备也会白白跑 rAF 循环并注入 DOM。
2. `prefers-reduced-motion: reduce` 时退回原生光标。
3. 元素 `pointer-events: none` + 高 `z-index`，绝不挡点击。
4. 补真正的 `destroy()` —— 原实现只有 `visibilitychange` 暂停，没有卸载路径；页脚手动关动效时必须能移除元素并停掉 rAF。

`cursor: none` 会让用户找不到鼠标，因此以上任一条不满足时保留原生光标。

---

## 7. 页面信息架构

单页，6 个区块，结构对照 oiloil 实测 DOM。

| 区块 | 内容 | 数据源 |
|---|---|---|
| NAV | 右上：`中`/`EN` 语言切换 + 字面文本链接 `github.com/cubeyu` | `data/site.js` |
| HERO | `.hero.roll-band`：三行逐词遮罩 `麦希屿®` / `builds` / `small tools.`；`.sub` 行 `麦 希 屿` + 等宽 `DEVELOPER / AI TOOLS / OPEN-SOURCE`（照 oiloil 的 `ENGINEER / DESIGNER / OPEN-SOURCE` 三段式，**不含「代码诗人」**）；`↓ 往下滑` | 用户确认；技能项取自 portfolio 快照 |
| 作品 / WORKS | 7 张 `article`，见 7.1 | `data/projects.js` |
| 技能 / SKILLS | 13 项排成发丝线网格，等宽字体，**不放图标**（`Simple-Homepage/public/icons/tech/*.svg` 本轮不用） | 清单已在本文件 8 节定稿，源为 portfolio 快照 |
| 站点 / SITES | 产品化入口 + 社交，见 7.2 | `Simple-Homepage/src/config/linkBtn.json` |
| FOOTER | `© 2026 麦希屿` + 明暗开关 + 动效开关 + 联系邮箱 | — |

### 7.1 7 张作品卡

引文按用户决定全部改写为口语体。demo 提示语同样口语体。

**N°01 墨痕笔记 / INKMARK** ｜ `TypeScript` `LLM` `Markdown` ｜ 标签 `笔记 / Notes`
- 引文：笔记存在自己电脑上，选中一段就能丢给模型改写。
- EN: Your notes stay on your own machine. Select a line, hand it to the model, get it back rewritten.
- 微原型：左栏 Markdown 源码、右栏实时渲染；一个「问 AI」按钮把当前句标成马克笔黄。
- hint: 在左边改几个字，看右边怎么跟着变。/ Type in the left pane and watch the right keep up.

**N°02 微流 / WEFLOW** ｜ `Electron` `JavaScript` `可视化` ｜ 标签 `记录 / Archive`
- 引文：把微信聊天记录导出成本地文件，顺手生成一份你的年度报告。
- EN: Export your WeChat history to your own disk, then turn it into a year in review.
- 微原型：年度报告数字从零滚动（消息数 / 活跃天数 / 最常聊的人）+ 12 个月柱状条依次生长。
- hint: 数字是从零滚上来的，等它停。/ The numbers count up — wait for them to settle.

**N°03 锚点幻灯片 / ANCHOR DECK** ｜ `JavaScript` `HTML` `Local-first` ｜ 标签 `演示 / Slides`
- 引文：AI 生成的幻灯片落成本地 HTML，每一页都能接着改。
- EN: AI-generated slides land as local HTML — and every page stays editable.
- 微原型：卡内 5 页迷你 deck，点击翻页，页码 `N/5`，底部发丝线进度条。
- 键盘：`keydown` 监听**必须挂在卡片元素自身**（配 `tabindex="0"`），不能挂 `document` —— 否则页面滚动会被劫持，且第 5 张卡起方向键就同时控制翻页和滚动。
- hint: 点卡片翻一页，或用方向键。/ Click the card or use the arrow keys to advance.

**N°04 方块世界智仆 / MC AI AGENT** ｜ `Java` `Minecraft` `AI Agent` ｜ 标签 `代理 / Agent`
- 引文：给 Minecraft 装一个会自己想事的 Agent，它自己去探索、盖房、活下来。
- EN: Give Minecraft an agent that plans for itself — exploring, building, surviving.
- 微原型：`--surface-invert` 底上的终端日志逐行打出（看见树 → 决定砍 → 背包 +1 木材 → 天黑前搭棚），带光标闪烁。
- hint: 日志会自己走，不用点。/ The log runs on its own. Just watch.

**N°05 今日热榜 / DAILYHOT API** ｜ `TypeScript` `API` `爬虫` ｜ 标签 `接口 / API`
- 引文：一个接口，同时拿到十几个平台的热榜。
- EN: One endpoint, a dozen platforms' trending lists.
- 微原型：平台 tab（微博 / 知乎 / B站 / Hacker News）切换，列表整体淡入替换，每行 `#编号` + 标题 + 热度。
- hint: 换几个平台，看列表怎么替。/ Switch platforms and watch the list swap.
- 约束：卡内数据用**硬编码假样例**，构建时不请求 `hot.techisle.top`。理由：外部请求会让构建可失败、线上可挂白。

**N°06 关键词 / KEYBOARD WORD** ｜ `TypeScript` `键盘练习` `单词记忆` ｜ 标签 `练习 / Drill`
- 引文：照着单词敲，敲错了不给过——练的是手指，不是眼睛。
- EN: Type the word exactly, or it won't pass. This trains fingers, not eyes.
- 微原型：目标单词 + 输入框逐字母比对，错字母标红，全对时整词闪马克笔黄。
- hint: 试着少打一个字母，看它怎么拦你。/ Drop a letter and see it push back.

**N°07 云隐博客 / CLOUD HIDDEN** ｜ `TypeScript` `Astro` `博客系统` ｜ 标签 `写作 / Writing`
- 引文：不写代码的时候，我就在这儿写点东西。
- EN: When I'm not coding, I write here.
- 微原型：目录树点开三篇标题，展开显示日期与阅读时长，hover 标题出下划线。
- hint: 点目录把文章展开。/ Click the tree to open an article.

### 7.2 站点区链接（7 条）

| 显示名 | URL |
|---|---|
| ClawBase | `https://clawbase.cc` |
| 今日热榜 | `https://hot.techisle.top` |
| 支持一下 | `https://donate.techisle.top` |
| 站点监控 | `https://check.techisle.top` |
| GitHub | `https://github.com/cubeyu` |
| 哔哩哔哩 | `https://space.bilibili.com/88154706` |
| 邮箱 | `mailto:cubeyu@aliyun.com` |

`portfolio.techisle.top` **不列入**（用户决定退役，见 8.2）。其 7 帧作品已全部吸收进本文件 7.1，首页即唯一入口，不再有重复内容。

### 7.3 SEO（决策 11）

照抄 oiloil 的实测 meta 句式：

```html
<title>麦希屿® — cubeyu</title>
<meta name="description" content="麦希屿的个人作品、AI 工具实操、产品开发与开源项目记录。">
```

对照：oiloil 实测 `<title>` 为 `Oil® — 欧呦`，description 为「Oil 的个人作品、AI 工具实操、产品开发与开源项目记录。」。旧值「cubeyu の水墨小筑」及其「水墨风格个人主页」描述不再使用。

---

## 8. 内容迁移与必须修的既有缺陷

| 项 | 现状 | 处理 |
|---|---|---|
| 身份 | `麦希屿` / ID `cubeyu` / `独立开发者 · 代码诗人` | **只迁移 `麦希屿` + `cubeyu` + `独立开发者`**。「代码诗人」与「以墨为笔，以码为诗」属古风元素，按决策 10 清除。 |
| 头像 | `https://cdn.jsdelivr.net/gh/cubeyu/cubeyu.github.io/my-avatar.png` | **本地化进仓库**。外部 CDN 挂了头像就裂，属于线上真实风险。 |
| `og-image.png` | 在 `Simple-Homepage/index.html` 被引用但**仓库内不存在** | 新站要么补真图要么不引用。不把坏引用带过去。 |
| 站点标题 | 现为「cubeyu の水墨小筑」，description 写「水墨风格个人主页」 | **必须改**：新站视觉已不是水墨风，标题继续叫「水墨小筑」是内容欺骗。已在 7.3 定为 `麦希屿® — cubeyu`。 |
| 邮箱 | `portfolio.techisle.top` 显示 `cuebyu@techisle.top`，`Simple-Homepage` 显示 `cubeyu@aliyun.com` | 统一用 `cubeyu@aliyun.com`（用户确认）。`cuebyu` 判定为 `cubeyu` 手误，不带过来。 |
| 微信赞赏二维码 | 仓库内不存在，收款页在 `donate.techisle.top` 站外 | 不迁移，仅在站点区保留外链。 |
| 打字机语录 16 句 / 光阴进度 / 待办 4 条 | `Simple-Homepage` 原有区块 | **不迁移**。语录与新风格无关，进度条与待办属临时状态、易过期。 |
| 访问统计 | `Simple-Homepage` 装了 `@vercel/analytics`（npm 运行时包） | **代码里不加 script**，改由 Vercel 项目设置开启 Web Analytics。否则第 1 节「`dependencies` 必须为空」和 9.1 第 7 项检查自相矛盾。 |
| 18 项技能（`techStack.json`） | 含 jQuery 等 | 采用 portfolio 的 13 项（更贴近当前技术栈）。因 portfolio 将退役，清单**在此定稿**，不再依赖子站：`JavaScript` `TypeScript` `React` `Vue` `Astro` `Node.js` `Python` `Java` `Git` `Docker` `Cloudflare` `AI / LLM` `数据可视化`（EN 项 `Data Visualization`）。`Simple-Homepage` 多出的 `Vite` `Markdown` 不纳入。 |

### 8.1 待用户确认的最后一项内容（不阻塞实现，M1 验收时一并定）

**云隐博客那张卡的链接目标**：三处记载不一致 —— portfolio 写 `techisle.top`，`Simple-Homepage` 历史写 `cubeyu.cnblogs.com`，而 portfolio 退役后 `techisle.top` 将由新站本身占用，博客需要一个独立落点。M1 前给一个 URL 即可；在此之前该卡链接先指向 `#`，不做猜测。

（原第 1 项「SEO 文案」已在复核时定案，见 7.3。）

### 8.2 `portfolio.techisle.top` 退役流程

**这是线上动作，本设计与实现阶段均不代为执行**，需你在 Vercel 控制台自行操作。按下列顺序，避免内容不可逆丢失：

1. **先归档，后下线**。下线前抓取整站 HTML 快照存入本仓库 `archive/portfolio-2026-11-03.html`。该页 18KB、服务端渲染、内容完整，一次抓取即保全全部原文。此步不可省略 —— 归档是该站文案与身份的**唯一副本**。
2. 把 7 句文言原文抄进本文件 7.1 作对照（见下），保证即使快照丢失，文案仍可取回。
3. 新站经 M1–M5 验收、`techisle.top` 切域完成后，再退役子站。**退役时机不早于新站上线**，否则七帧作品在过渡期无完整承载页。

7 句原文归档（新口语文案见 7.1 各卡，此处为改写前版本）：

| 作品 | 文言原文 |
|---|---|
| 墨痕笔记 | 本地优先的 Markdown 编辑器，连接你与大语言模型的桥梁。 |
| 微流 | 本地微信聊天记录导出与年度报告应用，记录时光的温度。 |
| 锚点幻灯片 | 本地优先的 HTML 演示文稿编辑器，将 AI 生成的幻灯片化为可编辑的画卷。 |
| 方块世界智仆 | Minecraft AI 代理插件，让 AI 在方块世界中自主探索、建造与生存。 |
| 今日热榜 | 今日热榜聚合 API 接口，汇聚全网热点，一站式获取各大平台资讯。 |
| 关键词 | 为键盘工作者设计的单词记忆与英语肌肉记忆锻炼软件。 |
| 云隐博客 | 云水深处，自有文章。不写代码时，便在博客里写字。 |

题跋全文归档（决策 10 后不再上首页，此处为**逐字留存**，不依赖快照文件）：

> 余麦希屿，一介独立开发者也。自幼喜笔墨，长而好代码，遂以数码为纸，以键盘为笔，在虚拟世界中挥毫泼墨。前端工程、AI 工具、数据可视化，皆有所涉，不求样样精通，但求件件用心。深信代码如书法，既有筋骨架构，亦有气韵风神。一行行代码，正如一笔笔墨迹，落笔之时，便是心意所至。愿以匠人之心，造雅致之器，在数字长河中留下些许墨痕。

另留存的两处古风文本：卷首标 `独立开发者 · 代码诗人` / `— 以墨为笔，以码为诗 —` / `展 卷`；页脚署 `© 2026 麦希屿 · 以墨为笔，以码为诗`。这三处是本轮明确弃用、且不再出现在新站的表述。

快照文件本身已抓取并校验：`archive/portfolio-2026-11-03.html`，18593 字节，服务端渲染，含 7 帧作品与题跋全文。

---

## 9. 里程碑与验收

顺序刻意把「口味判定成本最低的切片」放最前面。

**M1 · 骨架与味道**
先执行 8.2 步骤 1（抓 `portfolio.techisle.top` 快照入 `archive/`）—— 它必须发生在任何内容被消费之前。
然后 `build.js` + `check.js` + `tokens.css` + `base.css` + hero 逐词遮罩 + **1 张卡（N°01 墨痕笔记，含完整微原型）+ 双语 + 暗色全部打通**。
交付即截图给用户看。**此时是唯一能低成本推翻视觉方向的时机**，往后 M2 起都是这个调子的铺开。

**M2 · 内容铺开**
7 张卡的静态纸面形态（`N°01`–`N°07` + 中英双标签 + 引文 + 技术标签）+ 技能区 + 站点区 + 页脚 + 404。

**M3 · 7 个微原型**
逐个实现。每个 demo 一个文件、契约统一、可单独摘掉降级。

**M4 · 横切收口**
`cursor.js`（含 4 项守卫）+ `reveal.js` + `prefers-reduced-motion` 全链路 + 首帧防闪烁。

**M5 · 验收与部署**
`vercel.json` + 预览域 + 全量截图矩阵 + Lighthouse。

### 9.1 自动化检查（`npm run check`，约 40 行）

对 `dist/index.html` 与**源文件** `src/styles/**`、`src/js/**` 断言：

1. `dist/index.html` 无残留 `{{`。
2. `dist/index.html` 内 7 个 `data-demo` 标记齐全。
3. 每个 `.i18n` 位置都有 `i18n-zh` 与 `i18n-en` 成对节点（防漏翻译）。
4. **除 `src/styles/tokens.css` 外，源样式文件不得出现字面色值** —— 正则扫 `#[0-9a-fA-F]{3,8}` 与 `rgba?\(`。扫**源文件而非合并产物**，因为 `dist/assets/app.css` 里 tokens 的值和组件的值已混在一处，无法定位违规来源。这是 4 节「tokens 是唯一改色处」约定的机器执行，防止组件样式里偷偷写死颜色导致暗色破功。
5. `src/js/demos/*.js` 7 个文件各自至少导出一个 `mount*` 符号，且都被 `demos/index.js` 注册（守 5.3 的拼接纪律）。
6. 7 个 demo 的 CSS 与 JS 均出现在产物中。
7. `package.json` 的 `dependencies` 为空（守零运行时依赖）。

### 9.2 人工验收矩阵

- 截图 8 组：`1440px` / `390px` 两档 × 明暗 × 中英。用 chrome-devtools 实拍。
- Lighthouse：accessibility ≥ 95，performance ≥ 90。
- 键盘可达：Tab 顺序走完 7 张卡及其内部交互，焦点环不被 `cursor: none` 或发丝线吞掉。
- `prefers-reduced-motion` 强制开启下重跑一遍，确认 7 个 demo 全部停在可读静态态、无自动循环。
- 触屏（模拟 `pointer: coarse`）下确认光标 DOM 未注入。

### 9.3 部署

`vercel.json`：build command `npm run build`，output `dist`。M5 交付 Vercel 预览 URL，**用户验收通过前不做任何域名切换**。旧站 `techisle.top` 全程不动。

---

## 10. 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 「照搬」的期望值管理 | oiloil 是 Next.js + CSS Modules，其卡内 demo（如 `TextWellDemo` 的 9s 多关键帧编排）是逐帧手工调出来的。零依赖手写一轮内不可能逐像素一致。 | M1 只交 1 张卡就是为了把「不像」提前到成本最低时暴露；明确告知需 2 轮打磨。 |
| 双语 × 暗色 × 7 demo 的组合爆炸 | 每个 demo 有 4 组视觉状态要验，且 demo 内的示例文字、按钮、hint 也都要双语。这是全项目最大工作量来源。 | 9.2 用矩阵验收而非凭感觉；9.1 第 3 条自动查漏翻译。 |
| 文案改写不可逆 | 7 条文言引文是已发表的成品，口语化后若用户觉得变平，需要回滚。 | 本文件 7.1 已把 14 句新文案写死，用户在复核 spec 时即为批准。 |
| 引文语气可能反悔 | 用户是在看到 3 条对照样例后仍选「全改口语」，但「云水深处，自有文章」那条已明示是净损失。 | 原文已抄进 8.2 归档表；且 M1 只交 1 张卡，可在最低成本时发现语气不对并回滚。 |
| portfolio 退役带走唯一副本 | 子站是 7 句文言、题跋全文与 13 项技能清单的**唯一现存载体**。先下线再归档 = 内容永久丢失。 | 8.2 定死顺序：**先抓快照 + 抄原文，后下线**，且退役不得早于新站上线。本设计不代为执行任何 Vercel 线上操作。 |
| 首帧闪烁 | 暗色用户刷新会白闪。 | 6.1 的内联脚本方案，M4 落实。 |
| `#FFE28A` 在暗色下不可用 | 已确认取舍：暗色下变半透明底纹，与亮色不同源。 | 4.2 记录，避免实现时当成 bug 修。 |

---

## 11. 不改动清单

本设计不触碰以下任何文件：

- `D:\code\other\MoeHome\**`（只读参考，从中移植 `CustomCursor` 算法思路）
- `D:\code\other\Simple-Homepage\**`（只读内容源）
- `techisle.top` 线上部署（M5 前不切域）
