// test/prefs.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextCycle, normalizeTheme, readPref, writePref, DARK_QUERY } from '../src/js/prefs.js';
import { ui } from '../src/data/copy.js';
import { withEnv } from './pref-harness.js';

test('nextCycle wraps through auto -> light -> dark -> auto', () => {
  const order = ['auto', 'light', 'dark'];
  assert.equal(nextCycle(order, 'auto'), 'light');
  assert.equal(nextCycle(order, 'dark'), 'auto');
});

test('nextCycle falls back to the first value on unknown input', () => {
  assert.equal(nextCycle(['auto', 'light', 'dark'], 'bogus'), 'auto');
  // 补上 undefined（偏好从没写过 / 属性缺失那一类）与 null，确认「落回第 0 个」不是
  // 只在这条测试挑了个字符串时才成立。审查 M1 掉的是那条算不出差别的三元，
  // 行为本身仍然要有网：indexOf 给 -1 时 (-1+1)%len 就是 0。
  assert.equal(nextCycle(['auto', 'light', 'dark'], undefined), 'auto');
  assert.equal(nextCycle(['zh', 'en'], ''), 'zh');
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
  const buildSrc = codeOf('build.js');
  assert.match(buildSrc, /localStorage\.getItem\('cubeyu-theme'\)/,
    'build.js ANTI_FLASH must read the exact key writePref("theme") produces');
  // 语言那一半（审查 I1）：writePref('lang', …) 落的是 cubeyu-lang，守卫读的字面量必须同上。
  assert.match(buildSrc, /localStorage\.getItem\('cubeyu-lang'\)/,
    'build.js ANTI_FLASH must read the exact key writePref("lang") produces');
});

// 这段脚本唯一的价值是「比首帧更早」，所以两件事必须成立，都得钉住：
// 1) 写入不在 try 里面 —— 读不到偏好（隐私模式）时也要按系统色写下去，否则暗色用户照样白闪；
// 2) 只有白名单里的值能直接落到 <html>（data-theme / lang），坏值回落，与 normalizeTheme 同语义。
// 审查 I1 要求这条网跟着语言那一半一起长：Theme 与 Lang 各有一对 try/catch，
// 两次写入都必须排在自己那一对的 catch 之后 —— 于是逐条断言，而不是「全文只有一个 try」。
// 浏览器侧的同一条实测：给同源 iframe 的 window 装一个抛异常的 localStorage getter，
// 解析到这段脚本为止就检查 <html> —— 改前 data-theme 是 null，改后是系统色。
test('the inline guard writes data-theme and lang even when the read throws', () => {
  const buildSrc = codeOf('build.js');
  const cases = [
    ['cubeyu-theme', 'document.documentElement.dataset.theme='],
    ['cubeyu-lang', 'document.documentElement.lang='],
  ];
  for (const [key, write] of cases) {
    // 这一对 try/catch 就是守卫这个键的那一段；抓不到就说明形状改过了，必须一起改这条断言。
    const guard = new RegExp(`try\\{[^}]*localStorage\\.getItem\\('${key}'\\)[^}]*\\}catch\\(e\\)\\{\\}`).exec(buildSrc);
    assert.ok(guard, `build.js must keep a guarded read of '${key}'`);
    const guardEnd = guard.index + guard[0].length;
    const writeAt = buildSrc.indexOf(write);
    assert.ok(writeAt > 0, `${write} must exist in the inline guard`);
    assert.ok(writeAt > guardEnd,
      `${write} 必须排在读它的那个 try/catch 之后：包在 try 里时，localStorage 一抛就连同写入一起没了，首帧回到默认亮色 / 默认语种`);
  }
  assert.match(buildSrc, /dataset\.theme=\(t==='light'\|\|t==='dark'\)\?t:/,
    '内联判据必须是 light|dark 白名单，坏偏好值不能直接写进 data-theme');
  assert.match(buildSrc, /if\(l==='en'\)document\.documentElement\.lang='en'/,
    '语言判据必须是 en 白名单：坏值让模板的 zh 留着，与 i18n.js 回落到 ORDER[0] 同义');
});

