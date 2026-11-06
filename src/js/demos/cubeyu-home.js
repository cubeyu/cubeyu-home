const LABELS = {
  zh: { title: '主页缩影', work: '作品', skills: '技能', sites: '站点', note: '选择分类，看看我在做什么。' },
  en: { title: 'Home preview', work: 'Work', skills: 'Skills', sites: 'Sites', note: 'Pick a category to see what I build.' },
};
const SAMPLES = {
  work: 'ViteEditor / ShuiMoHome',
  skills: 'JavaScript / Vue / Java',
  sites: 'ClawBase / DonatePage',
};

export function mountCubeyuHome(el, ctx) {
  const T = LABELS[ctx.lang === 'en' ? 'en' : 'zh'];
  el.innerHTML = `
    <div class="d-home demo-window">
      <div class="d-home-bar demo-bar"><span>cubeyu /</span><span>${T.title}</span></div>
      <h4 class="d-home-title">Cubeyu<br><span class="d-home-builds">builds.</span></h4>
      <div class="d-home-controls demo-controls">
        <button type="button" class="d-home-work demo-button" aria-pressed="true">${T.work}</button>
        <button type="button" class="d-home-skills demo-button" aria-pressed="false">${T.skills}</button>
        <button type="button" class="d-home-sites demo-button" aria-pressed="false">${T.sites}</button>
      </div>
      <p class="d-home-result demo-result" aria-live="polite"></p>
      <p class="d-home-note demo-note">${T.note}</p>
    </div>`;

  const result = el.querySelector('.d-home-result');
  const keys = ['work', 'skills', 'sites'];
  const buttons = keys.map((key) => el.querySelector(`.d-home-${key}`));
  const select = (key) => {
    result.textContent = SAMPLES[key];
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(keys[index] === key)));
  };
  const handlers = keys.map((key) => () => select(key));
  buttons.forEach((button, index) => button.addEventListener('click', handlers[index]));
  select('work');

  return function unmount() {
    buttons.forEach((button, index) => button.removeEventListener('click', handlers[index]));
    el.innerHTML = '';
  };
}
