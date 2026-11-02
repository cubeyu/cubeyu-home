// test/data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/data/projects.js';
import { skills } from '../src/data/skills.js';
import { sections, ui, links } from '../src/data/copy.js';
import { site } from '../src/data/site.js';

const hasBoth = (o) => o && typeof o.zh === 'string' && o.zh.trim() !== '' && typeof o.en === 'string' && o.en.trim() !== '';

// 计划里的正则是 /^(https?:\/\/|#)$/ —— 那个 $ 让它只接受字面量 "https://"（无主机名），
// 会把 spec 7.1/7.2 已定稿的真实链接 https://hot.techisle.top 判成不合格，与 Step 7 期望的 PASS 自相矛盾。
// 这里按测试名本意修：带主机名的绝对 http(s)，或显式占位 '#'。裸 "https://" 仍不通过。
// 只写这一份：两处各抄一遍字面量，将来放松一处就会悄悄漏检。
const URL_OR_PLACEHOLDER = /^(https?:\/\/\S+|#)$/;

test('every card carries both languages', () => {
  for (const c of projects) {
    for (const key of ['label', 'cat', 'title', 'quote']) {
      assert.ok(hasBoth(c[key]), `${c.slug}.${key} must have non-empty zh and en`);
    }
    // spec 明写 demo 可以是 null，且卡数不固定，所以把形状也钉住：
    // 非空字符串或 null，别的（undefined / 数字 / 空串）直接失败并报出实际值。
    assert.ok(
      c.demo === null || (typeof c.demo === 'string' && c.demo.trim() !== ''),
      `${c.slug}.demo must be a non-empty string or null, got ${JSON.stringify(c.demo)}`,
    );
    // 判「有没有 demo」要看它是不是字符串，不能写成 c.demo !== null ——
    // 那个极性把 demo 漏写（undefined）当成「有 demo」，报错会指向 demoHint，把真凶藏起来。
    if (typeof c.demo === 'string') {
      assert.ok(hasBoth(c.demoHint), `${c.slug}.demoHint required when demo present`);
    }
  }
});

test('card numbering is sequential from N°01', () => {
  projects.forEach((c, i) => {
    assert.equal(c.no, `N°${String(i + 1).padStart(2, '0')}`, `${c.slug} should be N°${i + 1}`);
  });
});

test('slug is unique and filesystem-safe', () => {
  const slugs = projects.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/, `${s} must be lowercase-hyphen`);
});

// 原名「tags are latin strings」是假的：断言里既没有 latin 也没有非空，['', ''] 一样通过。
// 也不该去断言 latin —— 已批准文案里就有中文 tag（可视化 / 爬虫 / 键盘练习 / 单词记忆 / 博客系统）。
test('every card has at least one non-empty tag string', () => {
  for (const c of projects) {
    assert.ok(Array.isArray(c.tags) && c.tags.length >= 1, `${c.slug} needs tags`);
    for (const t of c.tags) {
      assert.equal(typeof t, 'string', `${c.slug} tag must be a string, got ${JSON.stringify(t)}`);
      assert.notEqual(t.trim(), '', `${c.slug} has an empty tag`);
    }
  }
});

// 只覆盖卡。sections 那条 `assert.match(s.url || '#', …)` 是空断言：sections 从来没有 url 键，
// `s.url || '#'` 恒等于 '#'，永远通过，删掉。要测 sections 的链接，先给它真 url 再说。
test('every card url is absolute http(s) or an explicit placeholder', () => {
  for (const c of projects) {
    assert.match(c.url, URL_OR_PLACEHOLDER, `${c.slug}.url = ${c.url} is not absolute`);
  }
});

test('skills list is the 13 finalized from spec section 8', () => {
  assert.equal(skills.length, 13);
  for (const s of skills) assert.ok(hasBoth(s));
});

// hasBoth 原先只跑在卡的 label/cat/title/quote/demoHint 与 skills 上；hero、区块标题、
// 页脚版权、站点区注记全是成对的，却不在这张网的覆盖里 —— 任一处掉成单语（EN-only / ZH-only）
// 测试不会响。这条把剩下的双语字段一次补齐。
test('hero, section titles, footer and site notes carry both languages', () => {
  site.hero.lines.forEach((line, i) => {
    assert.ok(hasBoth(line), `site.hero.lines[${i}] must have non-empty zh and en`);
  });
  // sub 原先是扁平的 subZh / subEn，形状和其余双语字段不一致，走不进通用 i18n 节点发射器。
  assert.ok(hasBoth(site.hero.sub), 'site.hero.sub must be { zh, en } with both sides non-empty');
  assert.ok(hasBoth(site.hero.scroll), 'site.hero.scroll must have non-empty zh and en');
  sections.forEach((s) => {
    assert.ok(hasBoth(s.title), `sections.${s.id}.title must have non-empty zh and en`);
  });
  assert.ok(hasBoth(ui.copyright), 'ui.copyright must have non-empty zh and en');
  links.forEach((l) => {
    assert.ok(hasBoth(l.note), `links["${l.name}"].note must have non-empty zh and en`);
  });
});

test('hero brand head matches the document title', () => {
  // spec 7.3：Cubeyu® 必须同时出现在 title 与 hero 大字
  assert.equal(site.hero.lines[0].zh, 'Cubeyu®');
  assert.ok(site.title.startsWith('Cubeyu®'));
  // 「hero 里没有代码诗人」不再在这里单独断言：site 已经在下面的全量扫描里，
  // 同一件事写两处，将来改扫法时只会改到一处。
});

test('no classical-Chinese branding anywhere', () => {
  // links 与 ui 同样是文案，之前没进扫描 = 网漏了两块。人工核过今天它们是干净的，
  // 补进来的意义在于以后往站点区加文案时网仍然罩得住。
  const blob = JSON.stringify({ projects, skills, sections, ui, links, site });
  for (const banned of ['代码诗人', '以墨为笔', '以码为诗', '水墨', '展 卷', '题跋']) {
    assert.ok(!blob.includes(banned), `found banned classical token: ${banned}`);
  }
});
