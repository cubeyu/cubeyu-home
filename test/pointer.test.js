// 指针场的产物与算法契约。
// 为什么值得单独一份：这类效果的失效方式全是"安静地不对"——
// 衰减写反会让光晕只在指针【外面】亮；生成判据少一条会让快速划动刷屏到掉帧；
// 触屏没挡住会让手机永久跑一条 rAF。页面看起来都正常，没有任何报错。
// 所以纯计算部分逐条断言，DOM 侧断言守卫的形状（与 mascot.test.js 同一分工）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GRID, RADIUS, SPEED, WAVE_LEN, MAX_RIPPLES, MOVE_DIST, MOVE_MS, IDLE_EPS,
  smoothstep, pointerGain, rippleWave, shouldSpawnMove, dotLevel,
  parseColor, withAlpha, lattice,
} from '../src/js/pointer.js';

test('pointer gain is strongest at the cursor and exactly zero at the radius', () => {
  assert.equal(pointerGain(0), 1, '指针正下方的点必须被推到最满');
  assert.equal(pointerGain(RADIUS), 0);
  assert.equal(pointerGain(RADIUS + 1), 0, '半径外必须严格为 0，否则整屏点阵都会跟着微动');
  // 单调不增：写反（越远越强）是最容易做出来又最难看出来的错
  let prev = Infinity;
  for (let d = 0; d <= RADIUS; d += 9) {
    const v = pointerGain(d);
    assert.ok(v <= prev + 1e-9, `衰减在 d=${d} 处回升了：${v} > ${prev}`);
    prev = v;
  }
});

test('ripple is a travelling wave packet, silent before arrival and after the front', () => {
  const rip = { x: 0, y: 0, t0: 0, amp: 4, life: 1000 };
  // 环还没走到这里 → 必须完全不动
  assert.equal(rippleWave(rip, 100, 10), 0, '波前未到就位移非零，点阵会在涟漪生成瞬间整体跳一下');
  // 波包长度走完之后 → 也必须是 0
  const pastFront = WAVE_LEN / SPEED + 1;
  assert.equal(rippleWave(rip, 0, pastFront), 0, '波尾过去之后还在推点，等于一条永不消失的涟漪');
  // 环速：距离 dist 的点是"什么时候"被推到的
  const dist = 200;
  const arrived = dist / SPEED;
  assert.ok(rippleWave(rip, dist, arrived + 1) !== 0, '按 SPEED 算出的到达时刻没有位移，环速与判据不一致');
  // 正弦波包必然有正有负（点先被推出去、再被拉回来），全正就不是波
  const samples = [];
  for (let t = arrived; t < arrived + WAVE_LEN / SPEED; t += 1) samples.push(rippleWave(rip, dist, t));
  assert.ok(samples.some((v) => v > 0) && samples.some((v) => v < 0), '位移全程同号：这是脉冲不是波');
  // 生命期一到就整条消失
  assert.equal(rippleWave({ ...rip, life: 500 }, dist, 600 + arrived), 0);
});

test('move ripples need BOTH distance and time, so fast drags do not flood the list', () => {
  assert.equal(shouldSpawnMove(null, 10, 10, 0), true, '第一条涟漪没有参照，必须能生成');
  const last = { x: 0, y: 0, t: 0 };
  assert.equal(shouldSpawnMove(last, 5, 5, 1000), false, '只挪了 5px 也生成：慢移会刷屏');
  assert.equal(shouldSpawnMove(last, 500, 0, 10), false, '距离够但 10ms 前刚发过：快划会刷屏');
  assert.equal(shouldSpawnMove(last, 500, 0, MOVE_MS), true);
  assert.equal(shouldSpawnMove(last, MOVE_DIST, 0, MOVE_MS), true, '判据是 >=，正好到阈值要算命中');
  assert.ok(MOVE_DIST > 0 && MOVE_MS > 0);
  assert.ok(MAX_RIPPLES <= 12, '涟漪上限失控就没有帧时预算可言');
});

