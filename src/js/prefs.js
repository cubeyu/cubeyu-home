// prefs.js —— 三个偏好（明暗 / 语言 / 动效）共用的读写工具，spec 6.2 明确禁止各写一份。
// 本文件刻意不含 DOM 依赖：readPref / writePref 只碰 localStorage，nextCycle / normalizeTheme
// 是纯函数，所以 test/prefs.test.js 能在纯 Node 里直接跑（node --test 不给 --localstorage-file，
// localStorage 求值为 undefined、调用其方法即抛 —— 与浏览器隐私模式抛异常是同一条 catch 路径）。
// 需要 document / matchMedia 的部分留在 theme.js 与 i18n.js。

// 键名前缀。'cubeyu-theme' 这个完整字面量是 build.js 的 ANTI_FLASH 内联脚本唯一的共享约定：
// 那段脚本在 CSS 加载前执行，那时模块还没开始下载，无法 import 这里，只能把键名再写一遍。
const PREFIX = 'cubeyu-';

export function readPref(key, fallback) {
  try { return localStorage.getItem(PREFIX + key) ?? fallback; }
  catch { return fallback; } // 隐私模式下 localStorage 会抛
}

export function writePref(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* 存不了也要能切 */ }
}

// 三态循环：到末尾回到起点；当前值不在序列里（手改过的坏数据、日后新增的态）落到第 0 个，
// 于是第一次点击就把偏好修正成合法值，而不是卡在 undefined 上。
export function nextCycle(order, current) {
  const i = order.indexOf(current);
  return order[i === -1 ? 0 : (i + 1) % order.length];
}

// auto 展开成具体主题；light / dark 是用户显式选的，系统偏好此时不再参与。
// 参数用 systemDark 而不是 theme 本身，是为了让这里保持纯函数、可在 Node 断言。
export function normalizeTheme(mode, systemDark) {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemDark ? 'dark' : 'light';
}

export function systemDark() {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
