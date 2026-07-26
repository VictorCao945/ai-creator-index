#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, esc, formatNumber, hydrate, loadProject, stableJson } from './lib.mjs';

const { data, config } = await loadProject();
const hydrated = hydrate(data);
const generatedAt = `${data.meta.snapshot_date}T00:00:00+08:00`;
const base = config.site_base_path.replace(/\/+$/, '');
const owner = config.owner;
const repository = config.repository;
const repoUrl = `https://github.com/${owner}/${repository}`;
const rawBase = `https://raw.githubusercontent.com/${owner}/${repository}/${config.default_branch}`;

const publicData = {
  ...data,
  mentions: hydrated.mentions.map(({ posts, sources, ...mention }) => ({
    ...mention,
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      published_at: post.published_at,
      original_url: post.original_url,
      likes: post.metrics.likes,
    })),
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      source_type: source.source_type,
      evidence_grade: source.evidence_grade,
      verification_status: source.verification_status,
      verified_at: source.verified_at,
      note: source.note,
    })),
  })),
};

const indexJson = stableJson(publicData);
const favicon = await readFile(resolve(ROOT, 'assets/brand/aha-logo.png'));
const sha256 = createHash('sha256').update(indexJson).digest('hex');
const manifest = {
  schema_version: data.meta.schema_version,
  data_version: data.meta.data_version,
  generated_at: generatedAt,
  snapshot_date: data.meta.snapshot_date,
  data_url: `${rawBase}/generated/index.json`,
  sha256,
};

function link(url, label) {
  return url ? `[${label}](${url})` : `${label}（未解决）`;
}

function creatorMarkdown(creator) {
  const focusPosts = data.posts.filter((post) => post.creator_id === creator.id && post.focus);
  const creatorMentions = hydrated.mentions.filter((mention) =>
    mention.posts.some((post) => post.creator_id === creator.id),
  );
  const rankingSections = Object.values(data.rankings).map((ranking) => {
    const rows = ranking.post_ids.map((id, index) => {
      const post = hydrated.posts.get(id);
      const title = post.original_url ? `[${post.title}](${post.original_url})` : post.title;
      return `| ${index + 1} | ${post.published_at} | ${formatNumber(post.metrics.likes, post.metrics.approximate)} | ${title} |`;
    });
    return `## ${ranking.label}\n\n| # | 日期 | 赞 | 内容 |\n|---:|---|---:|---|\n${rows.join('\n')}`;
  }).join('\n\n');

  const postRows = focusPosts.map((post) =>
    `| ${post.published_at} | ${link(post.original_url, post.title)} | ${formatNumber(post.metrics.likes)} | ${post.topics.join(' / ')} | ${post.selection_reason} |`,
  ).join('\n');
  const mentionRows = creatorMentions.map((mention) => {
    const sources = mention.sources.map((source) =>
      source.url ? `[${source.evidence_grade} · ${source.title}](${source.url})` : `${source.evidence_grade} · ${source.title}（未解决）`,
    ).join('<br>');
    return `| ${mention.name} | ${mention.type} | ${mention.summary} | ${sources} |`;
  }).join('\n');

  return `# ${creator.display_name}：内容情报与溯源档案

> 数据快照：${data.meta.snapshot_date} · 证据等级只表示来源链完整度，不表示观点一定正确。

${creator.profile_summary}

- 公开笔记：**${creator.stats_snapshot.public_post_count} 篇**
- 近 ${creator.stats_snapshot.recent_window_days} 天：**${creator.stats_snapshot.recent_post_count} 篇**
- 遍历区间：${creator.stats_snapshot.earliest_public_post} — ${creator.stats_snapshot.latest_public_post}
- 主页：${link(creator.platform_accounts[0].profile_url, creator.platform_accounts[0].platform)}

## 一页判断

${creator.editorial_takeaways.map((item) => `- ${item}`).join('\n')}

${rankingSections}

## 10 篇重点内容

| 日期 | 笔记 | 赞 | 主题 | 为什么入选 |
|---|---|---:|---|---|
${postRows}

## 提及对象与原始链接

| 对象 | 类型 | 内容 | 来源与证据 |
|---|---|---|---|
${mentionRows}

## 证据规则

${Object.entries(data.meta.evidence_rules).map(([grade, rule]) => `- **${grade}**：${rule}`).join('\n')}

## 纠错

欢迎通过仓库 Issue 提交信息纠错、失效链接或博主本人补充。本人提交与编辑核验会分开标注，不自动视为“本人认证”。
`;
}

