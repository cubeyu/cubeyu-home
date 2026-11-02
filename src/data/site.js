// 站点身份层（Task 6 由 Task 4 的三字段最小版扩成完整版）。
// title / description 定稿值来自 spec 7.3，不得改写。
export const site = {
  title: 'Cubeyu® — 麦希屿',
  description: 'Cubeyu 的个人作品、AI 工具实操、产品开发与开源项目记录。',
  url: 'https://techisle.top/',
  hero: {
    // 逐词遮罩三行。字头 Cubeyu® 与 title 同一符号（spec 7.3 互为约束）
    lines: [
      { zh: 'Cubeyu®', en: 'Cubeyu®' },
      { zh: 'builds', en: 'builds' },
      { zh: 'small tools.', en: 'small tools.' },
    ],
    // 副行也走 { zh, en } 形状，和其余双语字段一致，可直接进通用 i18n 节点发射器。
    // 旧的 subZh / subEn 扁平字符串是单语泄漏最可能发生的地方（Task 7 消费）。
    sub: { zh: '麦 希 屿', en: 'DEVELOPER / AI TOOLS / OPEN-SOURCE' },
    scroll: { zh: '↓ 往下滑', en: '↓ scroll' },
  },
  nav: { githubText: 'github.com/cubeyu', githubUrl: 'https://github.com/cubeyu' },
};
