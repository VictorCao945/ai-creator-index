#!/usr/bin/env node

import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { ROOT, esc, hydrate, loadProject } from './lib.mjs';

const WIDTH = 1080;
const HEIGHT = 1440;
const OUT = resolve(ROOT, 'xhs-output/001-xiaogai');
const content = YAML.parse(await readFile(resolve(ROOT, 'content/xhs-001-xiaogai.yaml'), 'utf8'));
const { data, config } = await loadProject();
const hydrated = hydrate(data);
const logo = (await readFile(resolve(ROOT, 'assets/brand/aha-logo.png'))).toString('base64');
const repoUrl = `https://github.com/${config.owner}/${config.repository}`;

const C = {
  bg: '#F8F7F0',
  ink: '#111211',
  muted: '#66645D',
  faint: '#DDD8CC',
  teal: '#0B8795',
  tealSoft: '#DDEFF0',
  orange: '#F2A014',
  orangeSoft: '#F7E8C7',
  paper: '#FFFFFF',
};

function xml(value = '') {
  return esc(value);
}

function wrap(text, maxUnits) {
  const tokens = String(text).match(/[A-Za-z0-9+/.·—“”「」]+|[\u3400-\u9fff]|[，。；：！？、（）]/gu) || [];
  const lines = [];
  let line = '';
  let units = 0;
  for (const token of tokens) {
    const tokenUnits = [...token].reduce((sum, char) => sum + (/[\x00-\x7F]/.test(char) ? 0.55 : 1), 0);
    const punctuation = /^[，。；：！？、）”」]$/.test(token);
    if (line && units + tokenUnits > maxUnits && !punctuation) {
      lines.push(line);
      line = token;
      units = tokenUnits;
    } else {
      line += token;
      units += tokenUnits;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function lines(textLines, x, y, { size = 40, lineHeight = 60, weight = 500, color = C.ink, family = 'sans', anchor = 'start' } = {}) {
  const font = family === 'serif' ? 'Songti SC,STSong,serif' : 'PingFang SC,Hiragino Sans GB,Arial,sans-serif';
  return textLines.map((line, i) =>
    `<text x="${x}" y="${y + i * lineHeight}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}">${xml(line)}</text>`,
  ).join('');
}

function text(value, x, y, options = {}) {
  return lines([value], x, y, options);
}

function header(page) {
  return `<defs><clipPath id="avatar"><circle cx="104" cy="89" r="34"/></clipPath></defs>
  <image href="data:image/png;base64,${logo}" x="70" y="55" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)"/>
  <circle cx="104" cy="89" r="34" fill="none" stroke="${C.faint}" stroke-width="2"/>
  ${text('啊哈先生', 154, 86, { size: 28, weight: 760 })}
  ${text(`博主档案 · 001`, 154, 116, { size: 20, color: C.muted })}
  ${text(String(page).padStart(2, '0'), 1004, 1390, { size: 28, weight: 800, color: C.teal, anchor: 'end' })}`;
}

function shell(body, page, extra = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
${extra}${page ? header(page) : ''}${body}
</svg>`;
}

function evidence(textValue, y = 1280) {
  return `<rect x="70" y="${y - 35}" width="940" height="58" rx="8" fill="${C.orangeSoft}"/>
  ${text(textValue, 94, y + 4, { size: 23, weight: 650, color: '#805A12' })}`;
}

function footer(textValue, y = 1360) {
  return `<line x1="70" y1="${y - 42}" x2="1010" y2="${y - 42}" stroke="${C.faint}"/>
  ${lines(wrap(textValue, 38), 70, y, { size: 22, lineHeight: 31, color: C.muted })}`;
}

function cover() {
  return shell(`
    <rect x="0" y="0" width="18" height="1440" fill="${C.orange}"/>
    <defs><clipPath id="cover-avatar"><circle cx="112" cy="101" r="42"/></clipPath></defs>
    <image href="data:image/png;base64,${logo}" x="70" y="59" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover-avatar)"/>
    ${text('啊哈先生', 176, 98, { size: 31, weight: 780 })}
    ${text(content.cover.kicker, 176, 134, { size: 21, color: C.muted })}
    ${text('CONTENT INTELLIGENCE', 70, 274, { size: 20, weight: 800, color: C.teal })}
    ${lines(content.cover.lines, 70, 430, { size: 78, lineHeight: 106, weight: 820, family: 'serif' })}
    <line x1="70" y1="770" x2="230" y2="770" stroke="${C.orange}" stroke-width="8" stroke-linecap="round"/>
    <rect x="70" y="858" width="940" height="318" rx="8" fill="${C.paper}" opacity=".72"/>
    ${text('5 条继续深挖的线索', 108, 928, { size: 29, weight: 800, color: C.orange })}
    ${lines(['垂直数字员工  ·  先采访后执行', 'Codex 知识工作  ·  Agency 与 Taste', 'Agent 权限、额度与审计'], 108, 1002, { size: 34, lineHeight: 64, family: 'serif' })}
    ${text('数据快照 2026-07-26', 70, 1368, { size: 23, color: C.muted })}
    ${text('01', 1008, 1368, { size: 28, weight: 800, color: C.teal, anchor: 'end' })}
  `, 0);
}

function statCard(card) {
  const stats = card.stats.map((item, i) => {
    const x = 70 + i * 318;
    return `<rect x="${x}" y="790" width="286" height="214" rx="10" fill="${C.paper}"/>
      ${text(item.value, x + 28, 874, { size: 58, weight: 850, color: i === 1 ? C.orange : C.teal })}
      ${text(item.label, x + 28, 930, { size: 25, color: C.muted })}`;
  }).join('');
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 27, weight: 800, color: C.orange })}
    ${lines(wrap(card.title, 16), 70, 356, { size: 62, lineHeight: 83, weight: 760, family: 'serif' })}
    <line x1="70" y1="548" x2="212" y2="548" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(wrap(card.body, 25), 70, 630, { size: 38, lineHeight: 58, family: 'serif', color: C.ink })}
    ${stats}
    <path d="M110 1100 C260 1030,360 1170,510 1100 S760 1025,940 1090" fill="none" stroke="${C.teal}" stroke-width="4"/>
    ${text('发现', 92, 1170, { size: 26, weight: 750, color: C.teal })}
    ${text('→', 252, 1170, { size: 26, color: C.muted })}
    ${text('转述', 360, 1170, { size: 26, weight: 750, color: C.teal })}
    ${text('→', 550, 1170, { size: 26, color: C.muted })}
    ${text('提炼', 690, 1170, { size: 26, weight: 750, color: C.teal })}
    ${footer(card.footer, 1328)}
  `, card.page);
}

function bulletCard(card) {
  const titleLines = wrap(card.title, 16);
  const bodyY = 350 + titleLines.length * 78 + 50;
  const bodyLines = wrap(card.body, 25);
  const panelY = bodyY + bodyLines.length * 58 + 44;
  const bulletLines = card.bullets.map((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 70 + col * 470;
    const y = panelY + 55 + row * 108;
    return `<rect x="${x}" y="${y - 44}" width="438" height="82" rx="8" fill="${C.paper}"/>
      <circle cx="${x + 28}" cy="${y - 3}" r="7" fill="${i % 2 ? C.orange : C.teal}"/>
      ${text(item, x + 52, y + 7, { size: 27, weight: 700 })}`;
  }).join('');
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 27, weight: 800, color: C.orange })}
    ${lines(titleLines, 70, 342, { size: 56, lineHeight: 76, weight: 760, family: 'serif' })}
    <line x1="70" y1="${bodyY - 52}" x2="210" y2="${bodyY - 52}" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(bodyLines, 70, bodyY, { size: 37, lineHeight: 58, family: 'serif' })}
    ${bulletLines}
    ${evidence(card.evidence, 1238)}
    ${footer(card.footer, 1340)}
  `, card.page);
}

function promptCard(card) {
  const titleLines = wrap(card.title, 16);
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 27, weight: 800, color: C.orange })}
    ${lines(titleLines, 70, 360, { size: 68, lineHeight: 88, weight: 800, family: 'serif' })}
    <line x1="70" y1="474" x2="210" y2="474" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(wrap(card.body, 25), 70, 558, { size: 37, lineHeight: 58, family: 'serif' })}
    <rect x="70" y="790" width="940" height="340" rx="12" fill="${C.paper}"/>
    ${text('访谈协议', 112, 852, { size: 25, weight: 800, color: C.teal })}
    ${card.quote.map((item, i) => `<circle cx="120" cy="${922 + i * 76}" r="20" fill="${i === 0 ? C.orange : C.teal}"/>
      ${text(i + 1, 120, 931 + i * 76, { size: 20, weight: 800, color: '#fff', anchor: 'middle' })}
      ${text(item, 164, 932 + i * 76, { size: 31, weight: 650 })}`).join('')}
    ${evidence(card.evidence, 1212)}
    ${footer(card.footer, 1330)}
  `, card.page);
}

