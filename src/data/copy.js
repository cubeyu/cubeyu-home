export const sections = [
  // 标题里不写数量词：用户会换卡，「七个」在第一次换卡后就变成假话（Task 7-8 审查项 9）。
  { id: 'works',   eyebrow: '作品 / WORKS',  title: { zh: '能上手玩的东西', en: 'Things you can actually poke' } },
  { id: 'skills',  eyebrow: '技能 / SKILLS', title: { zh: '日常在用', en: 'In daily use' } },
  { id: 'sites',   eyebrow: '站点 / SITES',  title: { zh: '我维护的其它东西', en: 'Other things I run' } },
];

export const ui = {
  langZh: '中',
  langEn: 'EN',
  themeLabels: { zh: ['自动', '亮', '暗'], en: ['AUTO', 'LIGHT', 'DARK'] },
  copyright: { zh: '© 2026 麦希屿', en: '© 2026 Cubeyu' },
};

// 站点区 7 条，spec 7.2。portfolio 子站已退役，故不列入。
export const links = [
  { name: 'ClawBase',   url: 'https://clawbase.cc',                    note: { zh: 'AI 代理部署聚合', en: 'Agent deploy guides' } },
  { name: '今日热榜',    url: 'https://hot.techisle.top',               note: { zh: '热榜聚合接口', en: 'Trending API' } },
  { name: '支持一下',    url: 'https://donate.techisle.top',            note: { zh: '赞赏', en: 'Buy me a coffee' } },
  { name: '站点监控',    url: 'https://check.techisle.top',             note: { zh: '可用性巡检', en: 'Uptime checks' } },
  { name: 'github.com/cubeyu', url: 'https://github.com/cubeyu',       note: { zh: '代码', en: 'Source' } },
  { name: '哔哩哔哩',     url: 'https://space.bilibili.com/88154706',   note: { zh: '视频', en: 'Video' } },
  { name: 'cubeyu@aliyun.com', url: 'mailto:cubeyu@aliyun.com',        note: { zh: '邮箱', en: 'Email' } },
];
