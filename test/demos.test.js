// test/demos.test.js —— demo 挂载契约（spec 5.1）+ vitepress-online-editor 的三个纯函数 + 那一次马克笔黄与它的播报面。
// 分工照 Task 9-10 的断言归属裁定：本文件管「契约与语义」，
// 产物与源文件的机器门禁（data-demo 数量对齐、字面色值泄漏、零依赖）归 Task 12 的 check.js，
// 同一道门禁写两处必然漂移，所以这里不重复扫。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import demos from '../src/js/demos/index.js';
import { mdToHtml, askTargetIndex, markedLineText } from '../src/js/demos/vitepress-online-editor.js';

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

// 契约的另一半：mount 必须返回卸载函数，且卸载把自己挂上的监听全部摘掉、清空容器。
// 无真 DOM —— 用一副最小假 DOM，手法与 test/pref-harness.js 同源（那里假的是两个开关，这里假的是卡内容器）。
// 假 root 只认「往 innerHTML 写」和「按选择器要一个节点」两件事，节点本身是通用的，
// 所以改类名不会让这个测试变红：它钉的是契约，不是 vitepress-online-editor 的实现细节。
function fakeNode() {
  return {
    listeners: [],
    innerHTML: '',
    value: '',
    selectionStart: 0,
    classList: { add() {}, remove() {} },
    addEventListener(type, cb) { this.listeners.push([type, cb]); },
    removeEventListener(type, cb) {
      this.listeners = this.listeners.filter((l) => !(l[0] === type && l[1] === cb));
    },
    querySelectorAll() { return []; },
  };
}
function fakeRoot() {
  return {
    nodes: new Map(),
    innerHTML: '',
    querySelector(sel) {
      if (!this.nodes.has(sel)) this.nodes.set(sel, fakeNode());
      return this.nodes.get(sel);
    },
  };
}
const countListeners = (root) =>
  [...root.nodes.values()].reduce((n, node) => n + node.listeners.length, 0);

// 附带钉住的一件事：node --test 里没有 globalThis.document，所以 mount 只要在任何顶层
// 碰了 document / window，这个测试就当场 ReferenceError —— 那正是 build.js 在 Node 里
// import 注册表（Task 7-8 的注册态门禁）会被打断的同一种坏件，两处一起守住。
test('a mounted demo returns an unmount that detaches everything it bound', () => {
  for (const [name, mount] of Object.entries(demos)) {
    const root = fakeRoot();
    const unmount = mount(root, { lang: 'zh', prefersReducedMotion: false });
    assert.equal(typeof unmount, 'function', `${name} 必须返回卸载函数（spec 5.1 的契约）`);
    assert.notEqual(root.innerHTML, '', `${name} 没往容器里写任何 DOM`);
    assert.ok(countListeners(root) > 0, `${name} 一个监听都没挂，卸载无从谈起`);
    unmount();
    assert.equal(countListeners(root), 0, `${name} 卸载后仍留有监听`);
    assert.equal(root.innerHTML, '', `${name} 卸载后没清空容器`);
  }
});

