const LABELS = {
  zh: {
    title: '矿石行情', iron: '铁', gold: '金', diamond: '钻石', unit: '示例币 / 件',
    trends: ['走势：小幅回升', '走势：稳步上行', '走势：区间波动'], note: '示例行情 · 非实时数据',
  },
  en: {
    title: 'Mineral prices', iron: 'Iron', gold: 'Gold', diamond: 'Diamond', unit: 'demo coins / item',
    trends: ['Trend: gentle recovery', 'Trend: steady climb', 'Trend: fluctuating'], note: 'Example market · not live data',
  },
};
const QUOTES = [
  { key: 'iron', price: '32', points: '0,42 36,34 72,40 108,26 144,30 180,18 216,22 252,14' },
  { key: 'gold', price: '96', points: '0,46 36,42 72,35 108,36 144,24 180,20 216,13 252,8' },
  { key: 'diamond', price: '256', points: '0,26 36,12 72,32 108,16 144,38 180,22 216,10 252,24' },
];

export function mountOreMarket(el, ctx) {
  const T = LABELS[ctx.lang === 'en' ? 'en' : 'zh'];
  el.innerHTML = `
    <div class="d-ore demo-window">
      <div class="d-ore-bar demo-bar"><span>Ore market</span><span>${T.title}</span></div>
      <div class="d-ore-controls demo-controls">
        <button type="button" class="d-ore-iron demo-button" aria-pressed="true">${T.iron}</button>
        <button type="button" class="d-ore-gold demo-button" aria-pressed="false">${T.gold}</button>
        <button type="button" class="d-ore-diamond demo-button" aria-pressed="false">${T.diamond}</button>
      </div>
      <div class="d-ore-quote" aria-live="polite" aria-atomic="true">
        <span class="d-ore-name"></span>
        <p class="d-ore-value"><strong class="d-ore-price demo-result"></strong><span class="d-ore-unit">${T.unit}</span></p>
        <p class="d-ore-trend"></p>
      </div>
      <svg class="d-ore-chart" viewBox="0 0 252 54" aria-hidden="true" focusable="false">
        <path class="d-ore-grid" d="M0 12H252 M0 30H252 M0 48H252"></path>
        <polyline class="d-ore-line" points=""></polyline>
      </svg>
      <p class="d-ore-note demo-note">${T.note}</p>
    </div>`;

  const buttons = QUOTES.map((quote) => el.querySelector(`.d-ore-${quote.key}`));
  const name = el.querySelector('.d-ore-name');
  const price = el.querySelector('.d-ore-price');
  const trend = el.querySelector('.d-ore-trend');
  const line = el.querySelector('.d-ore-line');
  const select = (index) => {
    const quote = QUOTES[index];
    name.textContent = T[quote.key];
    price.textContent = quote.price;
    trend.textContent = T.trends[index];
    line.setAttribute('points', quote.points);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  };
  const handlers = QUOTES.map((_, index) => () => select(index));
  buttons.forEach((button, index) => button.addEventListener('click', handlers[index]));
  select(0);

  return function unmount() {
    buttons.forEach((button, index) => button.removeEventListener('click', handlers[index]));
    el.innerHTML = '';
  };
}
