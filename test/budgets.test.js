// test/budgets.test.js —— 两条「全局预算」断言（Task 9-10 的裁定：从 test/data.test.js 迁出）。
// 迁出的理由不是内容变了，是名字误导：这两条扫的是产物 CSS 与产物 HTML 的预算上限，
// 与 src/data/* 那份文案数据无关。一个改 inkmark 样式的提交把 !important 数撞红时，
// 「data.test.js 失败」会把人往数据层引，而真凶在样式里。断言本体逐字搬来，语义一字未改。
//
// 与 check.js 的分工（同一道门禁不写两处，否则必漂）：
// check.js 管产物与源文件的契约（token 残留、数量对齐、字面色值、双语成对、零运行时依赖、
// demo 文件与注册表互等、样式全合并、必需片段落地、canonical 同源）；
// color-scheme / 全站唯一焦点环 与这两条预算归 test/。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 组件侧不许再抄时长：整份产物里 !important 只该有全局归零块那 5 条。
// 多一条就是某个组件自己开了口子（约束条：--ease-expo 唯一、时长只在 base.css 这一处归零）。
// 先剥注释再数与 data.test.js 里那条 reduced-motion 断言同口径 —— 注释里写 !important 不该算数。
test('the shipped CSS spends its whole !important budget on the global reduced-motion block', () => {
  const css = readFileSync('dist/assets/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal([...css.matchAll(/!important/g)].length, 5,
    '产物里的 !important 只许是全局 reduced-motion 那 5 条声明');
});

// 审查 I4 的产物面：卡标题在 url === '#' 时【不渲染 <a>】（Task 7-8 裁定），
// 语言开关从 <a href="#"> 换成真 <button>（同一处死链的另一个来源）。
// 两个产物都扫：404 也拿了同一个模板纪律，不该有例外。
test('neither artifact ships an href="#" dead link', () => {
  for (const page of ['dist/index.html', 'dist/404.html']) {
    const html = readFileSync(page, 'utf8');
    assert.ok(!html.includes('href="#"'),
      `${page}: 产物里不该有 href="#" 这种「看着能点、点了跳到页顶」的死链；卡链接按 spec 8.1 在占位时不渲染 <a>`);
  }
});