// 审查 M6：上面那条是文本断言（钉住「字面量长什么样」），钉不住「这段脚本跑起来写出什么」。
// 这里补行为断言 —— 执行 dist/index.html 里的守卫正文（产物 = 浏览器实际执行的字节，
// 连 DARK_QUERY 的插值结果一起拿到），在桩 document / matchMedia / 会抛的 localStorage 上真跑一遍，
// 再断言写出去的值。桩在 test/pref-harness.js，与 test/pref-order.test.js 共用一副。
// 信任边界：这段字符串来自本仓库 build.js 刚产出的 dist/，不是任何外部输入；
// 真要执行第三方脚本就该换沙箱而不是 new Function。dist/ 缺失时先 npm run build
// （data.test.js 对同一份产物也是这个前置要求）。
function runAntiFlash({ stored = {}, systemDark = false, storageBlocked = false } = {}) {
  return withEnv({ stored, systemDark, storageBlocked }, (env) => {
    env.runInlineGuard();
    return { theme: env.html.dataset.theme, lang: env.html.lang, mediaQueries: env.mediaQueries };
  });
}

// 白名单与 normalizeTheme 的一致性原先只由一句注释承诺（审查 M6 点名的就是这条）。
// 逐格把守卫写出的值与 normalizeTheme 算出的值对在一起：任一侧改了判据，这里当场红。
test('running the shipped guard paints exactly what normalizeTheme computes', () => {
  for (const systemDark of [false, true]) {
    for (const stored of ['light', 'dark', 'auto', 'blue', undefined]) {
      const expected = normalizeTheme(stored ?? 'auto', systemDark);
      const got = runAntiFlash({
        stored: stored === undefined ? {} : { 'cubeyu-theme': stored },
        systemDark,
      });
      assert.equal(got.theme, expected,
        `偏好 ${JSON.stringify(stored)} + 系统 ${systemDark ? 'dark' : 'light'}：守卫写 ${got.theme}，normalizeTheme 写 ${expected}`);
    }
  }
});

// 审查 I1 的行为面：英文偏好必须在首帧就落到 <html lang>，而不是等 app.js。
// 回落表与 i18n.js 的 `ORDER.includes(stored) ? stored : ORDER[0]` 对齐：只有 'en' 改写，
// 其余（含 'fr' / 'EN' 这类坏值）让模板的 'zh' 留着。
test('running the shipped guard applies the lang whitelist on first paint', () => {
  assert.equal(runAntiFlash({ stored: { 'cubeyu-lang': 'en' } }).lang, 'en');
  for (const bad of ['fr', 'EN', 'zh', 'english', undefined]) {
    assert.equal(runAntiFlash({ stored: bad === undefined ? {} : { 'cubeyu-lang': bad } }).lang, 'zh',
      `语言偏好 ${JSON.stringify(bad)} 不该改写 <html lang>`);
  }
});

// 存储被禁时两条写入的取舍不同，都在这一点上：主题必须仍然落到系统色（否则白闪），
// 语言不动（模板的 zh 就是正确回落）。行为版本，与上面那条文本顺序断言互补。
test('running the shipped guard still writes data-theme when localStorage throws', () => {
  for (const [systemDark, expected] of [[true, 'dark'], [false, 'light']]) {
    const got = runAntiFlash({ systemDark, storageBlocked: true });
    assert.equal(got.theme, expected, `storage blocked + system ${expected} must still paint ${expected}`);
    assert.equal(got.lang, 'zh');
  }
});

