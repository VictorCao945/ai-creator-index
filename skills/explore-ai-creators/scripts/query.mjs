#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = resolve(SKILL_ROOT, 'references/snapshot.json');
const REMOTE = resolve(SKILL_ROOT, 'references/remote.json');
const CACHE_DIR = resolve(homedir(), '.cache/ai-creator-index');
const CACHE_DATA = resolve(CACHE_DIR, 'index.json');
const CACHE_MANIFEST = resolve(CACHE_DIR, 'manifest.json');

function parseArgs(argv) {
  const args = { format: 'markdown' };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args.query = [args.query, token].filter(Boolean).join(' ');
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (['refresh', 'status', 'help'].includes(key)) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadData({ preferCache = true } = {}) {
  if (preferCache && await fileExists(CACHE_DATA)) {
    return { data: await readJson(CACHE_DATA), mode: 'cache', path: CACHE_DATA };
  }
  return { data: await readJson(SNAPSHOT), mode: 'installation_snapshot', path: SNAPSHOT };
}

export async function refreshData() {
  const remote = await readJson(REMOTE);
  const url = remote.manifest_url || '';
  if (!url || url.includes('personal-owner')) {
    return { ok: false, reason: 'remote_not_configured', message: '远端清单尚未配置；继续使用安装时快照。' };
  }
  try {
    const manifestResponse = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!manifestResponse.ok) throw new Error(`manifest HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const dataResponse = await fetch(manifest.data_url, { signal: AbortSignal.timeout(20000) });
    if (!dataResponse.ok) throw new Error(`data HTTP ${dataResponse.status}`);
    const raw = await dataResponse.text();
    const digest = createHash('sha256').update(raw).digest('hex');
    if (digest !== manifest.sha256) throw new Error('SHA256 mismatch');
    JSON.parse(raw);
    await mkdir(CACHE_DIR, { recursive: true });
    const temp = resolve(CACHE_DIR, `index-${process.pid}.tmp`);
    await writeFile(temp, raw);
    await rename(temp, CACHE_DATA);
    await writeFile(CACHE_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    return { ok: true, manifest, message: `已更新到数据版本 ${manifest.data_version}。` };
  } catch (error) {
    return { ok: false, reason: 'network_or_integrity_error', message: `无法更新：${error.message}；继续使用本地快照。` };
  }
}

function normalize(value = '') {
  return String(value).trim().toLowerCase().replace(/[\s/_-]+/g, '');
}

function sourceMatchesGrade(source, grade) {
  return !grade || source.evidence_grade === grade.toUpperCase();
}

export function queryData(data, args = {}) {
  const creatorNeedle = normalize(args.creator);
  const queryNeedle = normalize(args.query);
  const topicNeedle = normalize(args.topic);
  const typeNeedle = normalize(args.type);
  const creatorIds = new Set(data.creators
    .filter((creator) => !creatorNeedle || normalize(`${creator.id}${creator.display_name}${creator.aliases?.join('')}`).includes(creatorNeedle))
    .map((creator) => creator.id));
  const postMap = new Map(data.posts.map((post) => [post.id, post]));
  const sourceMap = new Map(data.sources.map((source) => [source.id, source]));
  const snapshot = new Date(`${data.meta.snapshot_date}T00:00:00Z`);
  const recentCutoff = new Date(snapshot);
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - (data.meta.methodology.recent_window_days || 90));

  let mentions = data.mentions.map((mention) => {
    const posts = mention.post_ids.map((id) => postMap.get(id)).filter(Boolean);
    const sources = mention.source_ids.map((id) => sourceMap.get(id)).filter(Boolean);
    return { ...mention, posts, sources };
  }).filter((mention) => {
    const creatorPosts = mention.posts.filter((post) => creatorIds.has(post.creator_id));
    if (!creatorPosts.length) return false;
    if (typeNeedle && normalize(mention.type) !== typeNeedle) return false;
    if (topicNeedle && !mention.topics.some((topic) => normalize(topic).includes(topicNeedle))) return false;
    const haystack = normalize([mention.name, mention.summary, mention.type, ...mention.topics, ...creatorPosts.flatMap((post) => [post.title, ...post.topics])].join(' '));
    if (queryNeedle && !haystack.includes(queryNeedle)) return false;
    if (args.period === 'recent' && !creatorPosts.some((post) => new Date(`${post.published_at}T00:00:00Z`) >= recentCutoff)) return false;
    if (args.period === 'historical' && !creatorPosts.some((post) => new Date(`${post.published_at}T00:00:00Z`) < recentCutoff)) return false;
    if (args.grade && !mention.sources.some((source) => sourceMatchesGrade(source, args.grade))) return false;
    return true;
  }).map((mention) => ({
    ...mention,
    sources: mention.sources.filter((source) => sourceMatchesGrade(source, args.grade)),
  }));

  const rankingKey = args.ranking === 'recent' ? 'recent_92_days' : args.ranking === 'historical' ? 'historical' : null;
  const ranking = rankingKey ? {
    ...data.rankings[rankingKey],
    posts: data.rankings[rankingKey].post_ids.map((id) => postMap.get(id)).filter((post) => creatorIds.has(post.creator_id)),
  } : null;

  return {
    creators: data.creators.filter((creator) => creatorIds.has(creator.id)),
    mentions,
    ranking,
    snapshot_date: data.meta.snapshot_date,
  };
}

export function formatMarkdown(result, mode) {
  const lines = [
    `数据快照：${result.snapshot_date}（${mode === 'installation_snapshot' ? '安装时快照' : '本地更新缓存'}）`,
  ];
  if (!result.creators.length) return `${lines[0]}\n\n没有找到这位创作者。`;
  if (result.ranking) {
    lines.push('', `## ${result.ranking.label}`);
    result.ranking.posts.forEach((post, index) => {
      lines.push(`${index + 1}. ${post.title}｜${post.published_at}｜${post.metrics.likes}赞${post.original_url ? `｜${post.original_url}` : '｜原始链接未录入'}`);
    });
  }
  if (!result.mentions.length && !result.ranking) lines.push('', '没有找到符合条件的提及对象。');
  for (const mention of result.mentions) {
    lines.push('', `## ${mention.name}`, `${mention.summary}`);
    for (const post of mention.posts) {
      lines.push(`- 笔记：${post.title}（${post.published_at}）${post.original_url ? ` ${post.original_url}` : ''}`);
    }
    for (const source of mention.sources) {
      lines.push(`- 来源：[${source.evidence_grade}] ${source.title}｜${source.verification_status}｜核验 ${source.verified_at}${source.url ? `｜${source.url}` : '｜无稳定公开链接'}`);
    }
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/query.mjs [--creator 小盖] [--type podcast] [--topic Agent] [--query 安全] [--grade A] [--period recent|historical] [--ranking recent|historical] [--refresh] [--status] [--format json|markdown]');
    return;
  }
  let refresh = null;
  if (args.refresh) refresh = await refreshData();
  const loaded = await loadData();
  if (args.status) {
    let remote = null;
    try { remote = await readJson(REMOTE); } catch {}
    console.log(JSON.stringify({
      mode: loaded.mode,
      snapshot_date: loaded.data.meta.snapshot_date,
      data_version: loaded.data.meta.data_version,
      manifest_url: remote?.manifest_url || null,
      refresh,
    }, null, 2));
    return;
  }
  if (refresh) console.error(refresh.message);
  const result = queryData(loaded.data, args);
  if (args.format === 'json') console.log(JSON.stringify({ mode: loaded.mode, ...result }, null, 2));
  else console.log(formatMarkdown(result, loaded.mode));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
