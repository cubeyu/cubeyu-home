// app.js —— 页面入口（dist/index.html 里那个 type=module 的脚本）。两件事：
// 1) 初始化两个偏好开关（明暗、语言）；
// 2) 按 [data-demo-root] 查注册表挂载微原型（spec 5.1 的挂载契约）。
// 样式在 <head> 里同步加载，而模块脚本是 deferred：跑到这里时 DOM 已经解析完，
// 所以不需要 DOMContentLoaded，也不需要等 CSS。
import { initTheme } from './theme.js';
import { initLang } from './i18n.js';
import { prefersEnglish } from './pref-ui.js';
import { initMascot } from './mascot.js';
import { initPointer } from './pointer.js';
import { initLoaderDrop } from './loader.js';
import { initTabs } from './tabs.js';
import demos from './demos/index.js';

// 两个开关互不依赖，谁先谁后都不影响对方的首帧（Task 9-10 审查 M5 把这条依赖拆掉了：
// 语言由 build.js 的首帧守卫在模块下载前写进 <html lang>，theme.js 又先注册 lang 观察者再首画）。
// test/pref-order.test.js 两种顺序都跑一遍，所以这里换行序不会红任何测试 ——
// 下面的挂载读 <html lang> 也是同一原因：它在两个 init 【之后】跑，
// 拿到的是已定型的语种，与这两行的先后无关。
initLang();
initTheme();

const mounted = new Map();
function mountDemos() {
  const ctx = {
    lang: prefersEnglish() ? 'en' : 'zh',
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  for (const root of document.querySelectorAll('[data-demo-root]')) {
    const name = root.dataset.demoRoot;
    const mount = demos[name];
    if (typeof mount !== 'function') continue;
    const input = root.querySelector('textarea');
    const draft = input && input.value !== input.defaultValue ? input.value : null;
    mounted.get(root)?.();
    mounted.set(root, mount(root, ctx));
    root.closest('.card').dataset.previewReady = 'true';
    // 换语言只翻译示例，不覆盖访客已经写下的内容。
    if (draft !== null) {
      const translatedInput = root.querySelector('textarea');
      translatedInput.value = draft;
      translatedInput.dispatchEvent(new Event('input'));
    }
  }
}
mountDemos();
new MutationObserver(mountDemos).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

// hero 吉祥物：狗跟随光标转头。与上面的 demo 注册表无关（它不是作品卡微原型，
// 是常驻装饰），所以不走 demos/index.js，也不受卡片数量与注册态影响。
// 触屏与 reduced-motion 下它自己会直接 return，不绑任何监听 —— 见 mascot.js。
initMascot();

// 把三区块折叠成 tablist。放在 demo 挂载【之后】：挂载遍历的是 [data-demo-root]，
// 与可见性无关，所以先挂后折不会漏掉任何面板里的 demo；反过来先折叠再挂载，
// 将来若有 demo 依赖 offsetWidth 量尺寸，就会在 hidden 面板里量到 0。
initTabs();

// 指针场 + 自定义光标：同一条 rAF、同一份平滑指针。
// 触屏与 reduced-motion 下它自己 return（并返回一个空 destroy），理由与 mascot.js 同一条：
// 没有可跟的指针时，绑监听等于让页面永久空转一条循环。
initPointer();

// 幕布上的狗落到 hero 里主人脚边那只狗的位置。
// 它【不摘幕布】—— 幕布仍由 loader.css 的动画自己滑走，这个装饰失败或没跑，
// 结果都只是"狗跟着幕布一起走掉"。顺序有讲究：必须在幕布的 animationstart(.9s) 之前挂上监听，
// 而模块是 deferred、最早也在首帧之后才执行，所以放在这里而不是文件末尾随便一处。
initLoaderDrop();
