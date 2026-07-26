#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, loadProject, stableJson } from './lib.mjs';

const { data } = await loadProject();
const timeoutMs = 12000;
const checkedAt = new Date().toISOString();

const targets = [
  ...data.sources.map((source) => ({
    target_type: 'source',
    target_id: source.id,
    url: source.url,
  })),
  ...data.creators.flatMap((creator) => creator.platform_accounts.flatMap((account, index) => [
    {
      target_type: 'creator_profile',
      target_id: `${creator.id}:${account.platform}:${index}:profile`,
      url: account.profile_url,
    },
    {
      target_type: 'creator_profile',
      target_id: `${creator.id}:${account.platform}:${index}:canonical`,
      url: account.canonical_profile_url,
    },
  ])),
  ...data.posts.map((post) => ({
    target_type: 'post',
    target_id: post.id,
    url: post.original_url,
  })),
];

function classify({ status, url, finalUrl, bodySample, error }) {
  if (!url) return 'unresolved';
  if (error) return 'network_error';
  if (status === 404 || status === 410) return 'broken';
  if (status === 401 || status === 403) return 'login_wall_or_blocked';
  if (/xiaohongshu\.com/.test(url)) {
    const blocked = /error_code=|当前笔记暂时无法浏览|访问的页面不见了|安全限制/.test(`${finalUrl}\n${bodySample}`);
    if (blocked) return 'login_wall_or_blocked';
  }
  if (status >= 200 && status < 400) return 'ok';
  return 'unexpected_status';
}

function sanitizeUrl(value) {
  if (!value) return value;
  try {
    const parsed = new URL(value);
    for (const key of ['xsec_token', 'xsec_source', 'web_session', 'token', 'auth']) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch {
    return value;
  }
}

async function check(target) {
  if (!target.url) {
    return { ...target, status: null, final_url: null, category: 'unresolved', checked_at: checkedAt };
  }

  let status = null;
  let finalUrl = null;
  let bodySample = '';
  let error = null;
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'AI-Creator-Index-Link-Check/0.1' },
    });
    status = response.status;
    finalUrl = response.url;
    bodySample = (await response.text()).slice(0, 12000);
  } catch (caught) {
    error = caught.name || caught.message;
  }

  return {
    ...target,
    status,
    final_url: sanitizeUrl(finalUrl),
    category: classify({ status, url: target.url, finalUrl, bodySample, error }),
    error,
    checked_at: checkedAt,
  };
}

const results = [];
const queue = [...targets];
const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
  while (queue.length) {
    const target = queue.shift();
    const result = await check(target);
    results.push(result);
    console.log(`${result.target_type}:${result.target_id}: ${result.status || result.error || 'no URL'} (${result.category})`);
  }
});
await Promise.all(workers);
results.sort((a, b) => `${a.target_type}:${a.target_id}`.localeCompare(`${b.target_type}:${b.target_id}`));

await writeFile(resolve(ROOT, 'link-report.local.json'), stableJson({ checked_at: checkedAt, results }));
const broken = results.filter((item) => item.category === 'broken');
if (broken.length) {
  console.error(`${broken.length} confirmed broken link(s).`);
  process.exitCode = 1;
}
