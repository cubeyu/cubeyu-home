import { initTheme } from './theme.js';
import { initLang } from './i18n.js';
// 两个开关互不依赖，谁先谁后都不影响对方的首帧（Task 9-10 审查 M5 把这条依赖拆掉了：
// 语言由 build.js 的首帧守卫在模块下载前写进 <html lang>，theme.js 又先注册 lang 观察者再首画）。
// Task 11 重写这个文件时可以随意换行序；test/pref-order.test.js 两种顺序都跑一遍。
initLang();
initTheme();
