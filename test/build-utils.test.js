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
