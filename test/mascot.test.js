// hero 吉祥物的产物契约。
// 为什么单独一份：这次接线暴露的失效类是「资产在 src/ 里、构建不拷、页面 404」，
// 而当时 102 项测试与 11 项 check 全绿 —— 没有任何东西看得到 src/images/ 是否存在于产物。
// 这里钉住三件承重的事：图进了 dist、装饰对辅助技术隐藏、狗的图集列数与 JS 的帧数一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const DIST = 'dist/index.html';
const CSS = 'dist/assets/app.css';

test('mascot images are shipped into dist', () => {
  for (const f of ['hero-person', 'hero-person-dark', 'hero-dog', 'hero-dog-dark']) {
    assert.ok(existsSync(`dist/assets/images/${f}.webp`), `dist/assets/images/${f}.webp 缺失 —— build.js 的 images 拷贝被去掉了？`);
  }
});

test('hero illustration is present and hidden from assistive tech', () => {
  const html = readFileSync(DIST, 'utf8');
  assert.match(html, /class="hero-illo" aria-hidden="true"/, '吉祥物必须 aria-hidden：它是纯装饰，且人物狗都是 background-image，没有可命名的内容');
  assert.match(html, /data-mascot-dog/, '狗缺少 data-mascot-dog —— mascot.js 找不到挂载点，跟随会静默失效');
});

// 图集列数在三个地方必须一致：CSS 的 background-size、JS 的 FRAMES、实际图片尺寸。
// 任何一处漂了，狗都会显示成半只或错位的一格，而页面看起来仍然"正常"。
test('dog atlas column count agrees across CSS, JS and the image', () => {
  const css = readFileSync(CSS, 'utf8');
  const size = /(\d+)% 100%/.exec(css.match(/\.hero-dog\{[^}]*background-size:\s*([\d.]+)% 100%/s)?.[0] ?? '');
  assert.ok(size, '.hero-dog 的 background-size 必须是 <N>% 100%（N 列 1 行）');
  const cols = Math.round(Number(size[1]) / 100);

  const js = readFileSync('src/js/mascot.js', 'utf8');
  const frames = Number(/const FRAMES = (\d+)/.exec(js)?.[1]);
  assert.ok(frames, 'mascot.js 必须声明 FRAMES');
  assert.equal(cols, frames, `CSS 图集列数 ${cols} 与 JS FRAMES ${frames} 不一致`);

  // 图片实际宽度必须正好是 8 个等宽帧
  const src = readFileSync('src/js/mascot.js', 'utf8');
  assert.match(src, /frame \/ \(FRAMES - 1\)/, 'background-position 必须按 i/(FRAMES-1) 取值，与 background-size 的 N 列规则同一条');
});

test('mascot does not animate for reduced motion or touch', () => {
  const js = readFileSync('src/js/mascot.js', 'utf8');
  // 两个守卫都必须【提前 return】，而不是绑了监听再判断 —— 后者在触屏上仍会常驻监听器
  assert.match(js, /hover: hover[\s\S]{0,80}pointer: fine[\s\S]{0,120}return/, '触屏必须完全不绑指针监听');
  assert.match(js, /prefers-reduced-motion[\s\S]{0,120}return/, 'reduced-motion 必须不追踪，狗停在静止帧');
});