function podcastCard(card) {
  const rings = [
    { y: 810, label: 'AGENCY', desc: '主动发起，并承担结果', color: C.teal },
    { y: 930, label: 'TASTE', desc: '知道什么叫“好”', color: C.orange },
    { y: 1050, label: 'LEARNING', desc: '能解释 AI 做了什么', color: '#7868A8' },
  ].map((item) => `<circle cx="118" cy="${item.y}" r="28" fill="${item.color}"/>
    ${text(item.label, 172, item.y - 2, { size: 24, weight: 820, color: item.color })}
    ${text(item.desc, 172, item.y + 36, { size: 29, family: 'serif' })}`).join('');
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 27, weight: 800, color: C.orange })}
    ${lines(wrap(card.title, 16), 70, 342, { size: 55, lineHeight: 76, weight: 760, family: 'serif' })}
    <line x1="70" y1="520" x2="210" y2="520" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(wrap(card.body, 25), 70, 605, { size: 36, lineHeight: 57, family: 'serif' })}
    ${rings}
    ${evidence(card.evidence, 1215)}
    ${footer(card.footer, 1330)}
  `, card.page);
}

function finalCard(card) {
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 27, weight: 800, color: C.orange })}
    ${lines(wrap(card.title, 16), 70, 354, { size: 59, lineHeight: 80, weight: 770, family: 'serif' })}
    <line x1="70" y1="552" x2="210" y2="552" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(wrap(card.body, 25), 70, 635, { size: 36, lineHeight: 57, family: 'serif' })}
    <rect x="70" y="844" width="940" height="290" rx="10" fill="${C.paper}"/>
    ${card.bullets.map((item, i) => `<circle cx="118" cy="${912 + i * 78}" r="7" fill="${i === 2 ? C.orange : C.teal}"/>
      ${text(item, 148, 922 + i * 78, { size: 28, weight: 650 })}`).join('')}
    ${text(card.question, 70, 1272, { size: 52, weight: 800, family: 'serif', color: C.orange })}
    ${text('完整链接与证据等级见 GitHub / Skill', 70, 1350, { size: 23, color: C.muted })}
  `, card.page);
}

