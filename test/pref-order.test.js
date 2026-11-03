// test/pref-order.test.js —— 两个开关的初始化顺序不再承重（审查 M5），
// 以及语言控件换成真按钮后的可见文字 / 无障碍名契约（审查 I3、I4）。
// 桩在 test/pref-harness.js：一副最小假 DOM，加一个「执行产物里那段首帧守卫」的入口，
// 所以这里跑的是浏览器真正跑的那三段字节 + 两个真模块，不是重写一遍逻辑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ui } from '../src/data/copy.js';
import { withEnv, inlineGuardBody } from './pref-harness.js';

const LANG_EN = { 'cubeyu-lang': 'en' };

// M5 的考点原先是：app.js 里 initLang() 必须排在 initTheme() 之前，否则 theme.js 首画时
// 读到的 <html lang> 还是模板的 zh，英文用户的主题按钮文案停在「自动」。
// Task 11 要重写 app.js，换一行序不会红任何测试 —— 这条就是那张网：两种顺序都跑，
// 而且看的是主题按钮的【第一次】落笔，不是最终态（最终态靠观察者补，本来就是对的）。
test('the theme label is right on the first paint in either init order', () => {
  for (const order of [['lang', 'theme'], ['theme', 'lang']]) {
    withEnv({ lang: 'zh', stored: { ...LANG_EN, 'cubeyu-theme': 'auto' }, systemDark: false }, (env) => {
      env.runInlineGuard();          // <head> 里的守卫先跑，这是浏览器真实的时序
      assert.equal(env.html.lang, 'en', '守卫要把语言落到首帧');
      env.init(order);
      const first = env.painted('theme')[0];
      assert.equal(first.lang, 'en', `${order.join(' -> ')}：主题开关首画读到的 lang 该已是 en`);
      assert.equal(first.text, ui.themeLabels.en[0],
        `${order.join(' -> ')}：首画的文案必须是英文那一套`);
    });
  }
});

// 同一件事的反面证据：守卫还没上线时（比如 404 之外的旧产物、或有人把守卫删了），
// 换序也不该留下错文案 —— theme.js 的 lang 观察者排在它自己首画之前注册，补的那一帧在同一任务里。
test('swapping the init order still ends on the right label without the guard', () => {
  for (const order of [['lang', 'theme'], ['theme', 'lang']]) {
    withEnv({ lang: 'zh', stored: { ...LANG_EN }, systemDark: false }, (env) => {
      env.init(order);
      assert.equal(env.html.lang, 'en');
      assert.equal(env.themeBtn.textContent, ui.themeLabels.en[0],
        `${order.join(' -> ')}：终态文案必须是英文（观察者补帧）`);
      assert.ok(env.painted('theme').length >= (order[0] === 'theme' ? 2 : 1),
        '换序时主题按钮应被补画一次，说明观察者确实在首画之前挂上了');
    });
  }
});

// 审查 I3：无障碍名必须含住可见文字（WCAG 2.5.3 Label in Name, Level A）。
// 旧写法是可见文字「中」配 aria-label "Switch to English" —— 名字与肉眼所见零共同子串。
// 现在可见文字恒为烘进产物的「中 / EN」，名字是前缀式，且 paint 写回的就是同一串（零替换）。
test('the language control keeps both options visible and names itself after them', () => {
  const cases = [
    [{}, `切换语言：${ui.langZh} / ${ui.langEn}`],
    [LANG_EN, `Switch language: ${ui.langZh} / ${ui.langEn}`],
  ];
  for (const [stored, expectedAria] of cases) {
    withEnv({ lang: 'zh', stored: { ...stored, 'cubeyu-theme': 'auto' }, systemDark: false }, (env) => {
      env.runInlineGuard();
      env.init(['lang', 'theme']);
      assert.equal(env.langBtn.textContent, env.LANG_PAIR, '两个选项必须同时在场，不能收成当前语言一个词');
      assert.equal(env.langBtn.getAttribute('aria-label'), expectedAria);
      assert.ok(env.langBtn.getAttribute('aria-label').includes(env.langBtn.textContent),
        '无障碍名必须含住可见文字（Label in Name）');
      // 首画写回的文字与构建烘的完全相同 → 不发生文本替换（与主题开关烘「自动」同理）
      assert.equal(env.painted('lang')[0].text, env.LANG_PAIR);
    });
  }
});

