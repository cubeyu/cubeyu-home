// app.js —— 页面入口（dist/index.html 里那个 type=module 的脚本）。两件事：
// 1) 初始化两个偏好开关（明暗、语言）；
// 2) 按 [data-demo-root] 查注册表挂载微原型（spec 5.1 的挂载契约）。
// 样式在 <head> 里同步加载，而模块脚本是 deferred：跑到这里时 DOM 已经解析完，
// 所以不需要 DOMContentLoaded，也不需要等 CSS。
import { initTheme } from './theme.js';
import { initLang } from './i18n.js';
import { prefersEnglish } from './pref-ui.js';
import demos from './demos/index.js';

// 两个开关互不依赖，谁先谁后都不影响对方的首帧（Task 9-10 审查 M5 把这条依赖拆掉了：
// 语言由 build.js 的首帧守卫在模块下载前写进 <html lang>，theme.js 又先注册 lang 观察者再首画）。
// test/pref-order.test.js 两种顺序都跑一遍，所以这里换行序不会红任何测试 ——
// 下面的挂载读 <html lang> 也是同一原因：它在两个 init 【之后】跑，
// 拿到的是已定型的语种，与这两行的先后无关。
initLang();
initTheme();

// DemoCtx（spec 5.1）。语种取 pref-ui.js 的 prefersEnglish() 而不是再读一次 <html lang> 字符串：
// 那里已经是「非 en 一律按 zh 画」的唯一判据，与 base.css 的 :lang() 显隐同口径，
// 第三份副本会让卡面文字与 demo 内部文字各走一边。
// prefersReducedMotion 走 matchMedia —— CSS 那半边由 base.css 的全局归零块管，
// JS 驱动的循环（计时器、rAF、自动播放）只有这里给得到的这个布尔能停。
// 媒体查询串写在这里是当前的唯一一份：M4 的 reveal/cursor 落地时若出现多处消费，再抽公共文件；
// 现在抽进 pref-ui.js 或 prefs.js 都是给还没写的消费者预留位置。
const ctx = {
  lang: prefersEnglish() ? 'en' : 'zh',
  prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

for (const root of document.querySelectorAll('[data-demo-root]')) {
  const name = root.dataset.demoRoot;
  const mount = demos[name];
  // 查不到即静默跳过，卡片降级为纸面卡。用户会换卡、也会砍卡，这里不许 throw（spec 5.1）。
  // 拼错注册名连空壳都不会留：build.js 的注册态门禁不输出 data-demo 与 .card-demo，
  // 而拼错本身由 check.js（Task 12）的 DEMO_REGISTRY_MATCH 大声报出来。
  if (typeof mount !== 'function') continue;
  // 返回值是卸载函数。M1 没有任何卸载路径（切语言不重挂，编排留到 M3 一次处理全部 demo），
  // 所以这里今天不消费它 —— 契约由 test/demos.test.js 的假 DOM 钉住，不会被静改掉。
  mount(root, ctx);
}
