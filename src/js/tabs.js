// tabs.js —— 把产物里那一排普通锚点 + 全部展开的区块，升级成真正的 tablist。
//
// 渐进增强的方向是用户裁定的：**默认全部展开，JS 起来才变 tab**。
// 所以 build.js 的产物里没有 role=tab、没有 aria-selected、没有 hidden ——
// 禁 JS 时它是三个能用的锚点链接和三段完整内容；这里加上去的 ARIA 才是唯一的状态源。
// 反过来说，本文件一旦跑起来就必须把 ARIA 写全，否则读屏用户拿到的是"看起来能切、
// 实际没有语义"的控件，比没有 tab 更糟。

export function initTabs() {
  const bar = document.querySelector('.tabs');
  const tabs = bar ? [...bar.querySelectorAll('.tab')] : [];
  // href 就是面板 id：无 JS 时它是滚动目标，有 JS 时它是 aria-controls。同一个真源。
  const panels = tabs.map((t) => document.getElementById((t.getAttribute('href') || '').slice(1)));

  // 少于两个区块就别 tab 化 —— 用户会砍区块，届时"只有一个标签的标签栏"是纯损失，
  // 退回长滚动才是对的。任何一个 href 找不到对应 id 也整体不升级（半升级更糟：
  // 会出现点了消失一块内容的 tab）。
  if (tabs.length < 2 || panels.some((p) => !p)) return () => {};

  const reel = bar.querySelector('.reel');
  let cur = -1;

  document.documentElement.classList.add('has-tabs');
  bar.setAttribute('role', 'tablist');
  tabs.forEach((tab, i) => {
    tab.id = `${panels[i].id}-tab`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', tab.id);
    // 面板自身可聚焦：键盘用户从 tab 跳到内容区时有一个落点。
    panels[i].tabIndex = -1;
  });

  function select(i, { focus = false, push = false } = {}) {
    const next = (i + tabs.length) % tabs.length;   // 首尾环绕：ArrowLeft 在第 0 个时回到最后一个
    cur = next;
    tabs.forEach((tab, k) => {
      const on = k === cur;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      // roving tabindex：整个 tablist 在 Tab 键序列里只占一格，方向键在内部移动。
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel, k) => {
      panel.hidden = k !== cur;
      if (k !== cur) return;
      // 先摘类再强制回流：不加这一次 reflow，连续两次切到同一个面板不会重播入场动画
      // （同名动画没被移除过，浏览器认为它还在跑）。
      panel.classList.remove('panel-enter');
      void panel.offsetWidth;
      panel.classList.add('panel-enter');
    });
    if (reel) reel.textContent = String(cur + 1).padStart(2, '0');
    // 地址栏跟着走，别用 location.hash 直接赋值：那会让浏览器去滚那个（刚显示出来的）锚点，
    // 用户会看到页面莫名跳一下。
    if (push) { try { history.pushState(null, '', `#${panels[cur].id}`); } catch (e) { /* file:// 下会抛，忽略 */ } }
    if (focus) tabs[cur].focus();
  }

  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = panels.findIndex((p) => p.id === id);
    return i < 0 ? null : i;   // 认不出的 hash（手打的、旧链接）不报错，交给默认第一个
  };

  const onClick = (e) => {
    const i = tabs.indexOf(e.currentTarget);
    if (i < 0) return;
    e.preventDefault();        // href 只在无 JS 时有意义；此刻必须拦住，否则默认跳转会和折叠态打架
    select(i, { push: true });
  };

  const onKey = (e) => {
    let i = null;
    if (e.key === 'ArrowRight') i = cur + 1;
    else if (e.key === 'ArrowLeft') i = cur - 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = tabs.length - 1;
    if (i === null) return;
    e.preventDefault();
    // 自动激活（焦点移到哪个就切哪个）是 ARIA tabs 的推荐做法；
    // 手动激活（要按 Enter）适合切换代价大的场景，我们这里代价是一个 14px 的入场动画。
    select(i, { focus: true, push: true });
  };

  const onHashChange = () => {
    const i = fromHash();
    if (i !== null && i !== cur) select(i);
  };

  tabs.forEach((tab) => tab.addEventListener('click', onClick));
  bar.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onHashChange);

  // 首屏：带 hash 深链就打开那一类（参照站也是 #products 这种形状），否则第一类。
  select(fromHash() ?? 0);

  return function destroy() {
    tabs.forEach((tab) => tab.removeEventListener('click', onClick));
    bar.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onHashChange);
    document.documentElement.classList.remove('has-tabs');
    bar.removeAttribute('role');
    tabs.forEach((tab, i) => {
      tab.removeAttribute('role');
      tab.removeAttribute('aria-selected');
      tab.removeAttribute('aria-controls');
      tab.removeAttribute('tabindex');
      tab.removeAttribute('id');
      panels[i].removeAttribute('role');
      panels[i].removeAttribute('aria-labelledby');
      panels[i].removeAttribute('tabindex');
      panels[i].hidden = false;      // 退回"全部展开"，与无 JS 的产物同构
    });
    if (reel) reel.textContent = '';
    cur = -1;
  };
}
