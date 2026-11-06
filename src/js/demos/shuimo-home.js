const LABELS = {
  zh: {
    title: '纸墨小站', intro: '在山水之间，写一点代码。',
    night: '切换预览夜间', day: '切换预览白昼',
    light: '预览：白昼', dark: '预览：夜间', note: '只改变这张小主页的昼夜。',
  },
  en: {
    title: 'Ink & paper', intro: 'A little code, a little quiet.',
    night: 'Preview night', day: 'Preview day',
    light: 'Preview: day', dark: 'Preview: night', note: 'Day and night stay inside this preview.',
  },
};

export function mountShuimoHome(el, ctx) {
  const T = LABELS[ctx.lang === 'en' ? 'en' : 'zh'];
  el.innerHTML = `
    <div class="d-shuimo demo-window" data-mode="light">
      <div class="d-shuimo-bar demo-bar"><span>ShuiMoHome</span><span>${T.title}</span></div>
      <div class="d-shuimo-landscape" aria-hidden="true"></div>
      <h4 class="d-shuimo-name">Cubeyu</h4>
      <p class="d-shuimo-intro">${T.intro}</p>
      <div class="d-shuimo-controls demo-controls">
        <button type="button" class="d-shuimo-toggle demo-button" aria-pressed="false"></button>
        <span class="d-shuimo-status" aria-live="polite"></span>
      </div>
      <p class="d-shuimo-note demo-note">${T.note}</p>
    </div>`;

  const panel = el.querySelector('.d-shuimo');
  const button = el.querySelector('.d-shuimo-toggle');
  const status = el.querySelector('.d-shuimo-status');
  let dark = false;
  const render = () => {
    panel.setAttribute('data-mode', dark ? 'dark' : 'light');
    button.setAttribute('aria-pressed', String(dark));
    button.textContent = dark ? T.day : T.night;
    button.setAttribute('aria-label', button.textContent);
    status.textContent = dark ? T.dark : T.light;
  };
  const toggle = () => { dark = !dark; render(); };
  render();
  button.addEventListener('click', toggle);

  return function unmount() {
    button.removeEventListener('click', toggle);
    el.innerHTML = '';
  };
}
