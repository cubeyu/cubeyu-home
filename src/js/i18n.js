// i18n.js —— 语言切换只干一件事：改 <html lang>。
// 不渲染任何文本、不碰 display、不增删 .i18n-* 类（spec 5.2）。
// 双语两套节点在构建时已烘进 dist/index.html，显隐由 base.css 的 :lang() 规则负责，
// 所以禁 JS 时页面仍是完整中文 —— 这是「构建时烘双语」相对「JS 重渲染」的实际收益。
import { readPref, writePref, nextCycle } from './prefs.js';
import { prefersEnglish, paintToggle } from './pref-ui.js';

const ORDER = ['zh', 'en'];

export function initLang() {
  // 默认值取 <html lang> 而不是写死 'zh'：模板改默认语言时这里不用跟着改。
  const stored = readPref('lang', document.documentElement.lang || 'zh');
  // 坏值（手改过存储得到的 'fr'）先归位。不归的话 paint 会把页面语种与按钮文案分开错，
  // 而 CSS 的 html:not(:lang(en)) 仍按中文显示 —— 文案与状态各说一半真话。
  // 回落方向与 nextCycle 对未知输入的处置一致：回到第 0 个，即模板的默认语言。
  // 同一份回落表也写在 build.js 的首帧守卫里（那边的判据是 `l==='en'` 白名单），
  // test/prefs.test.js 跑产物里那段脚本来核对两侧一致，不靠这句注释。
  let lang = ORDER.includes(stored) ? stored : ORDER[0];
  const btn = document.querySelector('[data-lang-toggle]');

  const paint = () => {
    document.documentElement.lang = lang;
    // 屏幕阅读器与搜索引擎依赖真实 lang。
    // 可见文字不随语种改写：构建烘的就是「中 / EN」两个选项，点了才换 —— 这正是
    // 「这是个二态开关」的自证。审查 I3 掉的是另一半：原先 paint() 把它收成当前语言一个词，
    // 于是无 JS 态（两项）与 JS 态（一项）对同一个控件给出两种承诺，而 aria-label 说的又是
    // 目标语言（`中` + "Switch to English"），名字与肉眼所见没有共同子串，踩 WCAG 2.5.3。
    // 现在按下标 0 取回的就是烘进属性那一串，写回与模板同值 → 零替换（与主题开关烘「自动」同理）。
    // 属性缺失 / 整套标签为空时画笔整段跳过：`btn.textContent = undefined` 会把「undefined」
    // 四个字印在导航条上（提交 1b46b6c 修的那个洞），留着烘好的「中 / EN」才是不出错的一侧。
    if (!btn) return;
    // aria-label 前缀跟着【切换后】的语种走：英文页面上读屏要念英文句子，
    // 而 nameOf 收到的是可见文字本身，所以无障碍名含住可见文字（Label in Name）。
    paintToggle(btn, 0, (text) => (prefersEnglish() ? `Switch language: ${text}` : `切换语言：${text}`));
  };

  // 控件是 <button type="button">（审查 I4）：原先的 `<a href="#">` + preventDefault 在无 JS 时
  // 是个会滚到页顶、什么都切的假链接，Ctrl/中键还会多开一个同页标签；真按钮没有默认跳转，
  // 不需要 preventDefault，无 JS 时点了不动 —— 与页脚主题开关一样诚实。
  // 焦点环由 base.css 的全局 :focus-visible 规则给（审查 I2）。
  if (btn) btn.addEventListener('click', () => {
    lang = nextCycle(ORDER, lang);
    writePref('lang', lang);
    paint();
  });

  paint();
}
