// test/pref-harness.js —— 偏好开关的行为测试桩：一副最小假 DOM + 产物里那段首帧守卫的执行器。
// 为什么单独成文件而不是各写一份：test/prefs.test.js（纯断言守卫写出的值）与
// test/pref-order.test.js（断言两个开关的初始化顺序不再承重）要的是同一副桩，
// 而 spec 6.2 禁的正是「同一件事写两遍」。
// 收集规则：node --test test/ 只收 *.test.js，本文件不是测试文件，只是被两侧 import
// （实测加一个顶层 throw 的 test/tmp-probe-helper.js 不影响 npm test 的结果）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initTheme } from '../src/js/theme.js';
import { initLang } from '../src/js/i18n.js';
import { ui } from '../src/data/copy.js';

// build.js 烘进产物的两副 data-* 属性，这里按同一种拼法重搭一次形状：
// 主题开关两套标签（data-labels-zh / data-labels-en），语言开关一套（data-labels = 可见文字）。
// 产物本身的断言在 test/data.test.js 扫 dist/index.html；这里要的是「模块能跑起来」。
const LANG_PAIR = `${ui.langZh} / ${ui.langEn}`;
const THEME_BUTTON = '[data-theme-toggle]';
const LANG_BUTTON = '[data-lang-toggle]';

// 产物里的内联守卫：无属性 <script> 只有一段（模块脚本带 type/src，正则抓不到）。
// 拿产物而不是拿 build.js 的源码，是因为要执行的正是浏览器执行的字节 —— 含 DARK_QUERY 的插值结果。
export function inlineGuardBody() {
  const html = readFileSync('dist/index.html', 'utf8');
  const bodies = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(bodies.length, 1, 'dist/index.html 必须恰好一段内联守卫，多写就等于「一份偏好各写一遍」又回来了');
  return bodies[0];
}

export function makeEnv({
  lang = 'zh', stored = {}, systemDark = false, storageBlocked = false,
} = {}) {
  const state = { systemDark, storageBlocked };
  const store = new Map(Object.entries(stored));
  const observers = [];
  const mediaQueries = [];
  const changeHandlers = [];
  const paints = [];

  const html = { dataset: {}, _lang: lang };
  Object.defineProperty(html, 'lang', {
    get() { return this._lang; },
    set(v) {
      this._lang = v;
      // 真 MutationObserver 的微任务在这里同步派发：测试要的是「补一帧之后的状态」，
      // 不是那一帧的时序，同步派发让断言写得直白。
      for (const cb of observers) cb();
    },
  });

  function button(who, dataset, bakedText) {
    const btn = {
      dataset, attrs: {}, handlers: [], _text: bakedText, _who: who,
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return (k in this.attrs ? this.attrs[k] : null); },
      addEventListener(type, cb) { this.handlers.push(cb); },
    };
    Object.defineProperty(btn, 'textContent', {
      get() { return this._text; },
      set(v) { paints.push({ who, lang: html.lang, text: v }); btn._text = v; },
    });
    return btn;
  }

  const buttons = {
    [THEME_BUTTON]: button('theme', {
      labelsZh: ui.themeLabels.zh.join(','),
      labelsEn: ui.themeLabels.en.join(','),
    }, ui.themeLabels.zh[0]),
    [LANG_BUTTON]: button('lang', { labels: LANG_PAIR }, LANG_PAIR),
  };

  const env = {
    html, buttons, paints, store, mediaQueries, LANG_PAIR,
    themeBtn: buttons[THEME_BUTTON],
    langBtn: buttons[LANG_BUTTON],
    // 首帧：执行产物里那段守卫（浏览器在 <head> 里跑的就是它），不碰两个模块。
    runInlineGuard() {
      new Function('document', 'localStorage', 'matchMedia', inlineGuardBody())(
        globalThis.document, globalThis.localStorage, globalThis.matchMedia);
      return env;
    },
    // 浏览器里 i18n 与 theme 都由 app.js 触发；顺序由调用方给，这是 M5 的考点。
    init(order) {
      for (const name of order) {
        if (name === 'lang') initLang();
        else if (name === 'theme') initTheme();
        else throw new Error(`unknown init step: ${name}`);
      }
      return env;
    },
    // 不传事件对象：控件换成真 <button> 之后处理器不再需要 preventDefault（审查 I4）。
    click(who) {
      const btn = who === 'theme' ? buttons[THEME_BUTTON] : buttons[LANG_BUTTON];
      assert.ok(btn.handlers.length >= 1, `${who} toggle must have a click handler bound`);
      for (const cb of btn.handlers) cb();
      return env;
    },
    painted(who) {
      return paints.filter((p) => p.who === who);
    },
    setSystemDark(v) {
      state.systemDark = v;
      for (const cb of changeHandlers) cb({ matches: v });
      return env;
    },
    _media: () => ({
      get matches() { return state.systemDark; },
      addEventListener(type, cb) { changeHandlers.push(cb); },
    }),
    _storage: () => ({
      getItem: (k) => {
        if (state.storageBlocked) throw new Error('SecurityError: localStorage is blocked');
        return store.has(k) ? store.get(k) : null;
      },
      setItem: (k, v) => store.set(k, String(v)),
    }),
  };

  const saved = {};
  const globals = {
    document: { documentElement: html, querySelector: (sel) => (sel in buttons ? buttons[sel] : null) },
    matchMedia: (q) => { mediaQueries.push(q); return env._media(); },
    MutationObserver: class {
      constructor(cb) { observers.push(cb); }
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  saved.localStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, writable: true, value: env._storage(),
  });

  env.dispose = () => {
    for (const [name, desc] of Object.entries(saved)) {
      if (desc) Object.defineProperty(globalThis, name, desc);
      else delete globalThis[name];
    }
  };
  return env;
}

// withEnv 保证桩一定被拆掉：同进程后续测试（含 prefs.test.js 的 withStorage）
// 看到的不该是一副假存储或假 document。
export function withEnv(opts, fn) {
  const env = makeEnv(opts);
  try {
    return fn(env);
  } finally {
    env.dispose();
  }
}
