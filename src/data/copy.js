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

// 站点区链接，清单与取舍见 spec 7.2（条数不写死在这里，与卡数同一条不变量）。
// 判据：只放「只有在这里才能找到的入口」。因此——
//   已下线的不列：portfolio 子站、今日热榜（hot.techisle.top 实测 404）；
//   入口已在别处的不重复列：github.com/cubeyu 在导航右上角，邮箱在页脚。
export const links = [
  { name: 'ClawBase',   url: 'https://clawbase.cc',                    note: { zh: 'AI 代理部署聚合', en: 'Agent deploy guides' } },
  { name: '支持一下',    url: 'https://donate.techisle.top',            note: { zh: '赞赏', en: 'Buy me a coffee' } },
  { name: '站点监控',    url: 'https://check.techisle.top',             note: { zh: '可用性巡检', en: 'Uptime checks' } },
  { name: '哔哩哔哩',     url: 'https://space.bilibili.com/88154706',   note: { zh: '视频', en: 'Video' } },
];
