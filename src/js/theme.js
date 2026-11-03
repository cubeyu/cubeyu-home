// theme.js —— 明暗三态的 DOM 侧：写 <html data-theme>、挂页脚开关、跟随系统变化。
// 纯逻辑（循环、auto 展开、localStorage 读写）全在 prefs.js，那才能被 node --test 直接测；
// 这里只留碰 document / matchMedia 的部分（spec 6.1）。
import { readPref, writePref, nextCycle, normalizeTheme, systemDark } from './prefs.js';

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
    // 主题文字是这里写的 textContent，两套系统本来不相干 —— 但 CSS 的 .i18n-* 显隐罩不到
    // JS 写入的文本，所以这个按钮的文案必须由 theme.js 跟着语言走，否则整页英文而按钮仍写「暗」。
    const isEn = document.documentElement.lang === 'en';
    const labels = ((isEn ? btn.dataset.labelsEn : btn.dataset.labelsZh)
      || btn.dataset.labelsZh || '').split(',');
    const text = labels[ORDER.indexOf(mode)] ?? labels[0];
    btn.textContent = text;
    // aria-label 带上前缀，读屏时不会只听到一个孤零零的「暗 / DARK」。
    // 值取当前可见标签而不是内部的 'auto' 这类英文 token：中文态念出「主题：auto」是混语种。
    btn.setAttribute('aria-label', isEn ? `Theme: ${text}` : `主题：${text}`);
  };

  // auto 态要跟随系统变化；light/dark 是用户显式选择，不再受系统影响
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
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
    new MutationObserver(paint)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  paint();
}