function layout({ title, description, body, page = 'home', script = true }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${esc(description)}">
  <title>${esc(title)}</title>
  <link rel="icon" type="image/png" href="${page === 'creator' ? '../../favicon.png' : './favicon.png'}">
  <link rel="stylesheet" href="${page === 'creator' ? '../../assets/style.css' : './assets/style.css'}">
</head>
<body data-page="${page}">
  <header class="site-header">
    <a class="brand" href="${page === 'creator' ? '../../' : './'}">AI 创作者档案库</a>
    <nav><a href="${repoUrl}">GitHub</a><a href="${repoUrl}/issues/new/choose">纠错 / 推荐</a></nav>
  </header>
  ${body}
  <footer>结构化整理 CC BY 4.0 · 外部内容版权归原作者 · 快照 ${data.meta.snapshot_date}</footer>
  ${script ? `<script src="${page === 'creator' ? '../../assets/app.js' : './assets/app.js'}" defer></script>` : ''}
</body>
</html>`;
}

function homepage() {
  const topics = [...new Set(data.creators.flatMap((creator) => creator.topics))].sort();
  return layout({
    title: 'AI 创作者档案库',
    description: '从创作者的公开内容出发，找到他们提过的产品、播客、文章、项目与原始来源。',
    body: `<main>
      <section class="hero">
        <p class="eyebrow">AI CREATOR INDEX · V0.1</p>
        <h1>不只看观点，<br><span>继续找到原始出处。</span></h1>
        <p class="lead">从创作者的公开内容出发，整理代表内容、提及对象、原始链接和证据等级。第一位：小盖。</p>
        <div class="snapshot"><span>1 位创作者</span><span>${data.posts.length} 条索引内容</span><span>${data.mentions.length} 个提及对象</span><span>${data.sources.length} 条来源</span></div>
      </section>
      <section class="finder" aria-labelledby="finder-title">
        <div class="section-head"><div><p class="eyebrow">EXPLORE</p><h2 id="finder-title">查一个人，也查一条线索</h2></div><p>可按名字、主题、产品、播客或项目搜索。</p></div>
        <label class="search"><span>⌕</span><input id="search-input" type="search" placeholder="试试：小盖、Codex、播客、Agent 安全" aria-label="搜索创作者和提及对象"></label>
        <div class="filters" id="topic-filters">
          <button class="active" data-topic="">全部</button>
          ${topics.map((topic) => `<button data-topic="${esc(topic)}">${esc(topic)}</button>`).join('')}
        </div>
        <div id="creator-list" class="creator-grid"></div>
      </section>
      <section class="rules">
        <div><p class="eyebrow">EVIDENCE</p><h2>把“听说”与“找到原文”分开</h2></div>
        <div class="grade-grid">${Object.entries(data.meta.evidence_rules).map(([grade, rule]) =>
          `<article><span class="grade grade-${grade.toLowerCase()}">${grade}</span><p>${esc(rule)}</p></article>`,
        ).join('')}</div>
      </section>
      <section class="community">
        <p class="eyebrow">OPEN TO CORRECTIONS</p>
        <h2>资料库不是终审判决，而是一份可被纠正的公共底稿。</h2>
        <div class="actions"><a class="button primary" href="${repoUrl}/issues/new?template=creator-correction.yml">博主本人补充 / 纠正</a><a class="button" href="${repoUrl}/issues/new?template=creator-nomination.yml">推荐下一位</a></div>
      </section>
    </main>`,
  });
}

function creatorPage(creator) {
  const focus = data.posts.filter((post) => post.creator_id === creator.id && post.focus);
  const mentions = hydrated.mentions.filter((mention) => mention.posts.some((post) => post.creator_id === creator.id));
  const sourceRows = mentions.flatMap((mention) => mention.sources.map((source) => ({ mention, source })));
  return layout({
    title: `${creator.display_name}｜AI 创作者档案库`,
    description: creator.profile_summary,
    page: 'creator',
    body: `<main>
      <a class="back" href="../../">← 返回档案库</a>
      <section class="profile-hero">
        <div><p class="eyebrow">CREATOR 001 · XIAOHONGSHU</p><h1>${esc(creator.display_name)}</h1><p class="lead">${esc(creator.profile_summary)}</p>
          <div class="topic-row">${creator.topics.map((topic) => `<span>${esc(topic)}</span>`).join('')}</div>
        </div>
        <aside><div><strong>${creator.stats_snapshot.public_post_count}</strong><span>公开笔记</span></div><div><strong>${creator.stats_snapshot.recent_post_count}</strong><span>近${creator.stats_snapshot.recent_window_days}天</span></div><div><strong>${data.meta.snapshot_date}</strong><span>数据快照</span></div></aside>
      </section>
      <section><div class="section-head"><div><p class="eyebrow">EDITORIAL MAP</p><h2>为什么值得关注</h2></div></div>
        <div class="takeaways">${creator.editorial_takeaways.map((item, i) => `<article><span>0${i + 1}</span><p>${esc(item)}</p></article>`).join('')}</div>
      </section>
      <section><div class="section-head"><div><p class="eyebrow">SELECTED POSTS</p><h2>10 篇重点内容</h2></div><p>热度为 ${data.meta.snapshot_date} 快照。</p></div>
        <div class="post-list">${focus.map((post) => `<article>
          <div class="post-date">${post.published_at}</div><div><div class="topic-row">${post.topics.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
          <h3>${post.original_url ? `<a href="${post.original_url}">${esc(post.title)} ↗</a>` : esc(post.title)}</h3><p>${esc(post.selection_reason)}</p></div>
          <div class="metric"><strong>${formatNumber(post.metrics.likes)}</strong><span>赞</span></div>
        </article>`).join('')}</div>
      </section>
      <section id="mentions"><div class="section-head"><div><p class="eyebrow">MENTIONS & SOURCES</p><h2>提及对象与原始链接</h2></div><p>筛选的是来源证据，不是观点对错。</p></div>
        <div class="toolbar"><label class="search compact"><span>⌕</span><input id="mention-search" type="search" placeholder="搜索产品、播客、项目或主题" aria-label="搜索提及对象"></label>
        <div class="filters" id="grade-filters"><button class="active" data-grade="">全部证据</button><button data-grade="A">只看 A</button><button data-grade="B">B</button><button data-grade="C">C</button></div></div>
        <div id="mention-list" class="mention-list">${mentions.map((mention) => `<article data-grade="${mention.evidence_grade}" data-search="${esc([mention.name, mention.type, mention.summary, ...mention.topics].join(' ').toLowerCase())}">
          <div><span class="grade grade-${mention.evidence_grade.toLowerCase()}">${mention.evidence_grade}</span><span class="type">${esc(mention.type)}</span></div>
          <h3>${esc(mention.name)}</h3><p>${esc(mention.summary)}</p>
          <div class="source-links">${mention.sources.map((source) => source.url
            ? `<a href="${source.url}">${source.evidence_grade} · ${esc(source.title)} ↗</a>`
            : `<span>${source.evidence_grade} · ${esc(source.title)}（未解决）</span>`).join('')}</div>
        </article>`).join('')}</div>
      </section>
      <section><div class="section-head"><div><p class="eyebrow">SOURCE LEDGER</p><h2>来源核验账本</h2></div></div>
        <div class="table-wrap"><table><thead><tr><th>提及对象</th><th>来源</th><th>等级</th><th>状态</th><th>最后核验</th></tr></thead><tbody>
        ${sourceRows.map(({ mention, source }) => `<tr><td>${esc(mention.name)}</td><td>${source.url ? `<a href="${source.url}">${esc(source.title)}</a>` : esc(source.title)}</td><td><span class="grade grade-${source.evidence_grade.toLowerCase()}">${source.evidence_grade}</span></td><td>${source.verification_status}</td><td>${source.verified_at}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="community"><p class="eyebrow">CORRECTIONS WELCOME</p><h2>你是小盖本人，或发现了更准确的原始来源？</h2><p>本人提交与编辑核验分开记录，不自动设置未经验证的“本人认证”。</p><div class="actions"><a class="button primary" href="${repoUrl}/issues/new?template=creator-correction.yml">补充 / 纠正</a><a class="button" href="${repoUrl}/issues/new?template=broken-link.yml">报告失效链接</a></div></section>
    </main>`,
  });
}