test('dot draw level matches the resting grid', () => {
  assert.equal(dotLevel(0), 'dot', '静止态必须还是那张 22px 网格纸');
  assert.equal(dotLevel(0.02), 'dot');
  assert.equal(dotLevel(0.03), 'tint');
  assert.equal(dotLevel(0.62), 'tint');
  assert.equal(dotLevel(0.63), 'hot', '越过阈值不切强调色，涟漪外圈就没有"点亮"的观感');
});

test('lattice covers the viewport and is centred', () => {
  const l = lattice(1440, 820);
  assert.ok(l.ox + (l.cols - 1) * GRID >= 1440 - GRID, '列数不够，右半边没有点阵');
  assert.ok(l.oy + (l.rows - 1) * GRID >= 820 - GRID, '行数不够，下半边没有点阵');
  // 居中：第一格的原点落在 [0, GRID] 里，边缘不会出现半格
  assert.ok(l.ox > 0 && l.ox <= GRID, `横向原点偏到格子外：${l.ox}`);
  assert.ok(l.oy > 0 && l.oy <= GRID, `纵向原点偏到格子外：${l.oy}`);
});

test('palette strings from tokens.css parse into canvas-ready channels', () => {
  assert.deepEqual(parseColor('#FFD84D'), [255, 216, 77, 1]);
  assert.deepEqual(parseColor('#abc'), [170, 187, 204, 1]);
  assert.deepEqual(parseColor('rgba(26, 26, 26, .13)'), [26, 26, 26, 0.13]);
  assert.deepEqual(parseColor('rgb(26 26 26)'), [26, 26, 26, 1]);
  // 压缩器会把 rgba 改写成 8 位 hex（实测 dist 里 --field-dot 就是 #1a1a1a21）。
  // 这一条不是防御性冗余：只认 6 位时整场静默不启动，而页面看起来完全正常。
  assert.deepEqual(parseColor('#1a1a1a21'), [26, 26, 26, 0.129]);
  assert.deepEqual(parseColor('#fff8'), [255, 255, 255, 0.533]);
  assert.equal(withAlpha([26, 26, 26, 0.13], 0.5), 'rgba(26,26,26,0.5)');
  // 解析不出来时原样交回，让 canvas 自己判 —— 不许在这里 throw 把整场打死
  assert.equal(parseColor('currentColor'), 'currentColor');
  assert.equal(withAlpha('currentColor', 0.5), 'currentColor');
});

