#!/usr/bin/env node
/**
 * Merge agent-produced expanded HTML files into reports.json.
 * Reads from /tmp/<slug>-advanced.html and /tmp/<slug>-eli5.html.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'web/public/data');
const reports = JSON.parse(readFileSync(join(DATA, 'reports.json'), 'utf8'));

const targets = [
  'prefix-consensus-deep-dive',
  'shardines-deep-dive',
  'aptos-stack-map',
];

const slugToFile = id => id === 'prefix-consensus-deep-dive' ? 'prefix-consensus'
  : id === 'shardines-deep-dive' ? 'shardines'
  : 'aptos-stack-map';

for (const id of targets) {
  const i = reports.findIndex(r => r.githubId === id);
  if (i === -1) { console.error(`Not found: ${id}`); continue; }

  const base = slugToFile(id);
  const advPath = `/tmp/${base}-advanced.html`;
  const eli5Path = `/tmp/${base}-eli5.html`;

  const adv = readFileSync(advPath, 'utf8').trim();
  const eli5 = readFileSync(eli5Path, 'utf8').trim();

  const oldAdvLen = reports[i].advanced.length;
  const oldEli5Len = reports[i].eli5.length;

  reports[i].advanced = adv;
  reports[i].eli5 = eli5;
  reports[i].date = '2026-04-17T00:00:00Z';

  console.log(`${id}: advanced ${oldAdvLen} → ${adv.length}, eli5 ${oldEli5Len} → ${eli5.length}`);
}

writeFileSync(join(DATA, 'reports.json'), JSON.stringify(reports, null, 2));
console.log('Merged into reports.json');
