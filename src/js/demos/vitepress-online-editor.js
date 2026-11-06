// vitepress-online-editor.js —— 同名作品卡的微原型（spec 7.1）：左栏 Markdown 源码、右栏实时渲染，
// 一个「标记」按钮把光标所在那一行标成马克笔黄。零依赖，故意只做 markdown 的一个子集
// （标题 / 任务列表 / 加粗 / 行内代码）—— 完整 CommonMark 是另一个项目，不是这个演示。
//
// 纪律：本模块在【模块求值期与 mount 期】都不碰 document / window。
// build.js 会在 Node 里 import 注册表做「注册态门禁」（Task 7-8 裁定），那要求 demo 文件可被 Node 求值；
// test/demos.test.js 用一副最小假 DOM 跑 mount+unmount，而 node --test 里没有 globalThis.document，
// 所以任何顶层或 mount 期的 document 访问都会当场 ReferenceError，两处一起守住这条边界。
//

// 示例文本是演示内容，不在 src/data/* 里（那里只有卡片文案），所以按 spec 7.1 的批准文案写在这里。
// 两个语种各一套，形状一致：中间的空行是故意的 —— 它正是 askTargetIndex 要处理的那种行。
const SAMPLE = {
  zh: ['## 今天的笔记', '', '- [x] 写点东西', '- [ ] 发到博客', '', '**从这里开始。**'],
  en: ['## Notes', '', '- [x] Write a little', '- [ ] Publish a post', '', '**Start here.**'],
};

// 界面词。EN 的两个栏标用大写是等宽小标的排版（与 base.css 的 .eyebrow 同气味），不是另一个语种规则。
// done / todo 是读屏用的：勾选态今天只有「✓/· 加删除线」两个视觉记号，屏幕阅读器拿不到，
// 所以每个列表项挂一个视觉隐藏的文本标签（.d-md-sr）。
// asked 是「标记」播报的前缀，冒号与尾随空格算在词里：中英文的标点和空格习惯不同（：vs ": "），
// 拼在模板里就会有一半是错的语种，所以整段交给语种表。
const LABELS = {
  zh: { src: 'Markdown', out: '实时预览', ask: '标记当前行', done: '已完成', todo: '未完成', asked: '已标记：' },
  en: { src: 'MARKDOWN', out: 'PREVIEW', ask: 'Mark this line', done: 'done', todo: 'to do', asked: 'Marked: ' },
};

// 本模块唯一的转义出口。与 src/lib/build-utils.js 的 esc() 同表同形状，但不能 import 它：
// build.js 只把 src/js/** 拷进 dist/assets/js/（spec 5.3 原样拷贝 ES module 树），
// 运行时目录里没有 src/lib/ —— 那边 import 过来是个 404，而这条路径是安全边界，不赌。
// 漂移风险由 test/demos.test.js 的逐字断言钉住（含 & 必须先于 < 编码那一条）。
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// 「空行」的唯一判据：mdToHtml 用它决定要不要产出块，askTargetIndex 用它数块。
// 两处必须同一个口径，否则「标记」标错行 —— 所以它是一个函数而不是一处内联比较。
const isBlank = (line) => line.trim() === '';

// 故意只支持的行内语法。传进来的 s 已经过 esc()，所以 $1 里不可能有裸 < 或裸引号。
// 顺序承重：先转义整行、再认 markdown。反过来（先 inline 再转义）会把 inline 刚产出的
// `<strong>` 一起编码掉，预览里就只剩字面的标签文字 —— markdown 子集等于没渲染。
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="d-md-code">$1</code>');
}

const LIST_DONE = '- [x] ';
const LIST_TODO = '- [ ] ';

// state: true = 已完成 / false = 未完成 / null = 普通项目符号（没有勾选态，也就不该被读成「未完成」）
function listItem(mark, state, label, inner) {
  const sr = state === null ? '' : `<span class="d-md-sr">${esc(label)}</span>`;
  return `<p class="d-md-li${state ? ' is-done' : ''}">`
    + `<span aria-hidden="true">${mark}</span>${sr}${inner}</p>`;
}

// 源码 → 预览 HTML。导出是为了在 Node 里钉住转义与「一非空行 = 一块」这两条（见 test/demos.test.js），
// 与 prefs.js 把纯逻辑留在可测文件里是同一个理由。
export function mdToHtml(src, labels) {
  return String(src).split('\n').map((line) => {
    if (isBlank(line)) return ''; // 空行不产块：askTargetIndex 的块下标全押在这条上
    const l = esc(line);
    if (l.startsWith('## ')) return `<h4 class="d-md-h">${inline(l.slice(3))}</h4>`;
    if (l.startsWith(LIST_DONE)) return listItem('✓', true, labels.done, inline(l.slice(LIST_DONE.length)));
    if (l.startsWith(LIST_TODO)) return listItem('·', false, labels.todo, inline(l.slice(LIST_TODO.length)));
    // 普通项目符号：只有记号，没有勾选态，所以不挂 sr 标签 —— 把 `- 咖啡` 读成「未完成咖啡」是假信息。
    if (l.startsWith('- ')) return listItem('·', null, null, inline(l.slice(2)));
    return `<p class="d-md-p">${inline(l)}</p>`;
  }).join('');
}

// 预览里可被「标记」标中的那些块，与 mdToHtml 产出的类名同一份清单。
const BLOCK_SELECTOR = '.d-md-h, .d-md-li, .d-md-p';

