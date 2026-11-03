/* mascot.js —— hero 吉祥物的狗跟随光标转头。
   为什么是 JS 而不是 CSS 动画：8 帧是【朝向】而不是【时间轴】，
   做成循环播放会让狗无目的地来回扭头。参照站那张图集的名字
   dog-look-angle-atlas 说明帧就是按角度排的 —— 帧索引应当由
   「光标在 hero 里的水平位置」决定，狗才会真的看向你指的方向。

   不做的事（有意，不是遗漏）：不叠 DOM 眼睛覆盖层。参照站的人物是空脸
   火柴人，眼珠必须另外画、另外驱动；本站的人物脸上已经画好眼睛和眼镜，
   再叠两层就是两双眼睛。要上瞳孔跟随得先生成一张空脸版本。 */

// 图集帧序（生成时按 4x2 网格的阅读顺序切片，见 .superpowers/build_mascot.py）：
//   0 正面看向读者 | 1 略向左 | 2 三分之四向左 | 3 完全左侧脸
//   4 略向右       | 5 三分之四向右 | 6 完全右侧脸 | 7 低头看左下
// 7 号不参与跟随：它是「低头」而不是某个水平角，映射到水平位置会显得抽风。
const FRONT = 0;
const MAX_LEFT = 3;
const RIGHT_SEQ = [0, 4, 5, 6];   // 正面 → 最右，必须走这条序，直接线性插值会跳过 4/5 的角度关系
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

  let frame = FRONT;
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

  hero.addEventListener('pointerleave', () => set(FRONT));
}

export function frameFor(t) {
  if (t < 0.5) {
    // 0 → MAX_LEFT 线性，t=0 时最左、t=.5 时回到正面
    return Math.round((0.5 - t) / 0.5 * MAX_LEFT);
  }
  const i = Math.round((t - 0.5) / 0.5 * (RIGHT_SEQ.length - 1));
  return RIGHT_SEQ[Math.min(RIGHT_SEQ.length - 1, i)];
}
