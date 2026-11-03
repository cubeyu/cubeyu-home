// 作品卡数据。卡数不固定：渲染器、测试与 check 都按这份数组的长度算，别在任何地方写死数量。
// demo: null 表示纯纸面卡、无微原型；非空时它必须 === 本卡的 slug（src/js/demos/index.js 的命名约定，
// 由 check.js 的 DEMO_REGISTRY_MATCH 与 test/demos.test.js 的互等锁住）。
//
// 2026-11-03 换卡：原先那批卡的项目在 GitHub 上查不到公开仓库，换成【可验证的自建项目】——
// cubeyu 名下同名 fork 与转载他人项目都不在内（判据与证据见 spec 7.1 换卡更正）。
// 文案按各仓库 README / 站点 manifest 的实际功能写：不写星数、不写作品件数（都会过期）、不写没实现的能力。
// 顺序 = 分量：小工具合集（61 件、线上可玩）在最前，其后是在线编辑器、上一版主页、MC 服务端插件。
export const projects = [
  {
    slug: 'seed-toolkit',
    label: { zh: '即点即用', en: 'Point and use' },
    cat: { zh: '合集', en: 'Collection' },
    title: { zh: '模力全开 · 小工具合集', en: 'A Collection of Mini Tools' },
    quote: { zh: '用豆包 Seed 做的一批小工具：粘一段会议记录就出行动项表，排一周菜单顺带生成采购清单，每件点开就能玩。',
             en: 'A batch of small tools built on Doubao Seed. Paste meeting notes and get an action table; plan a week of meals and it writes the shopping list. Every one runs in the browser.' },
    tags: ['豆包 Seed', '纯静态', '零构建'],
    demo: null,
    url: 'https://cubeyu.rth1.xyz/',
  },
  {
    slug: 'vitepress-online-editor',
    label: { zh: '实时渲染', en: 'Live render' },
    cat: { zh: '编辑器', en: 'Editor' },
    title: { zh: 'VitePress 在线编辑器', en: 'VitePress Online Editor' },
    quote: { zh: '在浏览器里写 Markdown，右边实时跟着变，点一下发回 GitHub。',
             en: 'Write Markdown in the browser — the right pane keeps up as you type, one click pushes it back to GitHub.' },
    tags: ['Vue', 'VitePress', 'Markdown'],
    demo: 'vitepress-online-editor',
    demoHint: { zh: '在左边改几个字，看右边怎么跟着变。',
                en: 'Type in the left pane and watch the right keep up.' },
    url: 'https://github.com/cubeyu/vitepress-online-editor',
  },
  {
    slug: 'simple-homepage',
    label: { zh: '配置驱动', en: 'JSON-driven' },
    cat: { zh: '主页', en: 'Homepage' },
    title: { zh: 'Simple Homepage', en: 'Simple Homepage' },
    quote: { zh: '就是被这个站换掉的那一版主页，Vue 3 写的，内容全在一个 JSON 里，改几行字就是你自己的。',
             en: 'The homepage this one replaced. Built on Vue 3, everything lives in one JSON file — change a few lines and it is yours.' },
    tags: ['Vue', 'Vite', 'JSON 配置'],
    demo: null,
    url: 'https://github.com/cubeyu/Simple-Homepage',
  },
  {
    slug: 'ctools',
    label: { zh: '自动播报', en: 'Auto log' },
    cat: { zh: '插件', en: 'Plugin' },
    title: { zh: 'CTools 服务端插件', en: 'CTools' },
    quote: { zh: '给 Minecraft 服务端装的一包管理功能：进退场提示、萌新指南、禁用命令，1.8 到 1.21 都能跑。',
             en: 'A bundle of admin features for a Minecraft server — join and leave banners, a beginner guide GUI, blocked commands. Runs on 1.8 through 1.21.' },
    tags: ['Java', 'Minecraft', 'PlaceholderAPI'],
    demo: null,
    url: 'https://github.com/cubeyu/CTools',
  },
];
