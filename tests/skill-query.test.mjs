import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { queryData } from '../skills/explore-ai-creators/scripts/query.mjs';

const data = JSON.parse(await readFile(resolve('generated/index.json'), 'utf8'));

test('returns the three A-grade podcast mentions', () => {
  const result = queryData(data, { creator: '小盖', type: 'podcast', grade: 'A' });
  assert.equal(result.mentions.length, 3);
  assert.ok(result.mentions.every((mention) => mention.sources.every((source) => source.evidence_grade === 'A')));
});

test('returns three A-grade open-source projects', () => {
  const result = queryData(data, { creator: '小盖', type: 'open_source', grade: 'A' });
  assert.deepEqual(result.mentions.map((item) => item.name).sort(), [
    'Excalidraw Diagram Skill',
    'Ian Xiaohei Illustrations',
    'Note Slides',
  ]);
});

test('finds Agent security with original source links', () => {
  const result = queryData(data, { creator: '小盖', query: 'Agent安全' });
  assert.ok(result.mentions.some((item) => item.id === 'mention-agent-security-incident'));
  assert.ok(result.mentions.flatMap((item) => item.sources).some((source) => source.url?.includes('cac.gov.cn')));
});

test('recent ranking contains ten posts', () => {
  const result = queryData(data, { creator: '小盖', ranking: 'recent' });
  assert.equal(result.ranking.posts.length, 10);
  assert.equal(result.ranking.posts[0].id, 'xhs-tim-live');
});
