#!/usr/bin/env node
/**
 * Refresh all data from GitHub and regenerate reports.
 * Intended to run via GitHub Actions cron or manually.
 *
 * 1. Fetches latest 600 commits from aptos-core
 * 2. Generates reports for any new commits
 * 3. Upgrades shallow reports with knowledge base templates
 * 4. Saves to web/public/data/
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const WEB_DATA = join(process.cwd(), 'web/public/data');

function githubFetch(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'aptos-intelligence' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

function detectCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('release') || t.includes('version')) return 'Release';
  if (t.includes('consensus') || t.includes('quorum') || t.includes('encrypted') || t.includes('batch')) return 'Feature Progress';
  if (t.includes('fix') || t.includes('security') || t.includes('replay')) return 'Security';
  if (t.includes('storage') || t.includes('perf') || t.includes('cache')) return 'Performance';
  if (t.includes('compiler') || t.includes('vm') || t.includes('move') || t.includes('prover')) return 'Feature Progress';
  return 'Infrastructure';
}

async function fetchCommits() {
  console.log('Fetching commits from aptos-labs/aptos-core...');
  const all = [];
  for (let page = 1; page <= 6; page++) {
    const commits = await githubFetch(`https://api.github.com/repos/aptos-labs/aptos-core/commits?sha=main&per_page=100&page=${page}`);
    if (!Array.isArray(commits)) { console.log('API error:', commits.message); break; }
    for (const c of commits) {
      all.push({
        sha: c.sha.slice(0, 7),
        title: c.commit.message.split('\n')[0],
        author: c.author?.login || c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
        category: detectCategory(c.commit.message),
      });
    }
    console.log(`  Page ${page}: ${commits.length} commits`);
  }
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all;
}

async function fetchRecentPRs() {
  console.log('Fetching recent merged PRs...');
  const prs = await githubFetch('https://api.github.com/repos/aptos-labs/aptos-core/pulls?state=closed&sort=updated&direction=desc&per_page=30');
  if (!Array.isArray(prs)) return [];
  return prs.filter(pr => pr.merged_at).map(pr => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || 'unknown',
    merged_at: pr.merged_at,
    url: pr.html_url,
    labels: pr.labels?.map(l => l.name) || [],
  }));
}

async function fetchRecentIssues() {
  console.log('Fetching recent issues...');
  const issues = await githubFetch('https://api.github.com/repos/aptos-labs/aptos-core/issues?state=all&sort=updated&direction=desc&per_page=20');
  if (!Array.isArray(issues)) return [];
  return issues.filter(i => !i.pull_request).map(i => ({
    number: i.number,
    title: i.title,
    author: i.user?.login || 'unknown',
    state: i.state,
    created_at: i.created_at,
    url: i.html_url,
    labels: i.labels?.map(l => l.name) || [],
  }));
}

async function main() {
  const startTime = Date.now();

  // 1. Fetch commits + preserve custom deep-dive entries
  const commits = await fetchCommits();

  // Preserve custom entries (non-SHA githubIds like 'ans-deep-dive')
  try {
    const existing = JSON.parse(readFileSync(join(WEB_DATA, 'commits.json'), 'utf-8'));
    const customEntries = existing.filter(c => c.sha.includes('-deep-dive') || c.sha.includes('-analysis'));
    for (const entry of customEntries) {
      if (!commits.find(c => c.sha === entry.sha)) {
        commits.unshift(entry);
      }
    }
    console.log(`Preserved ${customEntries.length} custom entries`);
  } catch {}

  writeFileSync(join(WEB_DATA, 'commits.json'), JSON.stringify(commits, null, 2));
  console.log(`\nTotal commits: ${commits.length}`);
  const dates = [...new Set(commits.map(c => c.date.slice(0, 10)))].sort();
  console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);

  // 2. Fetch PRs and issues for activity feed
  const prs = await fetchRecentPRs();
  const issues = await fetchRecentIssues();
  writeFileSync(join(WEB_DATA, 'activity.json'), JSON.stringify({ prs, issues, lastUpdated: new Date().toISOString() }, null, 2));
  console.log(`PRs: ${prs.length}, Issues: ${issues.length}`);

  // 3. Generate reports for new commits
  const existingReports = JSON.parse(readFileSync(join(WEB_DATA, 'reports.json'), 'utf-8'));
  const existingSHAs = new Set(existingReports.map(r => r.githubId));

  const newCommits = commits.filter(c => !existingSHAs.has(c.sha));
  console.log(`\nNew commits needing reports: ${newCommits.length}`);

  if (newCommits.length > 0) {
    // Use the generate-reports script logic inline
    let nextId = Math.max(...existingReports.map(r => r.id || 0)) + 1;

    for (const c of newCommits) {
      existingReports.push({
        id: nextId++,
        githubId: c.sha,
        title: c.title,
        author: c.author,
        date: c.date,
        category: c.category,
        importance: c.category === 'Security' ? 8 : c.category === 'Release' ? 7 : c.category === 'Feature Progress' ? 6 : 4,
        sourceUrl: c.url,
        advanced: `<h3>What Changed</h3><p><strong>${c.title.replace(/</g, '&lt;')}</strong></p><p>by ${c.author} on ${new Date(c.date).toLocaleDateString()}</p><p><a href="${c.url}" target="_blank">View on GitHub →</a></p>`,
        eli5: `<p><strong>${c.title.replace(/</g, '&lt;')}</strong> — a change by ${c.author}.</p>`,
        relatedFeatures: [],
        labels: [],
      });
    }

    writeFileSync(join(WEB_DATA, 'reports.json'), JSON.stringify(existingReports, null, 2));
    console.log(`Generated ${newCommits.length} new reports. Total: ${existingReports.length}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
