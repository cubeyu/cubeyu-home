const LABELS = {
  zh: {
    title: '交互草图', caption: '示例金额', wechat: '微信', alipay: '支付宝',
    wechatStatus: '当前选择：微信', alipayStatus: '当前选择：支付宝',
    note: '交互示意，不会发起支付',
  },
  en: {
    title: 'Interaction sketch', caption: 'Example amount', wechat: 'WeChat', alipay: 'Alipay',
    wechatStatus: 'Selected: WeChat', alipayStatus: 'Selected: Alipay',
    note: 'Interaction demo · no payment will be made',
  },
};

export function mountDonatePage(el, ctx) {
  const T = LABELS[ctx.lang === 'en' ? 'en' : 'zh'];
  el.innerHTML = `
    <div class="d-donate demo-window">
      <div class="d-donate-bar demo-bar"><span>DonatePage</span><span>${T.title}</span></div>
      <div class="d-donate-sheet">
        <p class="d-donate-caption">${T.caption}</p>
        <p class="d-donate-amount">¥ 10.00</p>
        <div class="d-donate-controls demo-controls">
          <button type="button" class="d-donate-wechat demo-button" aria-pressed="true">${T.wechat}</button>
          <button type="button" class="d-donate-alipay demo-button" aria-pressed="false">${T.alipay}</button>
        </div>
        <p class="d-donate-status demo-result" aria-live="polite"></p>
      </div>
      <p class="d-donate-note demo-note">${T.note}</p>
    </div>`;

  const wechat = el.querySelector('.d-donate-wechat');
  const alipay = el.querySelector('.d-donate-alipay');
  const status = el.querySelector('.d-donate-status');
  const select = (isAlipay) => {
    wechat.setAttribute('aria-pressed', String(!isAlipay));
    alipay.setAttribute('aria-pressed', String(isAlipay));
    status.textContent = isAlipay ? T.alipayStatus : T.wechatStatus;
  };
  const onWechat = () => select(false);
  const onAlipay = () => select(true);
  wechat.addEventListener('click', onWechat);
  alipay.addEventListener('click', onAlipay);
  select(false);

  return function unmount() {
    wechat.removeEventListener('click', onWechat);
    alipay.removeEventListener('click', onAlipay);
    el.innerHTML = '';
  };
}
