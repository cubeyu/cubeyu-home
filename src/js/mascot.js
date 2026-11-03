/* mascot.js —— hero 吉祥物的狗跟随光标转头。
   为什么是 JS 而不是 CSS 动画：8 帧是【朝向】而不是【时间轴】，
   做成循环播放会让狗无目的地来回扭头。参照站那张图集的名字
   dog-look-angle-atlas 说明帧就是按角度排的 —— 帧索引应当由
   「光标在 hero 里的水平位置」决定，狗才会真的看向你指的方向。

   不做的事（有意，不是遗漏）：不叠 DOM 眼睛覆盖层。参照站的人物是空脸
   火柴人，眼珠必须另外画、另外驱动；本站的人物脸上已经画好眼睛和眼镜，
   再叠两层就是两双眼睛。要上瞳孔跟随得先生成一张空脸版本。 */

// 图集帧序（新Atlas：狗的基础姿态是【抬头深情看着主人】，不是正面）：
//   0 抬头看主人（右上） 1 抬头看主人（左上） 2 抬头角度较缓 3 正面看向读者
//   4 完全左侧脸         5 右侧四分之三      6 完全右侧脸     7 低头看地
// 静止态用 0：那是这张图最暖的一帧，也是参照站那个姿势的意思。
// 光标横扫只用 4→2→3→5→6 这五帧，1 和 7 不参与跟随：
// 1 与 0 几乎同形（横移时看不出变化），7 是「低头」不是某个水平角，映射到水平位置会显得抽风。
const IDLE = 0;
const SWEEP = [4, 2, 3, 5, 6];
const FRAMES = 8;

export function initMascot() {
  const dog = document.querySelector('[data-mascot-dog]');
  const hero = document.querySelector('.hero');
  if (!dog || !hero) return;

  // 触屏 / 无指针设备完全不绑监听：光标语义在这类设备上不存在，
  // 让狗停在正面帧比猜一个朝向更诚实。
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  // reduced-motion 下不追踪，狗停在静止帧，页面依然完整可读。
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let frame = IDLE;
  let raf = 0;

  const paint = () => {
    raf = 0;
    // 第 i 列的 background-position-x = i / (FRAMES - 1) * 100%，
    // 与 hero.css 的 background-size: 800% 100%（8 列）是同一条取值规则。
    dog.style.backgroundPosition = `${(frame / (FRAMES - 1)) * 100}% 50%`;
  };

  const set = (next) => {
    if (next === frame) return;
    frame = next;
    // 同一帧内多次 move 合并成一次写入，避免每个 mousemove 都触发样式计算
    if (!raf) raf = requestAnimationFrame(paint);
  };

  // t = 光标在 hero 内的水平比例：0 最左 → 狗看向最左，.5 → 正面，1 最右 → 看向最右
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    if (r.width === 0) return;
    set(frameFor(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))));
  });

  hero.addEventListener('pointerleave', () => set(IDLE));
}

export function frameFor(t) {
  return SWEEP[Math.round(t * (SWEEP.length - 1))];
}