// 上面那条是手抄的期望，这一条直接读【产物】：源文件里的 rgba() 与压缩后的 #rrggbbaa
// 是同一条 token 的两种写法，只有拿出厂的那份来解析，才真的锁住这条链路。
test('every colour the field reads actually ships parseable', () => {
  const css = readFileSync('dist/assets/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // 指针只读取文档根的配色，卡内独立主题不会传回根元素。
  const palettes = [...css.matchAll(/(?:^|[{}])\s*(?::root|\[data-theme=["']?dark["']?\])\{([^{}]*)\}/g)].map((m) => m[1]).join(';');
  const names = ['--field-dot', '--field-hot', '--ink'];
  for (const name of names) {
    const all = [...palettes.matchAll(new RegExp(`\\${name}:\\s*([^;}]+)`, 'g'))].map((m) => m[1].trim());
    assert.ok(all.length >= 2, `${name} 在产物里只声明了 ${all.length} 次，明暗两档应当各一条`);
    for (const v of all) {
      assert.ok(Array.isArray(parseColor(v)), `${name} 的产物值 "${v}" 解析不出通道 —— pointer.js 会静默不启动`);
    }
  }
});

// 扫源码判"有没有字面色值"之前必须剥注释 —— 这条注释本身就在解释 8 位 hex 长什么样，
// 不剥的话判据会咬到自己写的说明。check.js 的 COLOR_LEAK 早就是先剥再扫，同一口径。
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('the field reads its colours from tokens, not from literals in JS', () => {
  const js = stripComments(readFileSync('src/js/pointer.js', 'utf8'));
  assert.match(js, /getPropertyValue\(/, '颜色必须从 computed style 读，不在 JS 里抄一份');
  assert.match(js, /pick\('--field-dot'\)/, '静止点色必须来自 --field-dot');
  assert.match(js, /pick\('--field-hot'\)/, '光点色必须来自 --field-hot');
  assert.doesNotMatch(js, /#[0-9a-f]{3,8}\b/, 'pointer.js 的【代码】里不许出现字面色值（只有 tokens.css 允许）');
  // 只禁"带数字的色值"：withAlpha 用 `rgba(${r},${g},${b},${a})` 拼串是这条链路的正确形状，
  // 禁掉它等于禁掉自己需要的写法。
  assert.doesNotMatch(js, /\brgba?\(\s*[\d.]/, '不许出现写死的 rgb()/rgba() 兜底值 —— 那是第二份真源');
  assert.match(js, /attributeFilter:\s*\[[^\]]*data-theme/, 'MutationObserver 必须盯 data-theme');
  // 兜底色值就是第二份真源，会跟 token 漂移；取不到就整场不启动。
  assert.match(js, /if \(!readPalette\(\)\) \{[\s\S]{0,120}return \(\) => \{\};/,
    '取不到 token 时必须安静降级，而不是拿兜底色画一屏错色');
});

test('the loop is guarded, idle-stoppable, and fully torn down', () => {
  const js = readFileSync('src/js/pointer.js', 'utf8');
  // 触屏与减弱动效必须【提前 return】，不是绑了监听再判断
  assert.match(js, /hover: hover[\s\S]{0,80}pointer: fine[\s\S]{0,120}return/, '触屏必须完全不启用指针场');
  assert.match(js, /prefers-reduced-motion[\s\S]{0,120}return/, 'reduced-motion 必须完全不启用');
  // 静止即停：否则页面永久挂一条 rAF，Lighthouse 的节流帧与笔记本电量都付这个账
  assert.match(js, /if \(ripples\.length > 0[\s\S]{0,400}start\(\);/, 'frame 末尾要按"还有东西要画"决定要不要续帧');
  assert.match(js, /if \(raf \|\| document\.hidden\) return/, 'hidden 时不排新帧');
  // destroy 必须把每一条 addEventListener 与 observe 都摘掉
  for (const ev of ['resize', 'pointermove', 'pointerdown', 'pointerover', 'pointerleave', 'blur', 'visibilitychange']) {
    assert.match(js, new RegExp(`removeEventListener\\(['"]${ev}['"]`), `destroy() 漏了 ${ev}`);
  }
  assert.match(js, /observer\.disconnect\(\)/, 'destroy() 必须断开 MutationObserver');
  assert.match(js, /root\.classList\.remove\('has-pointer'\)/,
    'destroy() 必须收回 cursor:none —— 只藏不还原会把用户的原生光标永久弄丢');
  // 判据只看真的赋值（文件头那条注释里就写着这个单词，扫全文会自己咬自己一口）
  assert.doesNotMatch(js, /\.innerHTML\s*=/, 'JS 不写 HTML 串（本站没有不可信字符串进 DOM 的路，纪律照留）');
});

test('smoothstep endpoints and idle epsilon are sane', () => {
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.ok(smoothstep(0.5) === 0.5, 'smoothstep 在中点是 0.5（v²(3−2v) 的性质），写错成 v³ 就不是');
  assert.ok(IDLE_EPS > 0 && IDLE_EPS < 1, `静止判据要在一像素以内：${IDLE_EPS}`);
  assert.ok(SPEED > 0, '环速必须为正，否则涟漪不向外走');
});
