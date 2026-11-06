// demos/index.js —— 微原型注册表（spec 5.1）。
// 注册名 === 文件名 === projects.js 的 demo 字段，三者由 test/demos.test.js 的
// 「registry keys match the files on disk」互等锁住：加一个 demo 就多一行注册 + 一个文件，
// 少任何一个都会红，而这里没有任何写死的数量。
// 两个消费方读的都是这一份：
// · build.js 在 Node 里 import 它做「注册态门禁」—— data-demo 与 .card-demo 只在名字已注册时输出，
//   所以未实现的 demo 不会在 M1 截图里留一个空心盒子；
// · app.js 在浏览器里按 [data-demo-root] 查它挂载，查不到即静默降级为纸面卡。
// 因此本文件与它 import 的每个 demo 都不得在模块求值期碰 DOM —— 那会把构建打断。
import { mountVitepressOnlineEditor } from './vitepress-online-editor.js';
import { mountShuimoHome } from './shuimo-home.js';
import { mountCubeyuHome } from './cubeyu-home.js';
import { mountDonatePage } from './donate-page.js';
import { mountCTools } from './ctools.js';
import { mountOreMarket } from './ore-market.js';

export default {
  'vitepress-online-editor': mountVitepressOnlineEditor,
  'shuimo-home': mountShuimoHome,
  'cubeyu-home': mountCubeyuHome,
  'donate-page': mountDonatePage,
  ctools: mountCTools,
  'ore-market': mountOreMarket,
};