// 审查 I4：`<a href="#">` + preventDefault 换成 `<button type="button">`。
// 这里钉三件事：处理器不再需要事件对象（click() 一个参数都不传）、偏好写进 cubeyu-lang、
// 主题按钮跟着 lang 观察者把文案换语种 —— 后者是跨开关那条链唯一仍在跑的通路。
test('clicking the language control needs no event object and re-paints the theme label', () => {
  withEnv({ lang: 'zh', stored: { 'cubeyu-theme': 'auto' }, systemDark: false }, (env) => {
    env.runInlineGuard();
    env.init(['lang', 'theme']);
    assert.equal(env.themeBtn.textContent, ui.themeLabels.zh[0]);
    env.click('lang');
    assert.equal(env.html.lang, 'en');
    assert.equal(env.store.get('cubeyu-lang'), 'en', '点击要持久化，否则刷新就丢');
    assert.equal(env.langBtn.textContent, env.LANG_PAIR, '点击后仍是两项同场');
    assert.equal(env.themeBtn.textContent, ui.themeLabels.en[0], '主题文案必须跟着换成语种对应的一套');
    env.click('lang');
    assert.equal(env.html.lang, 'zh');
    assert.equal(env.themeBtn.textContent, ui.themeLabels.zh[0]);
  });
});

// 主题开关自身的三态与 aria 前缀（同一支画笔的另一个调用点），顺带盯住 data-theme 真的翻转。
test('the theme toggle cycles auto -> light -> dark and paints both texts', () => {
  withEnv({ lang: 'zh', stored: {}, systemDark: true }, (env) => {
    env.runInlineGuard();
    env.init(['lang', 'theme']);
    assert.equal(env.html.dataset.theme, 'dark', 'auto + 系统暗 → 首帧 dark');
    const walk = [
      ['light', ui.themeLabels.zh[1], `主题：${ui.themeLabels.zh[1]}`],
      ['dark', ui.themeLabels.zh[2], `主题：${ui.themeLabels.zh[2]}`],
      ['auto', ui.themeLabels.zh[0], `主题：${ui.themeLabels.zh[0]}`],
    ];
    for (const [mode, text, aria] of walk) {
      env.click('theme');
      assert.equal(env.store.get('cubeyu-theme'), mode);
      assert.equal(env.themeBtn.textContent, text);
      assert.equal(env.themeBtn.getAttribute('aria-label'), aria);
      assert.ok(env.themeBtn.getAttribute('aria-label').includes(env.themeBtn.textContent));
    }
    // light / dark 是用户显式选择，系统色变化不该带走它
    env.click('theme');
    env.setSystemDark(false);
    assert.equal(env.html.dataset.theme, 'light');
    // 回到 auto 才跟随系统
    env.click('theme');
    env.click('theme');
    env.setSystemDark(false);
    assert.equal(env.store.get('cubeyu-theme'), 'auto');
    assert.equal(env.html.dataset.theme, 'light');
  });
});

// 坏值与存储被禁这两条降级路径：守卫与模块必须落在同一个语种上，
// 否则首帧中文、app.js 跑完变英文 —— I1 要防的就是这种二次改写。
test('bad and blocked preferences fall back the same way in the guard and in the modules', () => {
  for (const bad of ['fr', 'EN', 'english']) {
    withEnv({ lang: 'zh', stored: { ...{ 'cubeyu-lang': bad } }, systemDark: true }, (env) => {
      env.runInlineGuard();
      const afterGuard = env.html.lang;
      env.init(['lang', 'theme']);
      assert.equal(afterGuard, 'zh', `守卫该把坏值 ${bad} 留给模板的 zh`);
      assert.equal(env.html.lang, afterGuard, `模块对 ${bad} 的回落必须与守卫一致，不能二次改语种`);
      assert.equal(env.themeBtn.textContent, ui.themeLabels.zh[0]);
    });
  }
  // 存储被禁（隐私模式）：守卫读不到 → 主题按系统色、语言留 zh；模块同样落 zh
  withEnv({ lang: 'zh', stored: { 'cubeyu-lang': 'en' }, systemDark: true, storageBlocked: true }, (env) => {
    env.runInlineGuard();
    assert.equal(env.html.dataset.theme, 'dark', 'storage blocked must still paint the system colour');
    assert.equal(env.html.lang, 'zh');
    env.init(['lang', 'theme']);
    assert.equal(env.html.lang, 'zh');
    assert.equal(env.themeBtn.textContent, ui.themeLabels.zh[0]);
  });
});

// 守卫正文只该有一段，且它执行时只查共享的那一个查询串 ——
// 两条合起来是「首帧脚本没有第二份副本」的证据（另见 prefs.test.js 的 DARK_QUERY 单源断言）。
test('the inline guard shipped into dist is a single block', () => {
  const body = inlineGuardBody();
  assert.equal([...body.matchAll(/localStorage\.getItem/g)].length, 2,
    '守卫里只该有主题与语言两次读，第三读就是又抄了一份偏好');
  assert.match(body, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
});
