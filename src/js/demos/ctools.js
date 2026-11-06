const LABELS = {
  zh: {
    title: '玩家事件', welcome: '> 欢迎来到 CTools 本地面板。',
    rules: '> 规则：友善交流，尊重他人建筑。', waiting: '> 等待模拟玩家加入。',
    join: '模拟玩家加入', note: '本地演示 · 不连接服务器',
    events: [
      '> Alex 进入了世界。\n> 指南：输入 /help 查看规则。',
      '> Steve 进入了世界。\n> 指南：输入 /help 查看规则。',
    ],
  },
  en: {
    title: 'Player events', welcome: '> Welcome to the local CTools panel.',
    rules: '> Rules: be kind; respect other builds.', waiting: '> Waiting for a simulated player.',
    join: 'Simulate player join', note: 'Local demo · no server connection',
    events: [
      '> Alex joined the world.\n> Guide: type /help to read the rules.',
      '> Steve joined the world.\n> Guide: type /help to read the rules.',
    ],
  },
};

export function mountCTools(el, ctx) {
  const T = LABELS[ctx.lang === 'en' ? 'en' : 'zh'];
  el.innerHTML = `
    <div class="d-ctools demo-window">
      <div class="d-ctools-bar demo-bar"><span>CTools /</span><span>${T.title}</span></div>
      <div class="d-ctools-terminal">
        <p class="d-ctools-welcome"></p>
        <p class="d-ctools-rules"></p>
        <p class="d-ctools-status demo-result" aria-live="polite" aria-atomic="true"></p>
      </div>
      <div class="d-ctools-controls demo-controls">
        <button type="button" class="d-ctools-join demo-button">${T.join}</button>
      </div>
      <p class="d-ctools-note demo-note">${T.note}</p>
    </div>`;

  const button = el.querySelector('.d-ctools-join');
  const status = el.querySelector('.d-ctools-status');
  el.querySelector('.d-ctools-welcome').textContent = T.welcome;
  el.querySelector('.d-ctools-rules').textContent = T.rules;
  status.textContent = T.waiting;
  let nextPlayer = 0;
  const join = () => {
    status.textContent = T.events[nextPlayer];
    nextPlayer = (nextPlayer + 1) % T.events.length;
  };
  button.addEventListener('click', join);

  return function unmount() {
    button.removeEventListener('click', join);
    el.innerHTML = '';
  };
}
