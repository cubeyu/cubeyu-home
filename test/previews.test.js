import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';

// Only parse the controlled markup's elements; missing selectors never invent nodes.
class PreviewNode extends EventTarget {
  constructor(tagName, attributes, text) {
    super();
    this.tagName = tagName;
    this.attributes = new Map(attributes);
    this.textContent = text;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

class PreviewRoot {
  nodes = [];
  writes = 0;
  markup = '';
  set innerHTML(value) {
    this.writes += 1;
    this.markup = value;
    this.nodes = [...value.matchAll(/<([a-z][\w-]*)\b([^>]*?)>([^<]*)/gi)].map(([, tag, attrs, text]) =>
      new PreviewNode(tag, [...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]), text.trim()));
  }
  get innerHTML() { return this.markup; }
  querySelector(selector) {
    assert.match(selector, /^\.[\w-]+$/, 'The harness supports class selectors only');
    return this.nodes.find((node) => (node.getAttribute('class') ?? '').split(/\s+/).includes(selector.slice(1))) ?? null;
  }
}

const DEMOS = [
  ['shuimo-home', 'mountShuimoHome'],
  ['cubeyu-home', 'mountCubeyuHome'],
  ['donate-page', 'mountDonatePage'],
  ['ctools', 'mountCTools'],
  ['ore-market', 'mountOreMarket'],
];
const click = (node) => node.dispatchEvent(new Event('click'));
const nodeState = (nodes) => nodes.map((node) => [node.textContent, [...node.attributes]]);
const text = (root) => root.nodes.map((node) => node.textContent).join(' ');

async function loadMount(slug, exportName) {
  let module;
  try {
    module = await import(`../src/js/demos/${slug}.js`);
  } catch (error) {
    assert.fail(`${slug} must provide a loadable preview: ${error.message}`);
  }
  assert.equal(typeof module[exportName], 'function');
  return module[exportName];
}

async function mountPreview(t, slug, exportName, lang) {
  const mount = await loadMount(slug, exportName);
  const root = new PreviewRoot();
  const unmount = mount(root, { lang });
  assert.equal(typeof unmount, 'function');
  const nodes = [...root.nodes];
  const buttons = nodes.filter((node) => node.tagName === 'button');
  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.equal(button.getAttribute('type'), 'button');
    assert.ok(button.textContent.trim());
    assert.equal(getEventListeners(button, 'click').length, 1);
  }
  assert.ok(nodes.every((node) => !['tab', 'tablist'].includes(node.getAttribute('role'))));
  if (lang === 'en') {
    assert.doesNotMatch(text(root), /[\u3400-\u9fff]/);
    for (const node of nodes) assert.doesNotMatch(node.getAttribute('aria-label') ?? '', /[\u3400-\u9fff]/);
  }
  t.after(() => {
    assert.equal(root.writes, 1, 'Interactions must not recreate the root or its focused buttons');
    assert.deepEqual(root.nodes, nodes);
    unmount();
    assert.equal(root.innerHTML, '');
    assert.equal(root.nodes.length, 0);
    for (const node of nodes) assert.equal(getEventListeners(node, 'click').length, 0);
    const detachedState = nodeState(nodes);
    buttons.forEach(click);
    assert.deepEqual(nodeState(nodes), detachedState, 'Detached controls must no longer update output');
  });
  return root;
}

function selected(buttons, index) {
  assert.deepEqual(buttons.map((button) => button.getAttribute('aria-pressed')),
    buttons.map((_, i) => String(i === index)));
}

