// pref-ui.js —— 偏好开关的 DOM 侧，集中放 prefs.js 那份纯文件不能碰的东西：
// matchMedia 的系统深浅、按 <html lang> 判语种、以及「读 data-* → split(',') → 按下标取标签
// → 写 textContent / aria-label」这条画笔。
// 为什么单独一个文件而不是留在 theme.js / i18n.js：同一条链此前在两个开关里各写了一遍
// （Task 9-10 审查 M4），而 spec 6.2 禁的正是「一份偏好各写一遍」；M4 的动效开关是第三个，
// 它直接拿这里的 paintToggle，不必再抄。prefs.js 的「零 DOM」边界也因此保持成立（审查 M2）。
import { DARK_QUERY } from './prefs.js';

export function systemDark() {
  return matchMedia(DARK_QUERY).matches;
}

// auto 态要跟随系统变化；light/dark 是用户显式选择，由调用方自己判断要不要响应。
export function watchSystemDark(handler) {
  matchMedia(DARK_QUERY).addEventListener('change', handler);
}

// 当前语种的唯一真源是 <html lang> —— CSS 的 :lang() 显隐、屏幕阅读器、搜索引擎认的都是它，
// 这里跟着读，不再另存一份语言状态。
export function prefersEnglish() {
  return document.documentElement.lang === 'en';
}

// 标签只能从 DOM 属性进来：浏览器侧拿不到 src/data/*，构建时烘进 data-* 是唯一通道。
// 主题开关烘两套（data-labels-zh / data-labels-en，按当前语种取一套）；
// 语言开关只烘一套 data-labels（它的可见文字在两种语言下同为「中 / EN」）。
// 逗号是这两处的序列化定式，test/prefs.test.js 断言任何标签都不含逗号 ——
// 含逗号的标签会让 split(',') 之后的下标整体错位，而构建仍是绿的。
export function labelsOf(btn) {
  const byLang = prefersEnglish() ? btn.dataset.labelsEn : btn.dataset.labelsZh;
  const raw = byLang || btn.dataset.labelsZh || btn.dataset.labels;
  return (raw || '').split(',');
}

// 写一个开关的可见文字与无障碍名。
// aria-label 由调用方给的 nameOf 生成，且必须【包含】可见文字（WCAG 2.5.3 Label in Name，Level A）：
// 「中」配 "Switch to English" 那种各指一侧的写法读屏与肉眼没有共同子串，已按审查 I3 改掉，
// 前缀式（`主题：暗` / `切换语言：中 / EN`）是这里的唯一形状。
// 属性缺失或整套标签为空时整段跳过：`btn.textContent = undefined` 会把「undefined」印到页面上
// （提交 1b46b6c 修的那个洞），留着构建时烘好的文字反而是不出错的一侧。
export function paintToggle(btn, index, nameOf) {
  const labels = labelsOf(btn);
  const text = labels[index] ?? labels[0];
  if (!text) return null;
  btn.textContent = text;
  btn.setAttribute('aria-label', nameOf(text));
  return text;
}
