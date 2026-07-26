import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function loadYaml(path) {
  return YAML.parse(await readFile(path, 'utf8'));
}

export async function loadProject() {
  const [data, config] = await Promise.all([
    loadYaml(resolve(ROOT, 'data/index.yaml')),
    loadYaml(resolve(ROOT, 'config.yaml')),
  ]);
  return { data, config: config.project };
}

export function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatNumber(value, approximate = false) {
  if (value === undefined || value === null) return '—';
  const number = Number(value);
  let formatted;
  if (number >= 10000) formatted = `${(number / 10000).toFixed(number % 10000 ? 1 : 0)}万`;
  else formatted = new Intl.NumberFormat('zh-CN').format(number);
  return approximate ? `约${formatted}` : formatted;
}

export function sourceGradeForMention(mention, sourceMap) {
  const grades = mention.source_ids
    .map((id) => sourceMap.get(id)?.evidence_grade)
    .filter(Boolean)
    .sort();
  return grades[0] || 'C';
}

export function hydrate(data) {
  const creators = new Map(data.creators.map((item) => [item.id, item]));
  const posts = new Map(data.posts.map((item) => [item.id, item]));
  const sources = new Map(data.sources.map((item) => [item.id, item]));
  const mentions = data.mentions.map((mention) => ({
    ...mention,
    evidence_grade: sourceGradeForMention(mention, sources),
    posts: mention.post_ids.map((id) => posts.get(id)),
    sources: mention.source_ids.map((id) => sources.get(id)),
  }));
  return { creators, posts, sources, mentions };
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
