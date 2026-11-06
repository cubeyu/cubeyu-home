import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('src/js/app.js', 'utf8').replace(/^import .*;\r?\n/gm, '');

function boot() {
  const html = { lang: 'zh' };
  const card = { dataset: {} };
  const root = { dataset: { demoRoot: 'sample' }, input: null, closest: () => card, querySelector() { return this.input; } };
  const calls = [];
  let unmounts = 0;
  let callback;
  const noop = () => {};
  runInNewContext(source, {
    initLang: noop, initTheme: noop, initMascot: noop, initPointer: noop, initLoaderDrop: noop, initTabs: noop,
    document: { documentElement: html, querySelectorAll: () => [root] },
    prefersEnglish: () => html.lang === 'en',
    matchMedia: () => ({ matches: false }),
    Event,
    MutationObserver: class {
      constructor(fn) { callback = fn; }
      observe() {}
    },
    demos: {
      sample(el, ctx) {
        calls.push(ctx.lang);
        el.input = { value: ctx.lang, defaultValue: ctx.lang, dispatchEvent: noop };
        return () => { unmounts += 1; el.input = null; };
      },
    },
  });
  return { html, card, root, calls, unmounts: () => unmounts, changeLanguage(lang) { html.lang = lang; callback?.(); } };
}

test('a successful preview mount enables its card layout', () => {
  const env = boot();
  assert.equal(env.card.dataset.previewReady, 'true');
});

test('language changes unmount old previews and mount translated controls', () => {
  const env = boot();
  env.changeLanguage('en');
  env.changeLanguage('zh');
  assert.deepEqual(env.calls, ['zh', 'en', 'zh']);
  assert.equal(env.unmounts(), 2);
});

test('a language change preserves edited preview text, including an empty draft', () => {
  for (const draft of ['my own draft', '']) {
    const env = boot();
    env.root.input.value = draft;
    env.changeLanguage('en');
    assert.equal(env.root.input.value, draft);
  }
});

test('an untouched preview sample changes with its language', () => {
  const env = boot();
  env.changeLanguage('en');
  assert.equal(env.root.input.value, 'en');
});
