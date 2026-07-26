#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, loadProject, stableJson } from './lib.mjs';

const { data } = await loadProject();
const timeoutMs = 12000;
const results = [];

function classify(status, url, error) {
  if (error) return 'network_error';
  if (status === 401 || status === 403 || /xiaohongshu\.com/.test(url)) return 'login_wall_or_blocked';
  if (status === 404 || status === 410) return 'broken';
  if (status >= 200 && status < 400) return 'ok';
  return 'unexpected_status';
}

for (const source of data.sources) {
  if (!source.url) {
    results.push({ source_id: source.id, url: null, status: null, category: 'unresolved' });
    continue;
  }
  let status = null;
  let error = null;
  try {
    const response = await fetch(source.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {'user-agent': 'AI-Creator-Index-Link-Check/0.1'},
    });
    status = response.status;
    await response.body?.cancel();
  } catch (caught) {
    error = caught.name || caught.message;
  }
  results.push({
    source_id: source.id,
    url: source.url,
    status,
    category: classify(status, source.url, error),
    error,
    checked_at: new Date().toISOString(),
  });
  console.log(`${source.id}: ${status || error} (${results.at(-1).category})`);
}

await writeFile(resolve(ROOT, 'link-report.local.json'), stableJson({ results }));
const broken = results.filter((item) => item.category === 'broken');
if (broken.length) {
  console.error(`${broken.length} confirmed broken link(s).`);
  process.exitCode = 1;
}
