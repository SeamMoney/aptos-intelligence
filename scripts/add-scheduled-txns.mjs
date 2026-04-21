#!/usr/bin/env node
/**
 * Add the Scheduled Transactions (AIP-125) deep-dive to reports, commits,
 * and features-progress.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'web/public/data');

const reports = JSON.parse(readFileSync(join(DATA, 'reports.json'), 'utf8'));
const commits = JSON.parse(readFileSync(join(DATA, 'commits.json'), 'utf8'));
const features = JSON.parse(readFileSync(join(DATA, 'features-progress.json'), 'utf8'));

const advanced = readFileSync('/tmp/scheduled-transactions-advanced.html', 'utf8').trim();
const eli5 = readFileSync('/tmp/scheduled-transactions-eli5.html', 'utf8').trim();

const now = '2026-04-20T00:00:00Z';

const report = {
  id: 0,
  githubId: 'scheduled-transactions-deep-dive',
  title: 'Scheduled Transactions (AIP-125) — Native On-Chain Automation, End of Keeper Networks',
  author: 'aptos-labs',
  date: now,
  category: 'Feature Progress',
  importance: 9,
  sourceUrl: 'https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-125-scheduled-transactions.md',
  relatedFeatures: ['Block-STM v2', 'Prefix Consensus', 'Raptr', 'Archon', 'Aggregators', 'Zaptos'],
  labels: ['scheduled-transactions', 'aip-125', 'automation', 'move', 'keeper-networks'],
  advanced,
  eli5,
};

const commit = {
  sha: 'scheduled-transactions-deep-dive',
  title: report.title,
  author: 'aptos-labs',
  date: now,
  url: report.sourceUrl,
  category: 'Feature Progress',
};

// Upsert report
const rIdx = reports.findIndex(r => r.githubId === report.githubId);
if (rIdx === -1) { reports.push(report); console.log('Added report'); }
else { reports[rIdx] = { ...reports[rIdx], ...report }; console.log('Updated report'); }

// Upsert commit (at top so it's recent)
const cIdx = commits.findIndex(c => c.sha === commit.sha);
if (cIdx === -1) { commits.unshift(commit); console.log('Added commit'); }
else { commits[cIdx] = { ...commits[cIdx], ...commit }; console.log('Updated commit'); }

// Upsert feature progress (right-sidebar bar)
const featureEntry = {
  key: 'scheduled-transactions',
  name: 'Scheduled Transactions (AIP-125)',
  status: 'Design / Draft',
  progress: 25,
  color: '#ff6243',
  lead: 'Manu Dhundi',
  description: 'Native time-based and event-driven transaction automation. Removes the need for off-chain keeper networks (Chainlink Automation, Gelato).',
  whatsNeeded: 'Block-STM v2 integration, AIP-112 (function pointers), testnet validation, security review of storage pressure + reentrancy vectors.',
  whatsBeingDone: 'AIP-125 draft complete. 5-part implementation PR series opened on aptos-core (monolith #16346 + 5 sub-PRs). BigOrderedMap-backed scheduler queue at @0xb.',
  effects: 'Any DeFi protocol can run payroll, liquidations, TWAPs, subscriptions, stop-loss orders end-to-end on-chain with zero off-chain infra. Kills the keeper-bot centralization vector.',
  dependencies: ['Block-STM v2', 'AIP-112 (function pointers)', 'Aggregators (AIP-160)'],
  milestones: [
    { name: 'AIP-125 draft', date: '2025-04-15', done: true },
    { name: 'Implementation PRs opened', date: '2025-06', done: true },
    { name: 'Devnet', date: null, done: false },
    { name: 'Testnet', date: null, done: false },
    { name: 'Mainnet', date: null, done: false },
  ],
  recentCommits: 5,
};

const fIdx = features.findIndex(f => f.key === featureEntry.key);
if (fIdx === -1) { features.unshift(featureEntry); console.log('Added feature progress'); }
else { features[fIdx] = { ...features[fIdx], ...featureEntry }; console.log('Updated feature progress'); }

writeFileSync(join(DATA, 'reports.json'), JSON.stringify(reports, null, 2));
writeFileSync(join(DATA, 'commits.json'), JSON.stringify(commits, null, 2));
writeFileSync(join(DATA, 'features-progress.json'), JSON.stringify(features, null, 2));

console.log(`\nreport advanced: ${advanced.length} chars, eli5: ${eli5.length} chars`);
console.log(`reports=${reports.length}, commits=${commits.length}, features=${features.length}`);
