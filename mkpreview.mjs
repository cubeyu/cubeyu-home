// 一次性预览脚手架：把 assets/readme/*.svg 内联进 dist/_preview.html。
// 必须内联而不是 <img src>，因为 serve.js 的 TYPES 表没有 .svg，
// 走 <img> 会以 application/octet-stream 发出、浏览器拒绝当图片渲染。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const files = readdirSync('assets/readme').filter((f) => f.endsWith('.svg'));
const boards = [];
for (const f of files) {
  const raw = readFileSync(`assets/readme/${f}`, 'utf8');
  const inline = raw.replace(/ width="1200" height="\d+"/, '');
  const wrap = (w, label, cls) =>
    `<h2>${f} · ${label}</h2><div class="${cls}"><div style="width:${w}px">${inline}</div></div>`;
  boards.push(wrap(900, '900px 浅色页（GitHub 桌面内容列保守宽度）', 'gh-light'));
  boards.push(wrap(900, '900px 深色页（资产自带纸白底，应仍可读）', 'gh-dark'));
  boards.push(wrap(360, '360px 移动', 'gh-light'));
}

writeFileSync('dist/_preview.html', `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:14px ui-monospace,monospace;background:#0d1117;color:#c9d1d9;padding:24px}
h2{font-size:12px;font-weight:400;letter-spacing:.5px;color:#8b949e;margin:28px 0 10px}
.gh-light{background:#fff;padding:16px;border-radius:8px;width:max-content}
.gh-dark{background:#0d1117;padding:16px;border-radius:8px;width:max-content;border:1px solid #30363d}
svg{display:block;width:100%;height:auto}
</style></head><body>${boards.join('')}</body></html>`);
console.log('预览页已生成：', files.join(', '));