// 这条是「用户换卡后不会误报」的实现（spec 9.1 第 5 项）：注册表与磁盘文件名互等。
// 审查 I2 换过写法。原来那三条都吃不到它们想吃的东西：
//   /data-demo/   —— `data-demo-root` 里的子串就能喂饱它，钉不住挂载键到底是哪个属性；
//   !/throw new Error(…Demo…/ —— 把 app.js 的守卫整行删掉只会得到 TypeError: mount is not a function，
//                    这条【照样绿】，等于没有网；
//   /lang/        —— `initLang` 也算命中，是空断言。
// 所以改成【正面钉实现本体】：挂载键、取键的值、守卫那一行、ctx 两个字段的来源，逐字对齐 app.js。
// 负面对偶保留（原判据一字未动），只是不再独自承重。可证伪性取证见 task-11-report.md 的 I2 一节。
test('app.js mounts by data-demo-root and degrades silently', () => {
  const src = readFileSync('src/js/app.js', 'utf8');
  // 挂载键 = 容器上的 data-demo-root，而且必须是以属性选择器被查出来的那一串，不是任何含 data-demo 的写法。
  assert.match(src, /querySelectorAll\(\s*'\[data-demo-root\]'\s*\)/, '挂载键必须是 [data-demo-root] 容器属性');
  // 查表用的名字就取自这一个属性的值 —— 不写死卡名，也不读第二个属性。
  assert.match(src, /dataset\.demoRoot/, '挂载名要取自 data-demo-root 的值');
  assert.match(src, /demos\[name\]/, 'must look up by name');
  // 静默降级的守卫本体（spec 5.1「查不到即跳过」）：有 typeof 判断，且失败走 continue。
  assert.match(src, /typeof\s+mount\s*!==\s*'function'/, '查不到模块时必须有 typeof 守卫');
  assert.match(src, /typeof\s+mount\s*!==\s*'function'\s*\)\s*continue\s*;/, '守卫必须是 continue');
  // 静默降级：查不到模块时不得 throw。
  // 注意计划里这行写的是 `assert.ok(!/…/, msg)` —— 正则对象本身恒真，那个写法不管 app.js 里
  // 有没有 throw 都永远 FAIL。补上缺的 .test(src)，判据与期望方向一字未动。
  assert.ok(!/throw new Error\(`?.*[Dd]emo/.test(src), 'registry miss must not throw');
  // ctx 的两个字段必须由入口给全（spec 5.1 的 DemoCtx），且各自的来源钉死：
  // 语种取 pref-ui.js 的唯一判据，不是再抄一份 <html lang> 字符串；动效取那条媒体查询。
  assert.match(src, /lang:\s*prefersEnglish\(\)\s*\?\s*'en'\s*:\s*'zh'/, 'ctx.lang 必须来自 prefersEnglish()');
  assert.match(src, /prefersReducedMotion:\s*matchMedia\(\s*'\(prefers-reduced-motion: reduce\)\s*'\s*\)\.matches/,
    'ctx.prefersReducedMotion 必须来自那条媒体查询');
});

const LABELS = { done: '已完成', todo: '未完成' };

// 渲染用户手输的 markdown 到 innerHTML 是本 demo 唯一的注入面，所以这条是安全断言不是美观断言：
// 计划里的行内转义只处理 & < >，这里用的是覆盖 & < > " ' 的那一把 esc()（与 build-utils.js 同表），
// 属性位（aria-label）与正文共用同一把，不留「哪一处忘了转」的缝。
test('mdToHtml escapes what the textarea can type', () => {
  assert.equal(
    mdToHtml('<script>alert(1)</script>', LABELS),
    '<p class="d-md-p">&lt;script&gt;alert(1)&lt;/script&gt;</p>',
  );
  assert.equal(
    mdToHtml('"><img src=x onerror=alert(1)>', LABELS),
    '<p class="d-md-p">&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</p>',
  );
  // 整串比死：包层的 class="…" 自带双引号，只查「有没有裸引号」会假失败。
  assert.equal(mdToHtml('a"b\'c', LABELS), '<p class="d-md-p">a&quot;b&#39;c</p>');
  assert.equal(mdToHtml('&lt;', LABELS), '<p class="d-md-p">&amp;lt;</p>', '& 必须先于 < 编码，不许二次解码');
});

test('mdToHtml renders the deliberate markdown subset', () => {
  const out = mdToHtml('## 标题\n- [x] 办完\n- [ ] 待办\n- 普通\n**粗** 与 `码`', LABELS);
  assert.match(out, /<h4 class="d-md-h">标题<\/h4>/);
  assert.match(out, /<p class="d-md-li is-done">/);
  assert.match(out, /<p class="d-md-li">/);
  assert.match(out, /<strong>粗<\/strong>/);
  assert.match(out, /<code class="d-md-code">码<\/code>/);
  // 勾选态今天只有删除线 + ✓ 两个视觉记号，读屏拿不到；所以各挂一个视觉隐藏的文本标签。
  assert.match(out, /<span class="d-md-sr">已完成<\/span>/);
  assert.match(out, /<span class="d-md-sr">未完成<\/span>/);
  // 但普通项目符号没有勾选态，不该被读成「未完成」—— 那是假信息。
  assert.ok(!mdToHtml('- 咖啡', LABELS).includes('d-md-sr'), '普通 bullet 不该挂勾选态标签');
});

// 「问 AI」是按【块下标】定位的，它成立的前提是「每个非空行恰好产出一个块、空行一个也不产」。
// 计划里那段把源码行号直接当块下标用，在示例这种中间带空行的文本上会标错行（askTargetIndex 是改过的映射），
// 所以这条不变量必须钉住 —— 它同时是那个 bug 的回归网。
test('one block per non-blank line, in order', () => {
  const sources = [
    '## 今日排期\n\n- [x] 把 demo 挂上主页\n- [ ] 写完微原型\n\n选中一行。\n',
    'a\n\n\nb\n',
    '\n \n\t\n',
    'a',
    '',
  ];
  for (const src of sources) {
    const blocks = (mdToHtml(src, LABELS).match(/class="d-md-(?:h|li|p)\b/g) || []).length;
    assert.equal(blocks, src.split('\n').filter((l) => l.trim() !== '').length, `对不上: ${JSON.stringify(src)}`);
  }
});

// 行 → 块 的映射逐行算一遍：空白行回到上一句（「当前句」的常识读法），第 0 行就是空则没得标。
test('askTargetIndex maps the caret line to the rendered block', () => {
  const src = ['## 今日排期', '', '- [x] 甲', '- [ ] 乙', '', '选中一行。**加粗**。', ''].join('\n');
  // 第 n 行的行首偏移：前 n 行拼回去再加上它们各自的那个换行符
  const caret = (n) => src.split('\n').slice(0, n).join('\n').length + (n === 0 ? 0 : 1);
  assert.equal(askTargetIndex(src, caret(0)), 0, '首行 → 第 0 块');
  assert.equal(askTargetIndex(src, caret(1)), 0, '空行回到上一句');
  assert.equal(askTargetIndex(src, caret(2)), 1);
  assert.equal(askTargetIndex(src, caret(3)), 2);
  assert.equal(askTargetIndex(src, caret(4)), 2, '中间空行回到上一句');
  assert.equal(askTargetIndex(src, caret(5)), 3, '示例里最后那句落在第 3 块（计划的原写法会落到 undefined）');
  assert.equal(askTargetIndex(src, caret(6)), 3, '末尾空行回到最后一句');
  assert.equal(askTargetIndex('', 0), -1, '空源码没有可标的行');
});

// 播报文本与 askTargetIndex 用的是同一个「块下标 ↔ 非空源码行」口径，所以两条要一起读。
// 钉的是「念出来的那句是行内容、不带 markdown 记号」：把 LIST_DONE / '#' 的剥离删掉，
// 读屏就会念「减 方括号 x 把 demo 挂上主页」；下标算错则念成隔壁那行。
test('markedLineText reads back the marked block without markdown noise', () => {
  const src = ['## 今日排期', '', '- [x] 把 demo 挂上主页', '- [ ] 写完微原型', '- 咖啡', '普通一行', ''].join('\n');
  assert.equal(markedLineText(src, 0), '今日排期', '标题只念内容，不念 #');
  assert.equal(markedLineText(src, 1), '把 demo 挂上主页', '已完成行剥掉勾选记号');
  assert.equal(markedLineText(src, 2), '写完微原型', '待办行剥掉勾选记号');
  assert.equal(markedLineText(src, 3), '咖啡', '普通 bullet 也剥记号');
  assert.equal(markedLineText(src, 4), '普通一行', '正文原样');
  assert.equal(markedLineText(src, -1), '', 'askTargetIndex 给 -1（没得标）时不播报');
  assert.equal(markedLineText(src, 99), '', '越界给空串，不许念出 undefined');
  assert.equal(markedLineText('', 0), '', '空源码没有可念的行');
});

// 马克笔黄的两条约束：底与字必须成对取 --mark-bg / --mark-fg（Task 7-8 裁定，暗色下底是半透明的，
// 配 --ink-3 实测只有 2.24:1），以及 :hover 必须关在 @media (hover: hover) 里（触屏不留粘住的态）。
test('the 问 AI mark uses both mark tokens and its hover is gated', () => {
  const css = readFileSync('src/styles/demos/vitepress-online-editor.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /\.is-asked\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'vitepress-online-editor.css 里找不到 .is-asked');
  assert.match(rule[1], /background:\s*var\(--mark-bg\)/);
  assert.match(rule[1], /color:\s*var\(--mark-fg\)/);
  assert.equal((css.match(/:hover/g) || []).length, 1, '本 demo 只该有一处 hover');
  assert.match(css, /@media \(hover: hover\) \{ \.d-ink-ask:hover \{/);
});

// 审查 I1：被标中的那一行，正文与 ✓/· 记号必须是同一份墨。
// 老形状里 .is-asked 只有 0-2-0，而记号 span 自己那两条是 0-2-1 与 0-3-1，全压在它上面 ——
// 于是标记生效时正文换 --mark-fg、记号却留在 --ink-3，正好落在本文件上面那条注释里
// 「Task 7-8 裁定否掉」的那对（--ink-3 打在 --mark-bg 上：亮 2.24:1 / 暗 2.19:1）。
// 光看「规则在不在」不够：同特异性靠的是后置，所以位置也一起钉。
test('the marked task-list line carries one ink for text and marker glyph', () => {
  const css = readFileSync('src/styles/demos/vitepress-online-editor.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = (re, what) => {
    const i = css.search(re);
    assert.notEqual(i, -1, `vitepress-online-editor.css 里找不到${what}`);
    return i;
  };
  const inked = /\.d-ink-out \.is-asked > span\[aria-hidden\]\s*\{([^}]*)\}/.exec(css);
  assert.ok(inked, 'vitepress-online-editor.css 里没有「标记行的记号也换墨」这条规则');
  assert.match(inked[1], /color:\s*var\(--mark-fg\)/, '记号必须配 --mark-fg，不许留在 --ink-3');
  const marker = at(/\.d-ink-out \.is-asked > span\[aria-hidden\]\s*\{/, '记号那条规则');
  assert.ok(at(/\.d-ink-out \.is-asked\s*\{/, '正文那条 .is-asked') < marker,
    '记号规则要排在 .is-asked 之后（同一文件「后置取胜」的读法）');
  assert.ok(at(/\.d-md-li\.is-done > span\[aria-hidden\]\s*\{/, 'is-done 的记号规则') < marker,
    '记号规则与 .d-md-li.is-done 那条同为 0-3-1，只能靠排在后面取胜');
});

// 审查 I3：aria-live 原来压在 .d-ink-out 上，而 render() 每次 input 都整块重写它的 innerHTML ——
// 读屏用户等于每敲一个字符重播一遍全文，盖掉本来就在听的字符反馈。
// 现在播报面是旁边那个只写 textContent 的小节点，渲染面不再是 live region。
// 每条都是正面钉形状：aria-live 挪回 .d-ink-out、播报节点落进重渲染的容器里、
// 或者「顺手」把 input 的重渲染一起摘掉，都会红。
test('the live region is the status node, not the re-rendered preview', () => {
  const js = readFileSync('src/js/demos/vitepress-online-editor.js', 'utf8');
  // 渲染容器「开到即关」：既证明它身上没有 aria-live，也证明播报节点没被塞进它内部
  // （塞进去就会被 render() 的 innerHTML 一起冲掉，live region 又变回整块重播）。
  assert.match(js, /<div class="d-ink-out"><\/div>/, '.d-ink-out 不许带 aria-live，也不许有内部节点');
  assert.match(js, /<p class="d-ink-status" aria-live="polite"><\/p>/, '播报节点自带 aria-live="polite"');
  assert.match(js, /status\.textContent = T\.asked \+ markedLineText/, '播报内容只有「哪一行被标中」');
  // 改无障碍的同时别把演示的核心行为改掉：输入仍然即时重渲染。
  assert.match(js, /out\.innerHTML = mdToHtml\(ta\.value, T\);/, 'render 仍整块重写预览');
  assert.match(js, /ta\.addEventListener\('input', render\);/, 'input 仍接 render');
  // 重渲染会连 .is-asked 一起冲掉，所以播报也要跟着清空，否则念的是上一行的名字（假信息）。
  assert.equal((js.match(/status\.textContent = '';/g) || []).length, 2, '「重渲染」与「没标中」两处都清空播报');

  // 视觉隐藏但不许用 display:none —— 那会连读屏一起摘掉，live region 就废了。
  const css = readFileSync('src/styles/demos/vitepress-online-editor.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const hide = /\.d-md-sr[^{]*\{([^}]*)\}/.exec(css);
  assert.ok(hide && /\.d-ink-status/.test(hide[0]), '.d-ink-status 要挂进「读屏可见、视觉不可见」那条工具规则');
  assert.doesNotMatch(hide[1], /display:\s*none/, '视觉隐藏不许用 display:none');
});

// 入口的两个开关不能被 demo 挂载挤掉（Task 11 重写 app.js 的回归网：
// 顺序本身不承重，见 test/pref-order.test.js，但两次调用必须在）。
test('app.js still initialises both preference toggles', () => {
  const src = readFileSync('src/js/app.js', 'utf8');
  assert.match(src, /initLang\(\)/);
  assert.match(src, /initTheme\(\)/);
  assert.match(src, /from '\.\/demos\/index\.js'/, 'app.js 必须经注册表拿 demo，不许自己 import 单个 demo');
});