const cards = [
  cover(),
  statCard(content.cards[0]),
  bulletCard(content.cards[1]),
  promptCard(content.cards[2]),
  bulletCard(content.cards[3]),
  podcastCard(content.cards[4]),
  bulletCard(content.cards[5]),
  finalCard(content.cards[6]),
];

await rm(OUT, { recursive: true, force: true });
for (const dir of ['svg', 'png', 'publish']) await mkdir(resolve(OUT, dir), { recursive: true });

const pngBuffers = [];
for (let index = 0; index < cards.length; index++) {
  const stem = `${String(index + 1).padStart(2, '0')}-${['cover', 'account-map', 'openclaw', 'interview-first', 'codex', 'podcasts', 'agent-security', 'summary'][index]}`;
  const svgPath = resolve(OUT, 'svg', `${stem}.svg`);
  const pngPath = resolve(OUT, 'png', `${stem}.png`);
  await writeFile(svgPath, cards[index]);
  const png = await sharp(Buffer.from(cards[index])).png().toBuffer();
  await writeFile(pngPath, png);
  pngBuffers.push(png);
}

const thumbs = await Promise.all(pngBuffers.map((png) => sharp(png).resize(270, 360).png().toBuffer()));
await sharp({
  create: { width: 1080, height: 720, channels: 4, background: C.bg },
}).composite(thumbs.map((input, i) => ({
  input,
  left: (i % 4) * 270,
  top: Math.floor(i / 4) * 360,
}))).png().toFile(resolve(OUT, 'contact-sheet.png'));

const creator = data.creators.find((item) => item.id === content.creator_id);
const focusPosts = data.posts.filter((post) => post.creator_id === creator.id && post.focus);
const mentionIds = new Set(focusPosts.map((post) => post.id));
const sources = hydrated.mentions
  .filter((mention) => mention.posts.some((post) => mentionIds.has(post.id)))
  .flatMap((mention) => mention.sources.map((source) => ({ mention: mention.name, ...source })));
const uniqueSources = [...new Map(sources.map((source) => [source.id, source])).values()];

const sourcesMd = `# #001 小盖｜来源清单

数据快照：${content.snapshot_date}

| 等级 | 提及对象 | 来源 | 状态 | 最后核验 |
|---|---|---|---|---|
${uniqueSources.map((source) => `| ${source.evidence_grade} | ${source.mention} | ${source.url ? `[${source.title}](${source.url})` : `${source.title}（未解决）`} | ${source.verification_status} | ${source.verified_at} |`).join('\n')}

证据规则：A=原节目/官方页/原仓库/主张直接来自原笔记；B=事件可核实但观点或原因来自转述；C=尚未找到公开稳定原始出处。
`;

await Promise.all([
  writeFile(resolve(OUT, 'publish/title.md'), `# 发布标题\n\n## 最终选择\n\n${content.publish_title}\n\n## 备选标题\n\n${content.title_candidates.map((title) => `- ${title}`).join('\n')}\n`),
  writeFile(resolve(OUT, 'publish/caption.md'), `# 发布正文\n\n${content.caption}\n\nGitHub 档案：${repoUrl}\n\n${content.tags.join(' ')}\n`),
  writeFile(resolve(OUT, 'publish/sources.md'), sourcesMd),
  writeFile(resolve(OUT, 'publish/red-skill.md'), `# RED Skill 挂载说明

1. 在小红书发布页选择可挂载的 RED Skill 组件。
2. 展示并允许复制以下安装口令：

\`\`\`bash
npx skills add ${repoUrl} --skill explore-ai-creators
\`\`\`

3. 首版只分发安装口令。Skill 使用时检查 GitHub 清单，不宣称小红书会实时同步 GitHub。
4. 发布前确认仓库已经公开，安装命令可以访问，正文中的 GitHub 链接已替换为真实个人账号地址。

公开能力说明：https://www.ithome.com/0/962/201.htm
`),
]);

console.log(`Rendered ${cards.length} SVG + PNG cards and contact sheet to ${OUT}.`);
