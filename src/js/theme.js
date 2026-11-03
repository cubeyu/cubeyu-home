// theme.js —— 明暗三态的页脚开关：写 <html data-theme>、跟随系统变化、文案跟着语种走。
// 纯逻辑（循环、auto 展开、localStorage 读写）全在 prefs.js，那才能被 node --test 直接测；
// 碰 document / matchMedia 的部分在 pref-ui.js（spec 6.1、6.2）。
import { readPref, writePref, nextCycle, normalizeTheme } from './prefs.js';
import { systemDark, watchSystemDark, prefersEnglish, paintToggle } from './pref-ui.js';

const ORDER = ['auto', 'light', 'dark'];

export function applyTheme(mode) {
  document.documentElement.dataset.theme = normalizeTheme(mode, systemDark());
}

export function initTheme() {
  let mode = readPref('theme', 'auto');
  const btn = document.querySelector('[data-theme-toggle]');

  const paint = () => {
    applyTheme(mode);
    if (!btn) return;
    // 两套标签都烘在按钮属性上，按钮自己按 <html lang> 选。语言切换是 i18n.js 改的、
    // 主题文字是画笔写的 textContent，两套系统本来不相干 —— 但 CSS 的 .i18n-* 显隐罩不到
    // JS 写入的文本，所以这个按钮的文案必须由这里跟着语言走，否则整页英文而按钮仍写「暗」。
    const isEn = prefersEnglish();
    // 按下标取标签 + 写可见文字 + 写 aria-label 这条链在 pref-ui.js 的 paintToggle 里，
    // 语言开关共用同一支笔（审查 M4）。aria-label 用前缀式，含住可见文字（同 WCAG 2.5.3）。
    paintToggle(btn, ORDER.indexOf(mode), (text) => (isEn ? `Theme: ${text}` : `主题：${text}`));
  };

  // auto 态要跟随系统变化；light/dark 是用户显式选择，不再受系统影响
  watchSystemDark(() => {
    if (mode === 'auto') paint();
  });

  if (btn) {
    btn.addEventListener('click', () => {
      mode = nextCycle(ORDER, mode);
      writePref('theme', mode);
      paint();
    });
    // 语言偏好与主题偏好是两个互不相关的开关，唯一交叠处就是按钮文案。
    // 由这里观察 <html lang> 而不是让 i18n.js 回调 theme.js：i18n.js 的职责边界
    // 是「只改 document.documentElement.lang」（spec 5.2），不该知道主题存在。
    // 这一行必须在 paint() 之前：paint 第一次读 lang 时拿到的可能是模板的默认语种
    // （app.js 若把 initTheme 排在 initLang 前面就是这样），语种随后落定时靠这个观察者补一帧。
    // 加上 build.js 守卫里的语言首帧写入，正常路径下第一帧就已经是对的语种，这一帧不必发生。
    new MutationObserver(paint)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  paint();
}
