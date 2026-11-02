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
