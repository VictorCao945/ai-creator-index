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
const { data } = await loadProject();
const hydrated = hydrate(data);
const logo = (await readFile(resolve(ROOT, 'assets/brand/aha-logo.png'))).toString('base64');
const creatorAvatar = (await readFile(resolve(ROOT, 'assets/creators/xiaogai/avatar.jpg'))).toString('base64');

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
  const tokens = String(text).match(/[A-Za-z0-9+'/.·—“”「」]+|[\u3400-\u9fff]|[，。；：！？、（）｜]/gu) || [];
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

function header(page, showPageNumber = true) {
  return `<defs><clipPath id="avatar"><circle cx="104" cy="89" r="34"/></clipPath></defs>
  <image href="data:image/png;base64,${logo}" x="70" y="55" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)"/>
  <circle cx="104" cy="89" r="34" fill="none" stroke="${C.faint}" stroke-width="2"/>
  ${text('啊哈先生', 154, 86, { size: 28, weight: 760 })}
  ${text(`博主档案 · 001`, 154, 116, { size: 20, color: C.muted })}
${showPageNumber ? text(String(page).padStart(2, '0'), 1004, 1390, { size: 28, weight: 800, color: C.teal, anchor: 'end' }) : ''}`;
}

function shell(body, page, extra = '', showPageNumber = true) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
${extra}${page ? header(page, showPageNumber) : ''}${body}
</svg>`.replace(/[ \t]+$/gm, '');
}

function sourceNote(textValue, y = 1280) {
  if (!textValue) return '';
  return `<rect x="70" y="${y - 35}" width="940" height="58" rx="8" fill="${C.tealSoft}"/>
  ${text(textValue, 94, y + 4, { size: 23, weight: 650, color: '#176A73' })}`;
}

function footer(textValue, y = 1360) {
  if (!textValue) return '';
  return `<line x1="70" y1="${y - 42}" x2="1010" y2="${y - 42}" stroke="${C.faint}"/>
  ${lines(wrap(textValue, 36), 70, y, { size: 25, lineHeight: 35, color: C.muted })}`;
}

function cover() {
  return shell(`
    <rect x="0" y="0" width="18" height="1440" fill="${C.orange}"/>
    <defs>
      <clipPath id="cover-avatar"><circle cx="112" cy="101" r="42"/></clipPath>
      <clipPath id="creator-avatar"><circle cx="184" cy="745" r="76"/></clipPath>
    </defs>
    <image href="data:image/png;base64,${logo}" x="70" y="59" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover-avatar)"/>
    ${text('啊哈先生', 176, 98, { size: 31, weight: 780 })}
    ${text(content.cover.kicker, 176, 134, { size: 21, color: C.muted })}
    ${text('CREATOR PROFILE', 70, 274, { size: 22, weight: 800, color: C.teal })}
    ${lines(content.cover.lines, 70, 404, { size: 72, lineHeight: 98, weight: 820, family: 'serif' })}
    <rect x="70" y="626" width="940" height="238" rx="12" fill="${C.paper}" opacity=".88"/>
    <image href="data:image/jpeg;base64,${creatorAvatar}" x="108" y="669" width="152" height="152" preserveAspectRatio="xMidYMid slice" clip-path="url(#creator-avatar)"/>
    ${text(content.cover.profile.name, 296, 690, { size: 34, weight: 820, color: C.ink })}
    ${lines(content.cover.profile.lines, 296, 738, { size: 25, lineHeight: 39, weight: 520, color: C.muted })}
    <line x1="70" y1="916" x2="230" y2="916" stroke="${C.orange}" stroke-width="8" stroke-linecap="round"/>
    <rect x="70" y="970" width="940" height="242" rx="8" fill="${C.paper}" opacity=".72"/>
    ${text(content.cover.panel_title, 108, 1028, { size: 29, weight: 800, color: C.orange })}
    ${lines(content.cover.panel_items, 108, 1082, { size: 29, lineHeight: 50 })}
    ${text('AI 创作者档案库 · CREATOR 001', 70, 1368, { size: 23, color: C.muted })}
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
    ${text(card.eyebrow, 70, 236, { size: 42, weight: 800, color: C.orange })}
    ${lines(wrap(card.title, 17), 70, 356, { size: 58, lineHeight: 78, weight: 760, family: 'serif' })}
    <line x1="70" y1="548" x2="212" y2="548" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(wrap(card.body, 25), 70, 630, { size: 38, lineHeight: 58, color: C.ink })}
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
    const y = panelY + row * 112;
    const itemLines = wrap(item, 14);
    return `<rect x="${x}" y="${y}" width="438" height="96" rx="8" fill="${C.paper}"/>
      <circle cx="${x + 28}" cy="${y + 44}" r="7" fill="${i % 2 ? C.orange : C.teal}"/>
      ${lines(itemLines, x + 52, y + (itemLines.length > 1 ? 34 : 52), { size: 25, lineHeight: 32, weight: 700 })}`;
  }).join('');
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 41, weight: 800, color: C.orange })}
    ${lines(titleLines, 70, 342, { size: 56, lineHeight: 76, weight: 760, family: 'serif' })}
    <line x1="70" y1="${bodyY - 52}" x2="210" y2="${bodyY - 52}" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(bodyLines, 70, bodyY, { size: 37, lineHeight: 58 })}
    ${bulletLines}
    ${sourceNote(card.source_note, 1238)}
    ${footer(card.footer, 1340)}
  `, card.page);
}

function promptCard(card) {
  const titleLines = wrap(card.title, 16);
  const bodyY = 330 + titleLines.length * 74 + 56;
  const bodyLines = wrap(card.body, 25);
  const panelY = bodyY + bodyLines.length * 56 + 42;
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 41, weight: 800, color: C.orange })}
    ${lines(titleLines, 70, 330, { size: 56, lineHeight: 74, weight: 800, family: 'serif' })}
    <line x1="70" y1="${bodyY - 54}" x2="210" y2="${bodyY - 54}" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(bodyLines, 70, bodyY, { size: 36, lineHeight: 56 })}
    <rect x="70" y="${panelY}" width="940" height="292" rx="12" fill="${C.paper}"/>
    ${text(card.panel_label, 112, panelY + 58, { size: 25, weight: 800, color: C.teal })}
    ${card.quote.map((item, i) => `<circle cx="120" cy="${panelY + 116 + i * 62}" r="18" fill="${i === 0 ? C.orange : C.teal}"/>
      ${text(i + 1, 120, panelY + 124 + i * 62, { size: 18, weight: 800, color: '#fff', anchor: 'middle' })}
      ${text(item, 164, panelY + 125 + i * 62, { size: 29, weight: 650 })}`).join('')}
    ${sourceNote(card.source_note, 1212)}
    ${footer(card.footer, 1330)}
  `, card.page);
}

