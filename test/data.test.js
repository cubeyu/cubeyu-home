// test/data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/data/projects.js';
import { skills } from '../src/data/skills.js';
import { sections } from '../src/data/copy.js';
import { site } from '../src/data/site.js';

const hasBoth = (o) => o && typeof o.zh === 'string' && o.zh.trim() !== '' && typeof o.en === 'string' && o.en.trim() !== '';

test('every card carries both languages', () => {
  for (const c of projects) {
    for (const key of ['label', 'cat', 'title', 'quote']) {
      assert.ok(hasBoth(c[key]), `${c.slug}.${key} must have non-empty zh and en`);
    }
    if (c.demo !== null) assert.ok(hasBoth(c.demoHint), `${c.slug}.demoHint required when demo present`);
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

test('tags are latin strings', () => {
  for (const c of projects) {
    assert.ok(Array.isArray(c.tags) && c.tags.length >= 1, `${c.slug} needs tags`);
    for (const t of c.tags) assert.equal(typeof t, 'string');
  }
});

// 计划里的正则是 /^(https?:\/\/|#)$/ —— 那个 $ 让它只接受字面量 "https://"（无主机名），
// 会把 spec 7.1/7.2 已定稿的真实链接 https://hot.techisle.top 判成不合格，与 Step 7 期望的 PASS 自相矛盾。
// 这里按测试名本意修：带主机名的绝对 http(s)，或显式占位 '#'。裸 "https://" 仍不通过。
test('every url is absolute http(s) or an explicit placeholder', () => {
  for (const c of projects) {
    assert.match(c.url, /^(https?:\/\/\S+|#)$/, `${c.slug}.url = ${c.url} is not absolute`);
  }
  for (const s of sections) assert.match(s.url || '#', /^(https?:\/\/\S+|#)$/);
});

test('skills list is the 13 finalized from spec section 8', () => {
  assert.equal(skills.length, 13);
  for (const s of skills) assert.ok(hasBoth(s));
});

test('hero brand head matches the document title', () => {
  // spec 7.3：Cubeyu® 必须同时出现在 title 与 hero 大字
  assert.equal(site.hero.lines[0].zh, 'Cubeyu®');
  assert.ok(site.title.startsWith('Cubeyu®'));
  assert.ok(!JSON.stringify(site.hero).includes('代码诗人'), 'no classical branding allowed');
});

test('no classical-Chinese branding anywhere', () => {
  const blob = JSON.stringify({ projects, skills, sections, site });
  for (const banned of ['代码诗人', '以墨为笔', '以码为诗', '水墨', '展 卷', '题跋']) {
    assert.ok(!blob.includes(banned), `found banned classical token: ${banned}`);
  }
});