for (const lang of ['zh', 'en']) {
  const en = lang === 'en';

  test(`shuimo-home ${lang}: clicks toggle only the local day/night state and labels`, async (t) => {
    const root = await mountPreview(t, 'shuimo-home', 'mountShuimoHome', lang);
    const panel = root.querySelector('.d-shuimo');
    const button = root.querySelector('.d-shuimo-toggle');
    const status = root.querySelector('.d-shuimo-status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.match(text(root), /Cubeyu/);
    for (const [mode, pressed, label, state] of [
      ['light', 'false', en ? 'Preview night' : '切换预览夜间', en ? 'Preview: day' : '预览：白昼'],
      ['dark', 'true', en ? 'Preview day' : '切换预览白昼', en ? 'Preview: night' : '预览：夜间'],
      ['light', 'false', en ? 'Preview night' : '切换预览夜间', en ? 'Preview: day' : '预览：白昼'],
    ]) {
      assert.equal(panel.getAttribute('data-mode'), mode);
      assert.equal(button.getAttribute('aria-pressed'), pressed);
      assert.equal(button.textContent, label);
      assert.equal(button.getAttribute('aria-label'), label);
      assert.equal(status.textContent, state);
      click(button);
    }
  });

  test(`cubeyu-home ${lang}: category buttons replace samples without replacing controls`, async (t) => {
    const root = await mountPreview(t, 'cubeyu-home', 'mountCubeyuHome', lang);
    const buttons = ['work', 'skills', 'sites'].map((key) => root.querySelector(`.d-home-${key}`));
    assert.deepEqual(buttons.map((button) => button.textContent), en ? ['Work', 'Skills', 'Sites'] : ['作品', '技能', '站点']);
    const result = root.querySelector('.d-home-result');
    assert.equal(result.getAttribute('aria-live'), 'polite');
    assert.equal(result.textContent, 'ViteEditor / ShuiMoHome');
    selected(buttons, 0);
    for (const [index, want] of [[1, 'JavaScript / Vue / Java'], [2, 'ClawBase / DonatePage'], [0, 'ViteEditor / ShuiMoHome'], [0, 'ViteEditor / ShuiMoHome']]) {
      click(buttons[index]);
      assert.equal(result.textContent, want);
      selected(buttons, index);
    }
  });

  test(`donate-page ${lang}: method selection reports a sample, never a payment`, async (t) => {
    const root = await mountPreview(t, 'donate-page', 'mountDonatePage', lang);
    const buttons = ['wechat', 'alipay'].map((key) => root.querySelector(`.d-donate-${key}`));
    assert.deepEqual(buttons.map((button) => button.textContent), en ? ['WeChat', 'Alipay'] : ['微信', '支付宝']);
    const status = root.querySelector('.d-donate-status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(root.querySelector('.d-donate-amount').textContent, '¥ 10.00');
    assert.equal(root.querySelector('.d-donate-caption').textContent, en ? 'Example amount' : '示例金额');
    assert.equal(root.querySelector('.d-donate-note').textContent, en ? 'Interaction demo · no payment will be made' : '交互示意，不会发起支付');
    assert.equal(status.textContent, en ? 'Selected: WeChat' : '当前选择：微信');
    selected(buttons, 0);
    for (const [index, want] of [[1, en ? 'Selected: Alipay' : '当前选择：支付宝'], [1, en ? 'Selected: Alipay' : '当前选择：支付宝'], [0, en ? 'Selected: WeChat' : '当前选择：微信']]) {
      click(buttons[index]);
      assert.equal(status.textContent, want);
      assert.equal(root.querySelector('.d-donate-amount').textContent, '¥ 10.00');
      selected(buttons, index);
    }
    assert.ok(root.nodes.every((node) => !['input', 'form', 'img', 'canvas'].includes(node.tagName)));
  });

  test(`ctools ${lang}: repeated joins rotate Alex and Steve in one live output`, async (t) => {
    const root = await mountPreview(t, 'ctools', 'mountCTools', lang);
    const button = root.querySelector('.d-ctools-join');
    const status = root.querySelector('.d-ctools-status');
    assert.equal(button.textContent, en ? 'Simulate player join' : '模拟玩家加入');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(root.querySelector('.d-ctools-note').textContent, en ? 'Local demo · no server connection' : '本地演示 · 不连接服务器');
    assert.match(root.querySelector('.d-ctools-welcome').textContent, en ? /Welcome/ : /欢迎/);
    assert.match(root.querySelector('.d-ctools-rules').textContent, en ? /Rules/ : /规则/);
    assert.equal(status.textContent, en ? '> Waiting for a simulated player.' : '> 等待模拟玩家加入。');
    for (const player of ['Alex', 'Steve', 'Alex', 'Steve', 'Alex']) {
      click(button);
      assert.equal(status.textContent, en
        ? `> ${player} joined the world.\n> Guide: type /help to read the rules.`
        : `> ${player} 进入了世界。\n> 指南：输入 /help 查看规则。`);
    }
  });

  test(`ore-market ${lang}: each mineral selects its own sample price, label and chart`, async (t) => {
    const root = await mountPreview(t, 'ore-market', 'mountOreMarket', lang);
    const buttons = ['iron', 'gold', 'diamond'].map((key) => root.querySelector(`.d-ore-${key}`));
    const names = en ? ['Iron', 'Gold', 'Diamond'] : ['铁', '金', '钻石'];
    assert.deepEqual(buttons.map((button) => button.textContent), names);
    const price = root.querySelector('.d-ore-price');
    const label = root.querySelector('.d-ore-name');
    const trend = root.querySelector('.d-ore-trend');
    const line = root.querySelector('.d-ore-line');
    assert.equal(root.querySelector('.d-ore-quote').getAttribute('aria-live'), 'polite');
    assert.equal(root.querySelector('.d-ore-chart').getAttribute('aria-hidden'), 'true');
    assert.equal(root.querySelector('.d-ore-chart').getAttribute('focusable'), 'false');
    assert.equal(root.querySelector('.d-ore-unit').textContent, en ? 'demo coins / item' : '示例币 / 件');
    assert.equal(root.querySelector('.d-ore-note').textContent, en ? 'Example market · not live data' : '示例行情 · 非实时数据');
    assert.equal(price.textContent, '32');
    assert.equal(label.textContent, names[0]);
    selected(buttons, 0);
    const initialLine = line.getAttribute('points');
    assert.match(initialLine, /^\d+,\d+( \d+,\d+)+$/);
    const charts = new Set([initialLine]);
    for (const [index, value, description] of [
      [1, '96', en ? 'Trend: steady climb' : '走势：稳步上行'],
      [2, '256', en ? 'Trend: fluctuating' : '走势：区间波动'],
      [0, '32', en ? 'Trend: gentle recovery' : '走势：小幅回升'],
    ]) {
      click(buttons[index]);
      assert.equal(price.textContent, value);
      assert.equal(label.textContent, names[index]);
      assert.equal(trend.textContent, description);
      selected(buttons, index);
      charts.add(line.getAttribute('points'));
    }
    assert.equal(charts.size, 3, 'The chart must change with the mineral');
    assert.equal(line.getAttribute('points'), initialLine);
  });
}

for (const [slug, exportName] of DEMOS) {
  test(`${slug}: instances are isolated and remounting resets state and language`, async () => {
    const mount = await loadMount(slug, exportName);
    const first = new PreviewRoot();
    const second = new PreviewRoot();
    const stopFirst = mount(first, { lang: 'zh' });
    const stopSecond = mount(second, { lang: 'en' });
    const firstNodes = [...first.nodes];
    const secondState = nodeState(second.nodes);
    const englishMarkup = second.innerHTML;
    const initialState = nodeState(firstNodes);
    const controls = firstNodes.filter((node) => node.tagName === 'button');
    click(controls.at(-1));
    assert.notDeepEqual(nodeState(firstNodes), initialState);
    assert.deepEqual(nodeState(second.nodes), secondState);
    stopFirst();
    assert.equal(first.innerHTML, '');
    firstNodes.forEach((node) => assert.equal(getEventListeners(node, 'click').length, 0));
    const stopRemount = mount(first, { lang: 'en' });
    assert.equal(first.innerHTML, englishMarkup);
    assert.deepEqual(nodeState(first.nodes), secondState);
    const remountedNodes = [...first.nodes];
    const secondNodes = [...second.nodes];
    stopRemount();
    stopSecond();
    assert.equal(first.innerHTML, '');
    assert.equal(second.innerHTML, '');
    [...remountedNodes, ...secondNodes].forEach((node) => assert.equal(getEventListeners(node, 'click').length, 0));
  });
}