const css = `:root{--bg:#f8f7f0;--paper:#fff;--ink:#121311;--muted:#64645e;--line:#dcd8cc;--teal:#0b8795;--orange:#f2a014;--soft:#eeeae0}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.65}.site-header{height:72px;max-width:1180px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font-weight:800;color:var(--ink);text-decoration:none}.site-header nav{display:flex;gap:20px}.site-header nav a,.back{color:var(--muted);text-decoration:none;font-size:14px}main{max-width:1180px;margin:auto;padding:0 24px}section{padding:84px 0;border-bottom:1px solid var(--line)}.hero{padding-top:110px}.eyebrow{margin:0 0 18px;color:var(--teal);font-size:12px;font-weight:800;letter-spacing:.16em}.hero h1,.profile-hero h1{font-family:"Songti SC","STSong",serif;font-size:clamp(54px,8vw,100px);line-height:1.03;letter-spacing:-.04em;margin:0}.hero h1 span{color:var(--orange)}.lead{max-width:760px;font-size:20px;color:var(--muted)}.snapshot{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px}.snapshot span,.topic-row span{border:1px solid var(--line);background:rgba(255,255,255,.45);padding:7px 12px;border-radius:99px;font-size:13px}.section-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:30px}.section-head h2,.community h2{font-family:"Songti SC","STSong",serif;font-size:clamp(34px,5vw,54px);line-height:1.18;margin:0}.section-head>p,.community>p{color:var(--muted);max-width:420px}.search{height:66px;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 20px}.search span{font-size:28px;color:var(--teal)}.search input{border:0;background:transparent;outline:0;width:100%;font-size:18px;color:var(--ink)}.search.compact{height:52px;flex:1;min-width:260px}.search.compact input{font-size:15px}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 28px}.filters button{border:1px solid var(--line);background:transparent;padding:8px 13px;border-radius:99px;color:var(--muted);cursor:pointer}.filters button.active{background:var(--ink);border-color:var(--ink);color:#fff}.creator-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.creator-card{padding:28px;background:var(--paper);border:1px solid var(--line);text-decoration:none;color:var(--ink);transition:.2s}.creator-card:hover{transform:translateY(-3px);border-color:var(--teal)}.creator-card h3{font-size:28px;margin:8px 0}.creator-card p{color:var(--muted)}.creator-meta{display:flex;justify-content:space-between;color:var(--muted);font-size:13px}.rules{display:grid;grid-template-columns:.8fr 1.2fr;gap:60px}.rules h2{font-family:"Songti SC","STSong",serif;font-size:42px;line-height:1.2}.grade-grid{display:grid;gap:12px}.grade-grid article{display:grid;grid-template-columns:44px 1fr;align-items:start;background:rgba(255,255,255,.5);padding:20px}.grade-grid p{margin:0;color:var(--muted)}.grade{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;font-weight:800;font-size:13px}.grade-a{background:#d9f0e8;color:#17654e}.grade-b{background:#fff0cd;color:#8b5c00}.grade-c{background:#f1dfda;color:#934936}.community{background:var(--ink);color:#fff;padding:54px;margin:84px 0;border:0}.community .eyebrow{color:#52c6cf}.community>p{color:#c7c6c0}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.button{display:inline-block;padding:12px 18px;border:1px solid #777;color:#fff;text-decoration:none}.button.primary{background:var(--orange);border-color:var(--orange);color:var(--ink);font-weight:700}footer{max-width:1180px;margin:auto;padding:30px 24px 50px;color:var(--muted);font-size:13px}.back{display:inline-block;margin-top:34px}.profile-hero{display:grid;grid-template-columns:1.5fr .75fr;gap:70px;align-items:end;padding-top:70px}.profile-hero aside{background:var(--ink);color:#fff;padding:28px}.profile-hero aside div{padding:18px 0;border-bottom:1px solid #3a3a37;display:flex;justify-content:space-between;align-items:end}.profile-hero aside div:last-child{border:0}.profile-hero aside strong{font-size:30px}.profile-hero aside span{color:#aaa;font-size:13px}.topic-row{display:flex;gap:7px;flex-wrap:wrap}.takeaways{display:grid;grid-template-columns:1fr 1fr;gap:18px}.takeaways article{background:var(--paper);padding:28px;border:1px solid var(--line)}.takeaways span{color:var(--orange);font-weight:800}.takeaways p{font-size:20px}.post-list{border-top:1px solid var(--ink)}.post-list article{display:grid;grid-template-columns:120px 1fr 80px;gap:25px;padding:28px 0;border-bottom:1px solid var(--line)}.post-list h3{font-size:22px;margin:12px 0 5px}.post-list h3 a{color:var(--ink);text-decoration:none}.post-list p,.post-date,.metric span{color:var(--muted)}.metric{text-align:right}.metric strong{font-size:24px;display:block}.toolbar{display:flex;align-items:center;gap:20px}.mention-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mention-list article{background:var(--paper);border:1px solid var(--line);padding:25px}.mention-list article[hidden]{display:none}.mention-list h3{font-size:21px;margin:15px 0 6px}.mention-list p{color:var(--muted)}.type{margin-left:8px;color:var(--muted);font-size:12px;text-transform:uppercase}.source-links{display:flex;flex-direction:column;gap:7px;margin-top:18px}.source-links a,.source-links span{font-size:13px;color:var(--teal);text-decoration:none}.source-links span{color:var(--muted)}.table-wrap{overflow-x:auto;background:var(--paper)}table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:15px;border-bottom:1px solid var(--line);font-size:14px}th{color:var(--muted);font-weight:600}td a{color:var(--teal)}@media(max-width:760px){.site-header nav a:first-child{display:none}section{padding:58px 0}.hero{padding-top:72px}.lead{font-size:17px}.section-head{display:block}.creator-grid,.rules,.profile-hero,.takeaways,.mention-list{grid-template-columns:1fr}.rules{gap:20px}.profile-hero{gap:35px}.post-list article{grid-template-columns:1fr}.post-date{order:-1}.metric{text-align:left}.metric strong,.metric span{display:inline;margin-right:5px}.toolbar{display:block}.community{margin:58px -24px 0;padding:42px 24px}.creator-grid{gap:12px}}`;

