#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT, loadProject } from './lib.mjs';

const { data } = await loadProject();
const schema = JSON.parse(await readFile(resolve(ROOT, 'schemas/creator-index.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const errors = [];

if (!validate(data)) {
  for (const issue of validate.errors || []) {
    errors.push(`schema ${issue.instancePath || '/'} ${issue.message}`);
  }
}

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${label} duplicate id: ${item.id}`);
    seen.add(item.id);
  }
  return seen;
}

const creatorIds = uniqueIds(data.creators, 'creator');
const postIds = uniqueIds(data.posts, 'post');
const sourceIds = uniqueIds(data.sources, 'source');
uniqueIds(data.mentions, 'mention');

for (const post of data.posts) {
  if (!creatorIds.has(post.creator_id)) errors.push(`post ${post.id} references missing creator ${post.creator_id}`);
  if (post.original_url && /(?:xsec_token|xsec_source|access_token|api[_-]?key|authToken)=/i.test(post.original_url)) {
    errors.push(`post ${post.id} contains a temporary authentication URL`);
  }
}

for (const [rankingId, ranking] of Object.entries(data.rankings)) {
  for (const postId of ranking.post_ids) {
    if (!postIds.has(postId)) errors.push(`ranking ${rankingId} references missing post ${postId}`);
  }
}

for (const mention of data.mentions) {
  for (const postId of mention.post_ids) {
    if (!postIds.has(postId)) errors.push(`mention ${mention.id} references missing post ${postId}`);
  }
  for (const sourceId of mention.source_ids) {
    if (!sourceIds.has(sourceId)) errors.push(`mention ${mention.id} references missing source ${sourceId}`);
  }
}

for (const source of data.sources) {
  if (source.url && /(?:xsec_token|xsec_source|access_token|api[_-]?key|authToken)=/i.test(source.url)) {
    errors.push(`source ${source.id} contains a temporary authentication URL`);
  }
  if (!source.url && source.verification_status !== '未解决') {
    errors.push(`source ${source.id} has no URL but is not unresolved`);
  }
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.cache', 'generated', 'docs', 'xhs-output'].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

const secretPatterns = [
  /xsec_token=/i,
  /(?:^|[\s"'])cookie\s*:/i,
  /(?:sk|pk)-[A-Za-z0-9_-]{20,}/,
  /api[_-]?key\s*[:=]\s*["'][^"']{8,}/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._-]{12,}/i,
];
for (const path of await walk(ROOT)) {
  if (relative(ROOT, path) === 'scripts/validate.mjs') continue;
  const bytes = await readFile(path);
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) errors.push(`possible secret in ${relative(ROOT, path)} (${pattern})`);
  }
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Validated ${data.creators.length} creator, ${data.posts.length} posts, ` +
  `${data.mentions.length} mentions and ${data.sources.length} sources.`,
);
