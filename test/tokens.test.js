// test/tokens.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');

// 注释先剥掉：注释里的中文、`{`、`}` 或示例 `--x:` 都会污染下面的块体切分。
// 只影响扫描用的副本，三条既有断言仍对着原文。
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

// 取选择器对应块体的内容（不含最外层花括号）：从选择器后第一个 `{` 起按
// 花括号配平找到与之配对的那个 `}`。旧写法把块体切成 indexOf('{') 到
// indexOf('}')，起点含 `{`，再配 `^\s*(--…)` 的行首锚点，于是单行块
// `:root { --dur-enter: .01ms; }` 一个变量都抓不到。
function blockBody(selector) {
  const start = code.indexOf(selector);
  assert.notEqual(start, -1, `${selector} not found`);
  const open = code.indexOf('{', start);
  assert.notEqual(open, -1, `${selector} has no block body`);
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  assert.fail(`${selector} block has no matching }`);
}

// 声明的形态是 `--名字:`。不再依赖行首锚点，因此与「每个变量是否各占一行」无关；
// (?<!var\() 把 `var(--x)` 这类引用点排除掉，避免把消费点当成声明。
function varsIn(blockSelector) {
  return [...blockBody(blockSelector).matchAll(/(?<!var\()\s*(--[\w-]+)\s*:/g)].map(m => m[1]);
}

// :root 的地板值。spec 4.1 的亮色颜色变量正好 12 个，而暗色完整性断言真正关心的
// 就是这 12 个。低于地板说明抓到的不是那个 :root —— 例如 @media 里的单行 :root，
// 或块体切分又退化成了空串；此时 missing 会是空数组，测试会在什么都没测的情况下 PASS。
const MIN_ROOT_VARS = 12;

function rootVars() {
  const vars = varsIn(':root');
  assert.ok(
    vars.length >= MIN_ROOT_VARS,
    `:root 只抓到 ${vars.length} 个变量（${vars.join(', ') || '无'}），低于地板 ${MIN_ROOT_VARS}：` +
      '块体切分失效或误抓了 @media 内的 :root，暗色覆盖完整性测试会退化成永远 PASS 的空测试',
  );
  return vars;
}

// 主题中性变量：字体、缓动、时长、布局尺寸。这些明暗共用，允许不在 dark 里出现。
const THEME_NEUTRAL = new Set([
  '--font-sans', '--font-mono', '--ease-expo', '--dur-enter',
  '--col', '--rule-w', '--radius-sm', '--radius-pill',
  // 开屏时序：时长不随配色变，属同一类中性变量
  '--loader-hold', '--hero-start',
]);

test('every non-neutral token is redefined for dark', () => {
  const light = rootVars();
  const dark = new Set(varsIn('[data-theme="dark"]'));
  const missing = light.filter(v => !THEME_NEUTRAL.has(v) && !dark.has(v));
  assert.deepEqual(missing, [], `missing dark overrides: ${missing.join(', ')}`);
});

test(':root is scanned as a block, not by line shape', () => {
  const light = rootVars();
  // 首、末两个声明都能抓到，说明切分覆盖整块，而不是只覆盖某几行
  assert.ok(light.includes('--paper'), 'first declared token --paper should be captured');
  assert.ok(light.includes('--dur-enter'), 'last declared token --dur-enter should be captured');
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