// 审查 M2：`(prefers-color-scheme: dark)` 原先有三份字面量（prefs.js / theme.js / build.js 模板），
// 键名有跨侧断言而查询串没有，改一处就静默把首帧 auto 与运行期 auto 分开。
// 现在只有 prefs.js 那一个真源，产物里跑出来的查询串必须与 import 到的常量逐字相同。
test('the guard and the DOM side share one DARK_QUERY, with no second literal left', () => {
  const r = runAntiFlash({ stored: { 'cubeyu-theme': 'auto' }, systemDark: true });
  assert.deepEqual(r.mediaQueries, [DARK_QUERY],
    '守卫必须只按共享的 DARK_QUERY 查系统色（插值生效，且没有第二个查询串混进来）');
  // 字面量在 JS 侧与构建侧只允许出现一次。剥注释后再扫（口径同 codeOf）——
  // 注释里提一句「prefers-color-scheme」是散文，不该被算成第二份副本。
  const files = ['src/js/prefs.js', 'src/js/pref-ui.js', 'src/js/theme.js', 'src/js/i18n.js', 'src/js/app.js', 'build.js'];
  const holders = files.filter((f) => codeOf(f).includes(DARK_QUERY));
  assert.deepEqual(holders, ['src/js/prefs.js'],
    `DARK_QUERY 的字面量只能有 prefs.js 一处，实际在：${holders.join(', ')}`);
  assert.match(codeOf('src/js/pref-ui.js'), /matchMedia\(DARK_QUERY\)/,
    'pref-ui.js 必须用常量而不是重抄查询串（systemDark 与 change 监听两处都从它拿）');
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

// 审查 M4：`,` 是这两个控件的序列化格式 —— build.js 用 join(',') 烘进 data-*，
// pref-ui.js 用 split(',') 取回。原先只断言项数与非空，所以一个含逗号的标签
// （「亮（跟随）, 强制」）会把后面的下标整体挪位而构建全绿。
// 定式声明在这里：任何标签值都不许含逗号。语言开关的可见文字是 langZh / langEn 拼的一串，
// 同样走 split(',')，所以两个源值也一起扫。
test('no toggle label value contains the comma that serializes data-labels', () => {
  const values = [ui.langZh, ui.langEn, ...ui.themeLabels.zh, ...ui.themeLabels.en];
  for (const s of values) {
    assert.ok(!s.includes(','), `标签 ${JSON.stringify(s)} 含逗号会挪动 split(',') 之后的下标 —— 分隔符定式破了`);
  }
});

// 审查 M4：同一条「读 data-* → split(',') → 写 textContent / aria-label」原先在
// theme.js 与 i18n.js 各写一遍（M4 的动效开关是第三遍）。现在两个开关都调 pref-ui.js 的
// paintToggle，谁都不再自己 setAttribute('aria-label') —— 断言这一点，否则下次复制粘贴
// 就把画笔拆回两份，而行为测试仍然全绿（文案今天恰好都对）。
test('both toggles paint through one shared helper, not their own copy', () => {
  const themeSrc = codeOf('src/js/theme.js');
  const langSrc = codeOf('src/js/i18n.js');
  const helperSrc = codeOf('src/js/pref-ui.js');
  for (const [name, src] of [['theme.js', themeSrc], ['i18n.js', langSrc]]) {
    assert.match(src, /from '\.\/pref-ui\.js'/, `${name} must import the shared painter`);
    assert.match(src, /paintToggle\(/, `${name} must paint via paintToggle`);
    assert.ok(!src.includes("setAttribute('aria-label'"),
      `${name} 不该再自己写 aria-label —— 名字与可见文字的关系（WCAG 2.5.3）只在画笔那一处管`);
    assert.ok(!/\.textContent\s*=/.test(src),
      `${name} 不该再自己写 textContent`);
  }
  assert.match(helperSrc, /setAttribute\('aria-label'/, 'paintToggle 才是写 aria-label 的那一处');
});

// 源码类断言共用的读取：先剥注释再扫，口径与 tokens.test.js 的 `code`、check.js 的
// COLOR_LEAK 一致 —— 注释里引用旧代码（`btn.textContent = undefined` 那种）是散文，
// 不该被判成「又抄了一份」。函数声明提升，上面的测试先于这里的定义也能用。
function codeOf(file) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s\/\/[^\n]*/g, '');
}

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
