// test/demos.test.js —— demo 挂载契约（spec 5.1）+ inkmark 的两个纯函数 + 那一次马克笔黄。
// 分工照 Task 9-10 的断言归属裁定：本文件管「契约与语义」，
// 产物与源文件的机器门禁（data-demo 数量对齐、字面色值泄漏、零依赖）归 Task 12 的 check.js，
// 同一道门禁写两处必然漂移，所以这里不重复扫。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import demos from '../src/js/demos/index.js';
import { mdToHtml, askTargetIndex } from '../src/js/demos/inkmark.js';

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
// 所以改类名不会让这个测试变红：它钉的是契约，不是 inkmark 的实现细节。
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
test('app.js mounts by data-demo and degrades silently', () => {
  const src = readFileSync('src/js/app.js', 'utf8');
  assert.match(src, /data-demo/);
  assert.match(src, /DEMO_REGISTRY\[|\bdemos\[|\bregistry\[/, 'must look up by name');
  // 静默降级：查不到模块时不得 throw。
  // 注意计划里这行写的是 `assert.ok(!/…/, msg)` —— 正则对象本身恒真，那个写法不管 app.js 里
  // 有没有 throw 都永远 FAIL。补上缺的 .test(src)，判据与期望方向一字未动。
  assert.ok(!/throw new Error\(`?.*[Dd]emo/.test(src), 'registry miss must not throw');
  // ctx 的两个字段必须由入口给全（spec 5.1 的 DemoCtx）
  assert.match(src, /lang/, 'ctx 要带 lang');
  assert.match(src, /prefers-reduced-motion/, 'ctx 要带 prefersReducedMotion');
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

// 马克笔黄的两条约束：底与字必须成对取 --mark-bg / --mark-fg（Task 7-8 裁定，暗色下底是半透明的，
// 配 --ink-3 实测只有 2.24:1），以及 :hover 必须关在 @media (hover: hover) 里（触屏不留粘住的态）。
test('the 问 AI mark uses both mark tokens and its hover is gated', () => {
  const css = readFileSync('src/styles/demos/inkmark.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /\.is-asked\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'inkmark.css 里找不到 .is-asked');
  assert.match(rule[1], /background:\s*var\(--mark-bg\)/);
  assert.match(rule[1], /color:\s*var\(--mark-fg\)/);
  assert.equal((css.match(/:hover/g) || []).length, 1, '本 demo 只该有一处 hover');
  assert.match(css, /@media \(hover: hover\) \{ \.d-ink-ask:hover \{/);
});

// 入口的两个开关不能被 demo 挂载挤掉（Task 11 重写 app.js 的回归网：
// 顺序本身不承重，见 test/pref-order.test.js，但两次调用必须在）。
test('app.js still initialises both preference toggles', () => {
  const src = readFileSync('src/js/app.js', 'utf8');
  assert.match(src, /initLang\(\)/);
  assert.match(src, /initTheme\(\)/);
  assert.match(src, /from '\.\/demos\/index\.js'/, 'app.js 必须经注册表拿 demo，不许自己 import 单个 demo');
});
