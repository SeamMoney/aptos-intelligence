/**
 * Regenerate ALL commit reports with deep knowledge base context.
 *
 * For each commit:
 * 1. Detect subsystem from commit message [tag]
 * 2. Load relevant subsystem source code + architecture docs
 * 3. Load recent commit history for that subsystem
 * 4. Call LLM with full context for deep analysis
 * 5. Save report
 *
 * Uses Groq API with rate limit handling (waits and retries).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const KB_DIR = join(process.cwd(), 'knowledge-base');
const WEB_DATA = join(process.cwd(), 'web/public/data');

// ── Load knowledge base ──

function loadFile(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return ''; }
}

const architectureOverview = loadFile(join(KB_DIR, 'docs/architecture-overview.md'));
const blockchainDeepDive = loadFile(join(KB_DIR, 'docs/blockchain-deep-dive.md'));
const txnsStates = loadFile(join(KB_DIR, 'docs/txns-states.md'));

// Load all subsystem source extractions
const subsystems = {};
const subsystemDir = join(KB_DIR, 'subsystems');
for (const f of readdirSync(subsystemDir).filter(f => f.endsWith('.md') && f !== 'INDEX.md')) {
  const name = f.replace('.md', '');
  subsystems[name] = loadFile(join(subsystemDir, f));
}

// Load per-subsystem commit history
const subsystemHistory = {};
const histDir = join(KB_DIR, 'history/by-subsystem');
if (existsSync(histDir)) {
  for (const f of readdirSync(histDir).filter(f => f.endsWith('.md'))) {
    const name = f.replace('.md', '');
    subsystemHistory[name] = loadFile(join(histDir, f));
  }
}

const contributorMap = loadFile(join(KB_DIR, 'history/contributors.md'));

// ── Subsystem detection ──

const TAG_TO_SUBSYSTEM = {
  'consensus': ['consensus'],
  'quorum': ['consensus'],
  'qs': ['consensus'],
  'storage': ['storage'],
  'vm': ['move-vm'],
  'move': ['move-vm'],
  'mono-move': ['move-vm'],
  'compiler': ['move-vm'],
  'compiler-v2': ['move-vm'],
  'prover': ['move-vm'],
  'execution': ['execution'],
  'block-executor': ['execution'],
  'mempool': ['mempool'],
  'encrypted': ['encrypted-mempool', 'consensus'],
  'state sync': ['state-sync'],
  'state-sync': ['state-sync'],
  'types': ['types'],
  'api': ['types'],
  'network': ['state-sync'],
  'forge': ['execution'],
  'framework': ['move-vm'],
  'gas': ['execution', 'move-vm'],
  'crypto': ['encrypted-mempool'],
  'dkg': ['encrypted-mempool', 'consensus'],
  'keyless': ['types'],
  'cli': ['move-vm'],
  'indexer': ['storage'],
  'config': ['consensus'],
  'faucet': ['types'],
  'release': ['consensus', 'execution'],
  'ci': [],
  'docker': [],
};

function detectSubsystems(title) {
  const lower = title.toLowerCase();
  // Check [tag] prefix
  const tagMatch = lower.match(/^\[([^\]]+)\]/);
  if (tagMatch) {
    const tag = tagMatch[1].trim();
    for (const [key, subs] of Object.entries(TAG_TO_SUBSYSTEM)) {
      if (tag.includes(key)) return subs;
    }
  }
  // Check keywords in title
  for (const [key, subs] of Object.entries(TAG_TO_SUBSYSTEM)) {
    if (lower.includes(key) && subs.length > 0) return subs;
  }
  return ['types']; // default
}

function buildContext(commit) {
  const subs = detectSubsystems(commit.title);
  let context = '';

  // Architecture overview (always included, truncated)
  context += '=== APTOS ARCHITECTURE OVERVIEW ===\n';
  context += architectureOverview.slice(0, 3000) + '\n\n';

  // Relevant subsystem source code
  for (const sub of subs) {
    if (subsystems[sub]) {
      context += `=== SOURCE CODE: ${sub.toUpperCase()} ===\n`;
      context += subsystems[sub].slice(0, 2000) + '\n\n';
    }
  }

  // Recent commit history for this subsystem
  for (const sub of subs) {
    const histKey = Object.keys(subsystemHistory).find(k => k.includes(sub.replace('-', ''))) || sub;
    if (subsystemHistory[histKey]) {
      context += `=== RECENT HISTORY: ${sub.toUpperCase()} ===\n`;
      context += subsystemHistory[histKey].slice(0, 1500) + '\n\n';
    }
  }

  // Contributor info
  if (commit.author) {
    const authorLines = contributorMap.split('\n').filter(l => l.toLowerCase().includes(commit.author.toLowerCase()));
    if (authorLines.length > 0) {
      context += `=== CONTRIBUTOR: ${commit.author} ===\n`;
      context += authorLines.join('\n') + '\n\n';
    }
  }

  return context.slice(0, 10000); // Cap at 10k chars
}

// ── LLM call with rate limit handling ──

async function callGroq(systemPrompt, userMessage, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 3000,
          temperature: 0.3,
        }),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '60');
        console.log(`  Rate limited, waiting ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, (retryAfter + 5) * 1000));
        continue;
      }

      const data = await res.json();
      if (data.error) {
        if (data.error.code === 'rate_limit_exceeded') {
          const wait = parseInt(data.error.message.match(/(\d+)m/)?.[1] || '2') * 60;
          console.log(`  Rate limited (${wait}s), waiting...`);
          await new Promise(r => setTimeout(r, Math.min(wait, 120) * 1000));
          continue;
        }
        throw new Error(data.error.message);
      }

      return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      console.log(`  Error: ${err.message}, retrying...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return null;
}

function cleanJson(raw) {
  let cleaned = raw
    .replace(/```json?\s*\n?/g, '')
    .replace(/```\s*/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Fix unescaped newlines in strings
    return cleaned.replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\t/g, '\\t'));
  }
}

