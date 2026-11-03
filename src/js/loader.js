// loader.js —— 开屏那只狗从幕布里"跳下来"，落到 hero 里主人脚边那只狗的位置。
//
// 承重前提（不许反过来）：幕布的退场仍然是 loader.css 里那条纯 CSS 动画，
// 本文件只做装饰。它不执行、报错、或目标量不出来时，唯一正确的结果是
// "狗跟着幕布一起走掉"，页面其余部分不受任何影响 —— 这条契约由
// test/loader.test.js 的三条断言钉着（forwards/both、visibility:hidden、reduce 下整块不存在）。
//
// 参照站那版是 JS 摘幕布 + 8s 上限兜底；我们不需要上限，因为幕布根本不归 JS 管。

export function initLoaderDrop() {
  // 减弱动效：幕布整块不存在（loader.css），mark 也就无处可寻，这里再兜一层。
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const curtain = document.querySelector('.site-loader');
  const mark = curtain && curtain.querySelector('.site-loader-mark');
  const illo = document.querySelector('.hero-illo');
  const target = document.querySelector('[data-mascot-dog]');
  if (!mark || !illo || !target) return () => {};

  let clone = null;
  let timer = 0;

  // 目标此刻被入场动画的 translateY 压在下边，而我们要的是它【动画结束后】的位置。
  // 那条动画只平移，所以从 computed transform 的矩阵里把当前的 ty 减掉就是终态 ——
  // 不用等、不用猜 12% 这个数，也不用管量测发生在动画的哪一刻。
  //
  // 两个矩形都要换算成【文档坐标】（加 scrollX/scrollY），因为克隆体是 absolute 定位：
  // 用视口坐标的话，用户在飞行的那半秒里滚一下页，狗就会钉在原来的屏幕位置上，
  // 看起来像"落到下面的 tab 条上去了"（实测被用户抓到）。换成文档坐标后它跟着页面走，
  // 滚到哪都落在真狗身上。
  function rectInDocument(el, dy) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY - (dy || 0),
      width: r.width,
      height: r.height,
    };
  }

  function landingRect() {
    const ty = new DOMMatrixReadOnly(getComputedStyle(illo).transform).f;
    return rectInDocument(target, ty);
  }

  function land() {
    if (!clone) return;
    const gone = clone;
    clone = null;
    window.clearTimeout(timer);
    gone.remove();
  }

  function promote() {
    if (clone) return;
    const from = rectInDocument(mark);
    const to = landingRect();
    // 幕布已经掀完、或目标还没布局（宽度 0）、或落在文档可视区外：什么都不做。
    if (from.width <= 0 || to.width <= 0) return;

    clone = document.createElement('span');
    clone.className = 'loader-drop';
    clone.setAttribute('aria-hidden', 'true');
    // 几何交给 CSS 自定义属性，关键帧负责插值：JS 一帧都不写，
    // reduced-motion 的全局时长归零因此天然罩得住这条动画。
    clone.style.setProperty('--drop-x', `${to.left - from.left}px`);
    clone.style.setProperty('--drop-y', `${to.top - from.top}px`);
    clone.style.setProperty('--drop-sx', String(to.width / from.width));
    clone.style.setProperty('--drop-sy', String(to.height / from.height));
    clone.style.left = `${from.left}px`;
    clone.style.top = `${from.top}px`;
    clone.style.width = `${from.width}px`;
    clone.style.height = `${from.height}px`;
    document.body.append(clone);
    // 原件藏起来：它还要跟着幕布一起滑走，但同屏不该出现两只狗。
    mark.style.visibility = 'hidden';

    // 落定后先【留着】：hero 的吉祥物此刻还在从下方升起，克隆体正好盖在它的终点上，
    // 等 illo 的入场动画结束再摘 —— 那一刻真狗已经到位，摘掉是无缝的。
    // 反过来一落地就摘，会出现"狗闪一下又消失"的空档。
    illo.addEventListener('animationend', land, { once: true });
    // 兜底：animationend 因任何原因没来（例如别的脚本改了动画），也不能让克隆体永久赖在页面上。
    timer = window.setTimeout(land, 4000);
  }

  // 时机不靠再抄一遍 --loader-hold：直接听幕布自己的 animationstart，
  // 两处写同一个 .9s 迟早会漂（token 存在的意义就是只有一份）。
  curtain.addEventListener('animationstart', promote, { once: true });

  return function destroy() {
    curtain.removeEventListener('animationstart', promote);
    illo.removeEventListener('animationend', land);
    window.clearTimeout(timer);
    if (clone) clone.remove();
    clone = null;
    mark.style.visibility = '';
  };
}
