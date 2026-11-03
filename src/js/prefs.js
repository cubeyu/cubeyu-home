// prefs.js —— 三个偏好（明暗 / 语言 / 动效）共用的读写工具，spec 6.2 明确禁止各写一份。
// 本文件零 DOM 依赖：readPref / writePref 只碰 localStorage，nextCycle / normalizeTheme
// 是纯函数，所以 test/prefs.test.js 能在纯 Node 里直接跑（node --test 不给 --localstorage-file，
// localStorage 求值为 undefined、调用其方法即抛 —— 与浏览器隐私模式抛异常是同一条 catch 路径）。
// 碰 document / matchMedia 的部分全在 pref-ui.js（那里有 DOM 侧的共用画笔）。

// 键名前缀。'cubeyu-theme' 这个完整字面量是 build.js 的 ANTI_FLASH 内联脚本唯一的共享约定：
// 那段脚本在 CSS 加载前执行，那时模块还没开始下载，无法 import 这里，只能把键名再写一遍。
const PREFIX = 'cubeyu-';

// 系统深浅的媒体查询。今天有三个消费点：pref-ui.js 的 systemDark()、pref-ui.js 的 change 监听、
// build.js 内联防闪烁脚本的模板插值 —— 三处原来是三份字面量，改一处就让首帧 auto 与运行期 auto
// 各按不同查询判（Task 9-10 审查 M2）。字符串本身不是 DOM，所以常量留在这份纯文件里，
// 两侧都能 import；真正调 matchMedia 的 systemDark() 挪到 pref-ui.js。
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readPref(key, fallback) {
  try { return localStorage.getItem(PREFIX + key) ?? fallback; }
  catch { return fallback; } // 隐私模式下 localStorage 会抛
}

export function writePref(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* 存不了也要能切 */ }
}

// 三态循环：到末尾回到起点。当前值不在序列里（手改过的坏数据、日后新增的态）时 indexOf 给 -1，
// 而 (-1 + 1) % order.length 就是 0 —— 落回第 0 个是同一个取模的自然结果，不是特例分支，
// 所以这里不再写 `i === -1 ? 0 : …`（那条三元与取模算出的是同一个下标，Task 9-10 审查 M1）。
export function nextCycle(order, current) {
  return order[(order.indexOf(current) + 1) % order.length];
}

// auto 展开成具体主题；light / dark 是用户显式选的，系统偏好此时不再参与。
// 参数用 systemDark 而不是 theme 本身，是为了让这里保持纯函数、可在 Node 断言。
export function normalizeTheme(mode, systemDark) {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemDark ? 'dark' : 'light';
}