function podcastCard(card) {
  const titleLines = wrap(card.title, 16);
  const bodyY = 330 + titleLines.length * 72 + 54;
  const bodyLines = wrap(card.body, 25);
  const ringStart = bodyY + bodyLines.length * 55 + 54;
  const colors = [C.teal, C.orange, '#7868A8'];
  const rings = card.concepts.map((item, index) => ({ ...item, y: ringStart + index * 104, color: colors[index] }))
    .map((item) => `<circle cx="118" cy="${item.y}" r="28" fill="${item.color}"/>
    ${text(item.label, 172, item.y - 2, { size: 24, weight: 820, color: item.color })}
    ${text(item.desc, 172, item.y + 36, { size: 29 })}`).join('');
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 41, weight: 800, color: C.orange })}
    ${lines(titleLines, 70, 330, { size: 54, lineHeight: 72, weight: 760, family: 'serif' })}
    <line x1="70" y1="${bodyY - 54}" x2="210" y2="${bodyY - 54}" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(bodyLines, 70, bodyY, { size: 35, lineHeight: 55 })}
    ${rings}
    ${sourceNote(card.source_note, 1215)}
    ${footer(card.footer, 1330)}
  `, card.page);
}

function finalCard(card) {
  return shell(`
    ${text(card.eyebrow, 70, 236, { size: 42, weight: 800, color: C.orange })}
    ${lines(wrap(card.title, 17), 70, 354, { size: 58, lineHeight: 78, weight: 770, family: 'serif' })}
    <line x1="70" y1="552" x2="210" y2="552" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>
    ${lines(wrap(card.body, 25), 70, 635, { size: 36, lineHeight: 57 })}
    <rect x="70" y="810" width="940" height="260" rx="10" fill="${C.paper}"/>
    ${card.bullets.map((item, i) => `<circle cx="118" cy="${868 + i * 68}" r="7" fill="${i === 2 ? C.orange : C.teal}"/>
      ${text(item, 148, 878 + i * 68, { size: 27, weight: 650 })}`).join('')}
    <rect x="70" y="1102" width="940" height="126" rx="10" fill="${C.tealSoft}"/>
    ${text(card.project_label, 102, 1142, { size: 21, weight: 800, color: C.teal })}
    ${text(card.project_title, 102, 1180, { size: 27, weight: 760 })}
    ${text(card.skill_note, 102, 1214, { size: 21, color: C.muted })}
    ${lines(wrap(card.question, 19), 70, 1308, { size: 40, lineHeight: 50, weight: 800, family: 'serif', color: C.orange })}
  `, card.page, '', false);
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
  const stem = `${String(index + 1).padStart(2, '0')}-${['cover', 'positioning', 'discovery', 'distillation', 'action', 'why-followed', 'start-here', 'summary'][index]}`;
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
  writeFile(resolve(OUT, 'publish/caption.md'), `# 发布正文\n\n${content.caption}\n\n${content.tags.join(' ')}\n`),
  writeFile(resolve(OUT, 'publish/ready-to-publish.md'), `# #001 小盖｜小红书待发布内容

## 发布标题

${content.publish_title}

## 发布正文

${content.caption}

## 标签

${content.tags.join(' ')}

## 图片上传顺序

1. 01-cover.png｜封面
2. 02-positioning.png｜账号定位
3. 03-discovery.png｜第一种能力：会找
4. 04-distillation.png｜第二种能力：会炼
5. 05-action.png｜第三种能力：会落地
6. 06-why-followed.png｜受欢迎的原因
7. 07-start-here.png｜代表内容入口
8. 08-summary.png｜总结与互动

图片目录：\`../png/\`

## 发布操作

- 在小红书发布页依次上传 8 张 PNG
- 粘贴标题、正文和标签
- 挂载「AI 创作者档案库」Skill
- 如需关联小盖本人，请在 App 内选择正确账号后再 @
- 发布前确认正文与图片中没有 GitHub URL、安装命令或核验术语
- 检查 Skill 按钮显示为“下载 Skill”或“安装 Skill”
`),
  writeFile(resolve(OUT, 'publish/sources.md'), sourcesMd),
  writeFile(resolve(OUT, 'publish/red-skill.md'), `# RED Skill 挂载说明

1. 先在小红书完成「AI 创作者档案库」RED Skill 的上传与审核，再在发布页挂载；当前仓库内交付的是挂载说明，不等于平台已经发布成功。
2. 对外按钮使用“下载 Skill”或“安装 Skill”，不展示仓库地址、安装命令和技术同步机制。
3. Skill 内提供完整档案、原帖入口和更新说明；正文只提示读者从本篇笔记进入。
4. 发布前确认正文与8张图片均不包含 GitHub URL。
`),
]);

console.log(`Rendered ${cards.length} SVG + PNG cards and contact sheet to ${OUT}.`);
