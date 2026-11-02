// build.js —— 模板渲染 + CSS 合并 + ES module 树拷贝，产出 dist/。
// 纯顶层脚本：不 export build()，也不加「我是不是被 import」的守卫。
// 理由（spec 5.3 裁定）：M1 内没有任何模块 import 本文件（check.js 只读 dist/ 产物），
// 而那个守卫在 Windows 上不可靠 —— process.argv[1] 是反斜杠形式，
// fileURLToPath(import.meta.url) 是正斜杠形式，比较结果取决于从哪里调用 node。
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTemplate, cssOrder } from './src/lib/build-utils.js';
import { site } from './src/data/site.js';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');

const tpl = readFileSync(join(root, 'src/templates/index.html'), 'utf8');

// 本任务只烘三个 token；nav / hero / 卡片区随 Task 7、8 增量加入。
const html = renderTemplate(tpl, {
  TITLE: site.title,
  DESCRIPTION: site.description,
  BUILD_PROBE: 'build ok',
});

// 合并顺序 = 层叠顺序，分隔注释形如 /* --- demos/x.css --- */，check.js 按它比对。
const css = cssOrder
  .map((f) => `/* --- ${f} --- */\n` + readFileSync(join(root, 'src/styles', f), 'utf8'))
  .join('\n');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'index.html'), html, 'utf8');
writeFileSync(join(out, 'assets/app.css'), css, 'utf8');
// 偏离 1：原样拷贝 ES module 树，不做拼接打包
cpSync(join(root, 'src/js'), join(out, 'assets/js'), { recursive: true });
console.log('built dist/');