const appJs = `const base=document.body.dataset.page==='creator'?'../../':'./';async function load(){const data=await fetch(base+'data/index.json').then(r=>r.json());if(document.body.dataset.page==='home')home(data);else creator()}function home(data){const list=document.querySelector('#creator-list');const input=document.querySelector('#search-input');let topic='';const draw=()=>{const q=input.value.trim().toLowerCase();const sourceMap=new Map(data.sources.map(s=>[s.id,s]));const postMap=new Map(data.posts.map(p=>[p.id,p]));const cards=data.creators.filter(c=>{const mentions=data.mentions.filter(m=>m.posts.some(p=>p&&p.id&&postMap.get(p.id)?.creator_id===c.id));const hay=[c.display_name,c.bio,c.profile_summary,...c.topics,...mentions.flatMap(m=>[m.name,m.summary,...m.topics])].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!topic||c.topics.includes(topic)||mentions.some(m=>m.topics.includes(topic)))});list.innerHTML=cards.map(c=>'<a class="creator-card" href="./creators/'+c.id+'/"><div class="creator-meta"><span>CREATOR 001</span><span>'+c.platform_accounts[0].platform+'</span></div><h3>'+c.display_name+'</h3><p>'+c.profile_summary+'</p><div class="creator-meta"><span>'+c.stats_snapshot.public_post_count+' 篇公开内容</span><span>查看档案 →</span></div></a>').join('')||'<p>没有匹配结果。试试更短的关键词。</p>'};input.addEventListener('input',draw);document.querySelectorAll('#topic-filters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#topic-filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');topic=b.dataset.topic;draw()}));draw()}function creator(){const input=document.querySelector('#mention-search');if(!input)return;let grade='';const draw=()=>{const q=input.value.trim().toLowerCase();document.querySelectorAll('#mention-list article').forEach(card=>{card.hidden=!!((grade&&card.dataset.grade!==grade)||(q&&!card.dataset.search.includes(q)))})};input.addEventListener('input',draw);document.querySelectorAll('#grade-filters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#grade-filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');grade=b.dataset.grade;draw()}))}load().catch(e=>console.error(e));`;

