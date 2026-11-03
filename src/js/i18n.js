// i18n.js —— 语言切换只干一件事：改 <html lang>。
// 不渲染任何文本、不碰 display、不增删 .i18n-* 类（spec 5.2）。
// 双语两套节点在构建时已烘进 dist/index.html，显隐由 base.css 的 :lang() 规则负责，
// 所以禁 JS 时页面仍是完整中文 —— 这是「构建时烘双语」相对「JS 重渲染」的实际收益。
import { readPref, writePref, nextCycle } from './prefs.js';

const ORDER = ['zh', 'en'];

export function initLang() {
  // 默认值取 <html lang> 而不是写死 'zh'：模板改默认语言时这里不用跟着改。
  const stored = readPref('lang', document.documentElement.lang || 'zh');
  // 坏值（手改过存储得到的 'fr'）先归位。不归的话 paint 会把按钮写成「EN」，
  // 而 CSS 的 html:not(:lang(en)) 仍按中文显示 —— 文案与状态各说一半真话。
  // 回落方向与 nextCycle 对未知输入的处置一致：回到第 0 个，即模板的默认语言。
  let lang = ORDER.includes(stored) ? stored : ORDER[0];
  const btn = document.querySelector('[data-lang-toggle]');

  const paint = () => {
    document.documentElement.lang = lang;
    // 屏幕阅读器与搜索引擎依赖真实 lang
    if (btn) {
      const [zh, en] = (btn.dataset.labels || '').split(',');
      btn.textContent = lang === 'zh' ? zh : en;
      // aria-label 说的是「切过去之后的语言」，与可见文字（当前语言）分指两侧是有意的：
      // 读屏用户听到的正是他即将进入的语种。
      btn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
    }
  };

  if (btn) btn.addEventListener('click', (e) => {
    // href="#" 是无 JS 时的兜底（点了不会 404），有 JS 时把这个跳转拦掉，
    // 否则每次切语言都在地址栏追加一个 #，页面还会滚回顶部。
    e.preventDefault();
    lang = nextCycle(ORDER, lang);
    writePref('lang', lang);
    paint();
  });

  paint();
}