// ── System prompt ──

const SYSTEM_PROMPT = `You are Aptos Intelligence — the world's most knowledgeable analyst of the aptos-labs/aptos-core codebase. You have deep knowledge of every subsystem, every struct, every control flow path.

You will be given:
1. Architecture documentation for the relevant Aptos subsystem
2. Source code extractions showing the actual Rust types, structs, and function signatures
3. Recent commit history for that subsystem
4. Contributor information

Use ALL of this to write deeply informed, technically accurate analysis.

RULES:
- Name specific Rust structs, traits, and functions from the source code provided
- Map the change to the exact position in the transaction lifecycle pipeline
- Explain the control flow step by step
- Reference the actual types and their fields
- Never use generic filler like "improves performance" — explain the MECHANISM
- If the commit touches consensus, reference RoundManager, BatchCoordinator, ProofManager etc.
- If the commit touches storage, reference AptosDB, JellyfishMerkleTree, TreeReader etc.
- If the commit touches execution, reference BlockExecutor, Scheduler, Block-STM etc.

Return ONLY valid JSON (no markdown fences):
{
  "advanced": "<HTML analysis with h3 sections: What Changed, Where This Fits (with pipeline diagram), How It Works, Why This Matters, Architectural Connections>",
  "eli5": "<HTML with p tags: The Big Picture analogy, What Changed, Why It Matters, What You Learned>"
}`;

// ── Main ──

async function main() {
  const commits = JSON.parse(readFileSync(join(WEB_DATA, 'commits.json'), 'utf-8'));
  const existingReports = JSON.parse(readFileSync(join(WEB_DATA, 'reports.json'), 'utf-8'));

  // Index existing LLM-generated reports (keep them)
  const existingByGithubId = new Map();
  const existingBySha = new Map();
  for (const r of existingReports) {
    existingByGithubId.set(r.githubId, r);
    // Also index by first 7 chars of githubId in case it's a SHA
    if (r.githubId.length >= 7) existingBySha.set(r.githubId.slice(0, 7), r);
  }

  // Determine which commits need new reports
  const needsReport = [];
  for (const c of commits) {
    const hasExisting = existingBySha.has(c.sha) ||
      existingReports.some(r => r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));

    // Check if existing report is just a template (short advanced content)
    const existing = existingBySha.get(c.sha) ||
      existingReports.find(r => r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase()));

    if (!existing || existing.advanced.length < 500) {
      needsReport.push(c);
    }
  }

  console.log(`Total commits: ${commits.length}`);
  console.log(`Existing reports: ${existingReports.length}`);
  console.log(`Need LLM regeneration: ${needsReport.length}`);

  // Process in batches to respect rate limits
  let newReports = [...existingReports];
  let generated = 0;
  let failed = 0;

  for (let i = 0; i < needsReport.length; i++) {
    const c = needsReport[i];
    const context = buildContext(c);
    const subs = detectSubsystems(c.title);

    console.log(`[${i + 1}/${needsReport.length}] ${c.title.slice(0, 60)}... (${subs.join(', ')})`);

    const userMessage = `Analyze this commit from aptos-labs/aptos-core:

Title: ${c.title}
Author: ${c.author}
Date: ${c.date}
SHA: ${c.sha}
Detected subsystem(s): ${subs.join(', ')}

${context}`;

    const raw = await callGroq(SYSTEM_PROMPT, userMessage);

    if (raw) {
      try {
        const cleaned = cleanJson(raw);
        const parsed = JSON.parse(cleaned);

        // Find and update existing report or create new one
        const existingIdx = newReports.findIndex(r =>
          r.githubId === c.sha || r.title.toLowerCase().includes(c.title.slice(0, 25).toLowerCase())
        );

        const report = {
          githubId: c.sha,
          title: c.title,
          author: c.author,
          date: c.date,
          category: c.category,
          importance: c.category === 'Security' ? 8 : c.category === 'Release' ? 7 : c.category === 'Feature Progress' ? 6 : c.category === 'Performance' ? 6 : 4,
          sourceUrl: c.url,
          advanced: parsed.advanced || `<p>Analysis unavailable</p>`,
          eli5: parsed.eli5 || `<p>Explanation unavailable</p>`,
          relatedFeatures: [],
          labels: [],
          id: existingIdx >= 0 ? newReports[existingIdx].id : 10000 + i,
        };

        if (existingIdx >= 0) {
          newReports[existingIdx] = report;
        } else {
          newReports.push(report);
        }

        generated++;
        console.log(`  ✓ Generated (${parsed.advanced.length} chars)`);
      } catch (err) {
        console.log(`  ✗ Parse error: ${err.message}`);
        failed++;
      }
    } else {
      console.log(`  ✗ LLM call failed`);
      failed++;
    }

    // Small delay between calls
    await new Promise(r => setTimeout(r, 1500));
  }

  // Save
  writeFileSync(join(WEB_DATA, 'reports.json'), JSON.stringify(newReports, null, 2));
  console.log(`\nDone. Generated: ${generated}, Failed: ${failed}, Total reports: ${newReports.length}`);
}

main().catch(console.error);