await rm(resolve(ROOT, 'generated'), { recursive: true, force: true });
await rm(resolve(ROOT, 'docs'), { recursive: true, force: true });
for (const dir of [
  'generated/creators', 'docs/assets', 'docs/data', 'docs/creators/xiaogai',
  'skills/explore-ai-creators/references',
]) await mkdir(resolve(ROOT, dir), { recursive: true });

await Promise.all([
  writeFile(resolve(ROOT, 'generated/index.json'), indexJson),
  writeFile(resolve(ROOT, 'generated/manifest.json'), stableJson(manifest)),
  writeFile(resolve(ROOT, 'generated/creators/xiaogai.md'), creatorMarkdown(data.creators[0])),
  writeFile(resolve(ROOT, 'docs/index.html'), homepage()),
  writeFile(resolve(ROOT, 'docs/creators/xiaogai/index.html'), creatorPage(data.creators[0])),
  writeFile(resolve(ROOT, 'docs/assets/style.css'), css),
  writeFile(resolve(ROOT, 'docs/assets/app.js'), appJs),
  writeFile(resolve(ROOT, 'docs/data/index.json'), indexJson),
  writeFile(resolve(ROOT, 'docs/data/manifest.json'), stableJson(manifest)),
  writeFile(resolve(ROOT, 'docs/.nojekyll'), ''),
  writeFile(resolve(ROOT, 'docs/favicon.png'), favicon),
  writeFile(resolve(ROOT, 'skills/explore-ai-creators/references/snapshot.json'), indexJson),
  writeFile(resolve(ROOT, 'skills/explore-ai-creators/references/remote.json'), stableJson({
    manifest_url: `${rawBase}/generated/manifest.json`,
  })),
]);

console.log(`Built data package ${sha256.slice(0, 12)} and static site for ${data.creators.length} creator.`);