// 光标位置 → 该标第几个块；没有可标的块给 -1。导出同 mdToHtml 的理由：这是纯计算，
// 而计划里原本的写法直接拿【源码行号】当【块下标】用 —— 示例文本里有空行、空行不产块，
// 于是光标停在最后一句时下标越界（什么都不标），停在第三行时标到第五行那句（标错）。
// 现在按「此块之前有几个非空行」数，两种错位一起消掉。
export function askTargetIndex(value, caret) {
  const text = String(value);
  const lineIdx = text.slice(0, caret).split('\n').length - 1;
  const lines = text.split('\n');
  const blocksBefore = lines.slice(0, lineIdx).filter((l) => !isBlank(l)).length;
  // 光标在空行上没有「当前句」，回到上一句 —— 第 0 行就是空则给 -1，调用方据此不标。
  return isBlank(lines[lineIdx]) ? blocksBefore - 1 : blocksBefore;
}

// 被标中的那一行「读出来」长什么样：播报里不该念出 markdown 的记号（「减 方括号 x」是噪声），
// 但也不能与 mdToHtml 各写一份识别 —— 前缀全用同一份 LIST_DONE / LIST_TODO / '- ' / '#' 常量，
// 两处不一致就会「预览里是待办、播报里是原文」。块下标 ↔ 非空源码行的对应关系同 askTargetIndex。
// 导出与上面两个纯函数同一个理由：这段是要在 Node 里钉住的计算，不是碰了 DOM 才有的副作用。
export function markedLineText(value, idx) {
  const line = String(value).split('\n').filter((l) => !isBlank(l))[idx];
  if (line === undefined) return '';
  const l = line.trim();
  if (l.startsWith(LIST_DONE)) return l.slice(LIST_DONE.length);
  if (l.startsWith(LIST_TODO)) return l.slice(LIST_TODO.length);
  if (l.startsWith('- ')) return l.slice(2);
  if (l.startsWith('#')) return l.replace(/^#+\s*/, '');
  return l;
}

// 契约（spec 5.1）：mount(el, ctx) → 返回 unmount。el 是卡里的 [data-demo-root="vitepress-online-editor"] 容器。
// 注册名 === 文件名 === projects.js 的 demo 字段 === 卡片 slug（demos/index.js 头注那条约定）。
export function mountVitepressOnlineEditor(el, ctx) {
  const lang = ctx.lang === 'en' ? 'en' : 'zh'; // 与 base.css 的 :lang(en) 二分同口径：非 en 一律按 zh 画
  const T = LABELS[lang];

  // 属性位与正文过同一把 esc()。示例文本与 LABELS 今天是模块内字面量，
  // 但这段模板是「以后有人往里塞数据层字段」时会被照抄的地方。
  // textarea 带 name 是消掉 Chrome 控制台那条「A form field element should have an id or name
  // attribute」issue（实测 M1 现场只有这一条，无障碍名本身由 aria-label 给，两者不互相替代）。
  el.innerHTML = `
    <div class="d-ink">
      <div class="d-ink-pane">
        <span class="d-ink-cap">${esc(T.src)}</span>
        <textarea class="d-ink-src" name="md-src" spellcheck="false" aria-label="${esc(T.src)}"></textarea>
      </div>
      <div class="d-ink-pane">
        <span class="d-ink-cap">${esc(T.out)}</span>
        <div class="d-ink-out" tabindex="0" role="region" aria-label="${esc(T.out)}"></div>
        <p class="d-ink-status" aria-live="polite"></p>
      </div>
      <button type="button" class="d-ink-ask">${esc(T.ask)}</button>
    </div>`;

  const ta = el.querySelector('.d-ink-src');
  const out = el.querySelector('.d-ink-out');
  const ask = el.querySelector('.d-ink-ask');
  const status = el.querySelector('.d-ink-status');

  // 播报面与渲染面分开（Task 11 审查 I3）：aria-live 原来压在 .d-ink-out 上，
  // 而这里每次 input 都整块重写它的 innerHTML —— 读屏会把整篇文档按字符重播一遍，
  // 盖掉用户本来就在听的字符反馈。所以 .d-ink-out 不再是 live region，
  // 播报只归 .d-ink-status 那一个节点（它的 textContent 只在「标记」那一刻变）。
  // 顺带清一次播报：重渲染已经把 .is-asked 冲掉了，留着上一行的名字就是假信息。
  // 清空 textContent 不会被读屏念出来（没有新内容），所以这一步是安静的。
  const render = () => {
    out.innerHTML = mdToHtml(ta.value, T);
    status.textContent = '';
  };

  // 示例文本走 .value 赋值而不是 innerHTML：textarea 的 value 是属性写入、不是 HTML 解析，
  // 所以里面的 `**` 与引号原样进框，不需要也不该再过一次 esc（过了就会显示成 &amp; 字面量）。
  ta.defaultValue = SAMPLE[lang].join('\n');
  ta.value = ta.defaultValue;
  render();

  // 输入即重渲染：这就是卡片 hint 那句「在左边改几个字，看右边怎么跟着变」。
  ta.addEventListener('input', render);

  const onAsk = () => {
    const blocks = out.querySelectorAll(BLOCK_SELECTOR);
    for (const node of blocks) node.classList.remove('is-asked');
    const idx = askTargetIndex(ta.value, ta.selectionStart ?? 0);
    const target = blocks[idx];
    if (!target) { status.textContent = ''; return; } // 没标中就不播报，念一句「已标记」是撒谎
    target.classList.add('is-asked');
    // 走 textContent 而不是 innerHTML：被播报的是用户手输的原文，这条路径上没有 HTML 解析。
    status.textContent = T.asked + markedLineText(ta.value, idx);
  };
  ask.addEventListener('click', onAsk);

  return function unmount() {
    ta.removeEventListener('input', render);
    ask.removeEventListener('click', onAsk);
    el.innerHTML = '';
  };
}
