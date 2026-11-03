const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function i18n(zh, en) {
  return `<span class="i18n i18n-zh">${esc(zh)}</span><span class="i18n i18n-en">${esc(en)}</span>`;
}

export function renderTemplate(tpl, tokens) {
  const missing = [];
  // 单趟替换：值里的 {{ 不会被当成 token 再解析（用户文案可能含花括号）
  const out = tpl.replace(/\{\{(\w+)\}\}/g, (whole, name) => {
    if (!Object.hasOwn(tokens, name)) { missing.push(name); return whole; }
    return tokens[name];
  });
  if (missing.length) {
    throw new Error(`Unknown token(s): ${[...new Set(missing)].join(', ')}`);
  }
  return out;
}

// 合并顺序即层叠顺序，新增样式文件必须登记在此，否则不产出
export const cssOrder = [
  'tokens.css',
  'base.css',
  'loader.css',
  'pointer.css',
  'hero.css',
  'cards.css',
  'demos/inkmark.css',
];
