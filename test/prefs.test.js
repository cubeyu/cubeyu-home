// test/prefs.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextCycle, normalizeTheme, readPref, writePref } from '../src/js/prefs.js';
import { ui } from '../src/data/copy.js';

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

// 下面两条测的是 prefs.js 唯一真正碰外界的地方：localStorage。
// 浏览器隐私模式会让 getItem/setItem 抛异常，Node（没给 --localstorage-file）则让
// localStorage 求值为 undefined、访问其方法抛 TypeError —— 两者都是「调用即 throw」，
// 所以在 Node 里测这条降级路径是等价的，不需要 DOM，也不需要起浏览器。
test('readPref falls back and writePref stays silent when storage throws', () => {
  const boom = () => { throw new Error('SecurityError: localStorage is blocked'); };
  withStorage({ getItem: boom, setItem: boom }, () => {
    assert.equal(readPref('theme', 'auto'), 'auto', 'blocked getItem must yield the fallback');
    assert.equal(readPref('lang', 'zh'), 'zh');
    assert.doesNotThrow(() => writePref('theme', 'dark'), 'a failed write must not break the toggle');
  });
});

test('a working storage round-trips under the cubeyu- prefix', () => {
  const store = new Map();
  withStorage({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }, () => {
    writePref('theme', 'dark');
    // 'cubeyu-theme' 不是随便挑的串：build.js 的 ANTI_FLASH 内联脚本在 CSS 加载前读的就是这个键，
    // 而它无法 import prefs.js（那时模块还没开始下载）。两边各漂一次，防闪烁就静默失效 ——
    // 首帧白闪只在暗色用户身上出现，正是 spec 6.1 要避免的那件事。
    assert.equal(store.get('cubeyu-theme'), 'dark', 'writePref must store under the cubeyu- prefix');
    assert.equal(readPref('theme', 'auto'), 'dark');
    // getItem 返回 null（键不存在）时走 ?? 而不是把 'null' 当值用
    assert.equal(readPref('motion', 'auto'), 'auto');
  });
});

// 键名约定的另一侧：内联防闪烁脚本读的字面量必须和 prefs.js 写出的是同一个。
// 用扫源码的方式断言（同计划 Task 11 对 app.js 的做法），因为这段脚本本来就不是可 import 的模块。
test('the inline anti-flash guard reads the same key prefs.js writes', () => {
  const buildSrc = readFileSync('build.js', 'utf8');
  assert.match(buildSrc, /localStorage\.getItem\('cubeyu-theme'\)/,
    'build.js ANTI_FLASH must read the exact key writePref("theme") produces');
});

// 这段脚本唯一的价值是「比首帧更早」，所以两件事必须成立，都得钉住：
// 1) 写入不在 try 里面 —— 读不到偏好（隐私模式）时也要按系统色写下去，否则暗色用户照样白闪；
// 2) 只有 light / dark 两个值能直接落到 data-theme，坏值回落到系统色，与 normalizeTheme 同语义。
// 浏览器侧的同一条实测：给同源 iframe 的 window 装一个抛异常的 localStorage getter，
// 解析到这段脚本为止就检查 <html> —— 改前 data-theme 是 null，改后是系统色。
test('the inline guard writes data-theme even when the read throws', () => {
  const buildSrc = readFileSync('build.js', 'utf8');
  const tryAt = buildSrc.indexOf('try{');
  const catchAt = buildSrc.indexOf('}catch(e){}', tryAt);
  const writeAt = buildSrc.indexOf('document.documentElement.dataset.theme=');
  assert.ok(tryAt > 0 && catchAt > tryAt && writeAt > catchAt,
    'data-theme 的写入必须在 try/catch 之外：包在 try 里时，localStorage 一抛就连同写入一起没了，首帧回到默认亮色');
  assert.match(buildSrc, /dataset\.theme=\(t==='light'\|\|t==='dark'\)\?t:/,
    '内联判据必须是 light|dark 白名单，坏偏好值不能直接写进 data-theme');
});

// theme.js 取文案是 labels[ORDER.indexOf(mode)] —— 下标直接落在数组上。
// 一旦标签项数与三态错开（加一个「跟随」少一个「亮」），点「亮」会显示「暗」的字，
// 而 data-theme 确实切到了亮：颜色和文字各说一半真话，肉眼看截图发现不了。
// ORDER 本身在 theme.js（DOM 侧，纯 Node 里 import 不了），所以这里钉住它的项数 3。
test('ui.themeLabels has exactly one non-empty label per theme state, both languages', () => {
  for (const lang of ['zh', 'en']) {
    const list = ui.themeLabels[lang];
    assert.equal(list.length, 3, `ui.themeLabels.${lang} must match the 3 states auto|light|dark`);
    for (const [i, s] of list.entries()) {
      assert.equal(typeof s, 'string', `ui.themeLabels.${lang}[${i}] must be a string`);
      assert.notEqual(s.trim(), '', `ui.themeLabels.${lang}[${i}] must not be empty`);
    }
  }
  assert.equal(ui.themeLabels.en.length, ui.themeLabels.zh.length,
    '两套标签必须同项数，否则英文态的下标整体错位');
});

// Node 的 localStorage 是 globalThis 上的 configurable 取值器，可以临时换掉；
// 换完必须还原，否则同文件后续测试看到的是一副假存储。
function withStorage(stub, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true, value: stub,
  });
  try {
    fn();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', original);
  }
}
