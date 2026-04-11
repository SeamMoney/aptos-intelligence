/**
 * Regenerate reports using Claude (Anthropic API) instead of Groq.
 * Fetches actual commit diffs from GitHub, feeds to Claude with full
 * knowledge base context for deep technical analysis.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import https from 'https';

const GROQ_KEY = process.env.GROQ_API_KEY || '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';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';
// Rotate models to spread rate limits across all of them
const MODELS = ['moonshotai/kimi-k2-instruct', 'openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile'];
let modelIdx = 0;
function nextModel() { const m = MODELS[modelIdx % MODELS.length]; modelIdx++; return m; }
const KB_DIR = join(process.cwd(), 'knowledge-base');
const WEB_DATA = join(process.cwd(), 'web/public/data');

// ── Load knowledge base ──
function loadFile(p) { try { return readFileSync(p, 'utf-8'); } catch { return ''; } }

const architecture = loadFile(join(KB_DIR, 'docs/architecture-overview.md')).slice(0, 3000);
const subsystems = {};
const subDir = join(KB_DIR, 'subsystems');
if (existsSync(subDir)) {
  for (const f of readdirSync(subDir).filter(f => f.endsWith('.md') && f !== 'INDEX.md')) {
    subsystems[f.replace('.md', '')] = loadFile(join(subDir, f)).slice(0, 2000);
  }
}

// ── Subsystem detection ──
function detectSub(title) {
  const t = title.toLowerCase();
  const m = t.match(/^\[([^\]]+)\]/);
  const tag = m ? m[1] : '';
  if (tag.includes('consensus') || tag.includes('qs')) return 'consensus';
  if (tag.includes('storage')) return 'storage';
  if (tag.includes('vm') || tag.includes('mono-move')) return 'move-vm';
  if (tag.includes('compiler') || tag.includes('prover') || tag.includes('move')) return 'move-vm';
  if (tag.includes('network') || tag.includes('state sync') || tag.includes('fullnode')) return 'state-sync';
  if (tag.includes('forge')) return 'execution';
  if (tag.includes('framework')) return 'move-vm';
  if (tag.includes('types') || tag.includes('api')) return 'types';
  if (tag.includes('encrypted') || tag.includes('dkg') || tag.includes('crypto')) return 'encrypted-mempool';
  if (tag.includes('execution') || tag.includes('gas')) return 'execution';
  if (t.includes('storage')) return 'storage';
  if (t.includes('consensus')) return 'consensus';
  return 'types';
}

// ── Fetch commit diff from GitHub ──
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'aptos-intelligence', 'Accept': 'application/json' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

async function fetchDiff(sha) {
  // Full SHA might be 7 chars, try to get the commit
  const data = await fetchJson(`https://api.github.com/repos/aptos-labs/aptos-core/commits/${sha}`);
  if (!data || !data.files) return '';

  const files = data.files.slice(0, 8); // Top 8 files
  let diff = `Files changed: ${data.files.length}\n\n`;
  for (const f of files) {
    diff += `--- ${f.filename} (+${f.additions}/-${f.deletions})\n`;
    if (f.patch) diff += f.patch.slice(0, 1500) + '\n\n';
  }
  return diff.slice(0, 8000);
}

// ── Call Groq API (Kimi K2) ──
async function callLLM(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const currentModel = nextModel();
    const body = JSON.stringify({
      model: currentModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });

    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.log('  API error:', parsed.error.message?.slice(0, 80));
            resolve(null);
            return;
          }
          resolve(parsed.choices?.[0]?.message?.content?.trim() || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const SYSTEM_PROMPT = `You are Aptos Intelligence — the world's most knowledgeable analyst of aptos-labs/aptos-core.

You will receive:
1. A commit title, author, date, and SHA
2. The actual code diff (file changes with patches)
3. Architecture documentation for the relevant subsystem
4. Source code extractions showing actual Rust/Move types

Write a technical analysis. Return ONLY valid JSON (no markdown fences):

{
  "advanced": "HTML analysis with <h3> sections. MUST include: What specific code changed (name files, structs, functions), Why this change was made, How it works technically (reference the diff), Where it fits in the Aptos pipeline (consensus → execution → storage), What the implications are. Use <code> for types/functions, <pre><code> for code snippets FROM THE DIFF. Be specific — name the actual structs and functions you see in the diff.",
  "eli5": "HTML with <p> tags. Explain what changed using a concrete analogy. Say who did it and why it matters. 3-4 paragraphs."
}

RULES:
- Name specific files, structs, functions, and types FROM THE DIFF
- Quote actual code from the diff when relevant
- Never use filler like "This page explains..." or "In summary..."
- Every sentence must add information
- If the diff shows a refactor, explain what was extracted and why
- If it's a new feature, explain the data flow`;

async function main() {
  const commits = JSON.parse(readFileSync(join(WEB_DATA, 'commits.json'), 'utf-8'));
  const reports = JSON.parse(readFileSync(join(WEB_DATA, 'reports.json'), 'utf-8'));

  // Find reports that need upgrading (short advanced content)
  const needsUpgrade = reports.filter(r => {
    // Skip deep dives
    if (r.githubId.includes('deep-dive') || r.githubId.includes('analysis')) return false;
    // Short reports need upgrading
    return r.advanced.length < 1500;
  });

  // Sort by importance (high first)
  needsUpgrade.sort((a, b) => (b.importance || 0) - (a.importance || 0));

  const batch = needsUpgrade.slice(0, parseInt(process.argv[2] || '30'));
  console.log(`Upgrading ${batch.length} of ${needsUpgrade.length} shallow reports with Claude...`);

  let upgraded = 0, failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const report = batch[i];
    const commit = commits.find(c => c.sha === report.githubId);

    console.log(`[${i+1}/${batch.length}] ${report.title.slice(0, 60)}...`);

    // Fetch the actual diff
    let diff = '';
    if (commit && commit.sha.length >= 7 && !commit.sha.includes('-')) {
      diff = await fetchDiff(commit.sha);
    }

    // Build context
    const sub = detectSub(report.title);
    const subContext = subsystems[sub] || subsystems['types'] || '';

    const userMsg = `Commit: ${report.title}
Author: ${report.author}
Date: ${report.date}
SHA: ${report.githubId}
Subsystem: ${sub}

=== CODE DIFF ===
${diff || '(No diff available — generate analysis from title and subsystem context)'}

=== ARCHITECTURE CONTEXT ===
${architecture.slice(0, 2000)}

=== SUBSYSTEM: ${sub.toUpperCase()} ===
${subContext.slice(0, 1500)}`;

    const result = await callLLM(SYSTEM_PROMPT, userMsg);

    if (result) {
      try {
        // Clean and parse JSON
        let cleaned = result
          .replace(/```json?\s*\n?/g, '').replace(/```\s*/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .trim();
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);

        const parsed = JSON.parse(cleaned);

        // Update the report in the main array
        const idx = reports.findIndex(r => r.githubId === report.githubId);
        if (idx >= 0 && parsed.advanced && parsed.advanced.length > 500) {
          reports[idx].advanced = parsed.advanced;
          reports[idx].eli5 = parsed.eli5 || reports[idx].eli5;
          upgraded++;
          console.log(`  ✓ ${parsed.advanced.length} chars`);
        } else {
          console.log(`  ✗ Too short or not found`);
          failed++;
        }
      } catch (err) {
        console.log(`  ✗ Parse error: ${err.message}`);
        failed++;
      }
    } else {
      console.log(`  ✗ API call failed`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  writeFileSync(join(WEB_DATA, 'reports.json'), JSON.stringify(reports, null, 2));
  console.log(`\nDone. Upgraded: ${upgraded}, Failed: ${failed}`);
}

main().catch(console.error);
