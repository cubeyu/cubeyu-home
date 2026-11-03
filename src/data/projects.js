// 作品卡数据。卡数不固定：渲染器、测试与 check 都按这份数组的长度算，别在任何地方写死数量。
// demo: null 表示纯纸面卡、无微原型；非空时它必须 === 本卡的 slug（src/js/demos/index.js 的命名约定，
// 由 check.js 的 DEMO_REGISTRY_MATCH 与 test/demos.test.js 的互等锁住）。
//
// 2026-11-03 换卡（用户在候选清单里点了这三张）：原先那批卡的项目在 GitHub 上查不到公开仓库，
// 换成 cubeyu 名下【可验证的自建项目】—— 同名 fork 与转载他人项目都不在内（判据与证据见 spec 7.1）。
// 文案按各仓库 README 的实际功能写，不写星数（会过期）、不写没实现的能力。
export const projects = [
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
