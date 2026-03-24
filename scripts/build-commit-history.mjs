#!/usr/bin/env node
/**
 * Fetch 500+ commits from aptos-labs/aptos-core and build a structured
 * commit-history knowledge base.
 *
 * Usage:  node scripts/build-commit-history.mjs
 */

import fs from "node:fs";
import path from "node:path";

// ─── Configuration ──────────────────────────────────────────────────────────
const TOKEN = process.env.GH_TOKEN || "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";
const OWNER = "aptos-labs";
const REPO = "aptos-core";
const BRANCH = "main";
const PAGES = 6; // 6 pages × 100 = 600 commits (guarantees 500+)
const PER_PAGE = 100;

const ROOT = "/Users/maxmohammadi/aptos-intelligence";
const HISTORY_DIR = path.join(ROOT, "knowledge-base", "history");
const SUBSYSTEM_DIR = path.join(HISTORY_DIR, "by-subsystem");
const WEB_DATA_DIR = path.join(ROOT, "web", "public", "data");

// ─── Helpers ────────────────────────────────────────────────────────────────
const headers = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "aptos-intelligence-bot",
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ─── Subsystem detection ────────────────────────────────────────────────────
const SUBSYSTEM_PATTERNS = [
  { re: /\[consensus\]/i, tag: "consensus" },
  { re: /\[storage\]/i, tag: "storage" },
  { re: /\[vm\]/i, tag: "vm" },
  { re: /\[move[- ]?vm\]/i, tag: "vm" },
  { re: /\[forge\]/i, tag: "forge" },
  { re: /\[ci\]/i, tag: "ci" },
  { re: /\[compiler[- ]?v2\]/i, tag: "compiler-v2" },
  { re: /\[compiler\]/i, tag: "compiler" },
  { re: /\[move\]/i, tag: "move" },
  { re: /\[api\]/i, tag: "api" },
  { re: /\[rest[_ ]?api\]/i, tag: "api" },
  { re: /\[state[- _]?sync\]/i, tag: "state-sync" },
  { re: /\[network\]/i, tag: "network" },
  { re: /\[types\]/i, tag: "types" },
  { re: /\[mempool\]/i, tag: "mempool" },
  { re: /\[sdk\]/i, tag: "sdk" },
  { re: /\[indexer\]/i, tag: "indexer" },
  { re: /\[execution\]/i, tag: "execution" },
  { re: /\[executor\]/i, tag: "execution" },
  { re: /\[crypto\]/i, tag: "crypto" },
  { re: /\[framework\]/i, tag: "framework" },
  { re: /\[aptos[- _]?framework\]/i, tag: "framework" },
  { re: /\[config\]/i, tag: "config" },
  { re: /\[docker\]/i, tag: "docker" },
  { re: /\[terraform\]/i, tag: "terraform" },
  { re: /\[infra\]/i, tag: "infra" },
  { re: /\[prover\]/i, tag: "prover" },
  { re: /\[lint\]/i, tag: "lint" },
  { re: /\[gas\]/i, tag: "gas" },
  { re: /\[faucet\]/i, tag: "faucet" },
  { re: /\[cli\]/i, tag: "cli" },
  { re: /\[telemetry\]/i, tag: "telemetry" },
  { re: /\[transaction[_ ]?replay\]/i, tag: "transaction-replay" },
  { re: /\[keyless\]/i, tag: "keyless" },
  { re: /\[jwk\]/i, tag: "jwk" },
  { re: /\[multisig\]/i, tag: "multisig" },
  { re: /\[ecosystem\]/i, tag: "ecosystem" },
  { re: /\[dkg\]/i, tag: "dkg" },
  { re: /\[randomness\]/i, tag: "randomness" },
  { re: /\[object\]/i, tag: "object" },
  { re: /bump deployer/i, tag: "release" },
];

function detectSubsystems(message) {
  const matched = [];
  for (const { re, tag } of SUBSYSTEM_PATTERNS) {
    if (re.test(message)) matched.push(tag);
  }
  if (matched.length === 0) matched.push("other");
  return [...new Set(matched)];
}

function detectCategory(message) {
  const subs = detectSubsystems(message);
  if (subs.includes("release")) return "Release";
  if (subs.includes("consensus")) return "Consensus";
  if (subs.includes("storage")) return "Storage";
  if (subs.includes("vm")) return "VM";
  if (subs.includes("move") || subs.includes("compiler") || subs.includes("compiler-v2")) return "Move/Compiler";
  if (subs.includes("api")) return "API";
  if (subs.includes("state-sync")) return "State Sync";
  if (subs.includes("network")) return "Networking";
  if (subs.includes("mempool")) return "Mempool";
  if (subs.includes("forge")) return "Testing";
  if (subs.includes("ci")) return "CI/CD";
  if (subs.includes("framework")) return "Framework";
  if (subs.includes("indexer")) return "Indexer";
  if (subs.includes("sdk")) return "SDK";
  if (subs.includes("execution")) return "Execution";
  if (subs.includes("crypto")) return "Crypto";
  if (subs.includes("prover")) return "Prover";
  if (subs.includes("gas")) return "Gas";
  if (subs.includes("keyless")) return "Keyless";
  if (subs.includes("cli")) return "CLI";
  if (subs.includes("infra") || subs.includes("docker") || subs.includes("terraform")) return "Infrastructure";
  return "Infrastructure";
}

// ─── 1.  Fetch commits ─────────────────────────────────────────────────────
async function fetchAllCommits() {
  console.log(`Fetching ${PAGES} pages of ${PER_PAGE} commits from ${OWNER}/${REPO}…`);
  const allRaw = [];
  for (let page = 1; page <= PAGES; page++) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits?sha=${BRANCH}&per_page=${PER_PAGE}&page=${page}`;
    console.log(`  Page ${page}…`);
    const data = await fetchJSON(url);
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`  Page ${page} returned ${data?.length ?? 0} items — stopping.`);
      break;
    }
    allRaw.push(...data);
    console.log(`  Got ${data.length} commits (total so far: ${allRaw.length})`);
  }
  return allRaw;
}

function normalizeCommit(raw) {
  const msg = raw.commit?.message ?? "";
  const firstLine = msg.split("\n")[0];
  return {
    sha: raw.sha?.slice(0, 7),
    full_sha: raw.sha,
    title: firstLine,
    author: raw.author?.login ?? raw.commit?.author?.name ?? "unknown",
    date: raw.commit?.author?.date ?? raw.commit?.committer?.date ?? "",
    url: raw.html_url ?? `https://github.com/${OWNER}/${REPO}/commit/${raw.sha}`,
    subsystems: detectSubsystems(firstLine),
    category: detectCategory(firstLine),
  };
}

// ─── 2.  Group by subsystem and write per-subsystem files ───────────────────
function buildSubsystemFiles(commits) {
  const groups = {};
  for (const c of commits) {
    for (const sub of c.subsystems) {
      (groups[sub] ??= []).push(c);
    }
  }

  const now = new Date();
  const d30 = new Date(now - 30 * 86400000);
  const d60 = new Date(now - 60 * 86400000);
  const d90 = new Date(now - 90 * 86400000);

  const summaries = {}; // for timeline use

  for (const [sub, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    // contributor counts
    const authorCounts = {};
    let c30 = 0, c60 = 0, c90 = 0;
    for (const c of list) {
      authorCounts[c.author] = (authorCounts[c.author] || 0) + 1;
      const d = new Date(c.date);
      if (d >= d30) c30++;
      if (d >= d60) c60++;
      if (d >= d90) c90++;
    }

    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    summaries[sub] = { total: list.length, c30, c60, c90, topAuthors };

    let md = `# Subsystem: ${sub}\n\n`;
    md += `> Auto-generated on ${now.toISOString().split("T")[0]}\n\n`;
    md += `## Activity summary\n\n`;
    md += `| Window | Commits |\n|--------|--------:|\n`;
    md += `| Last 30 days | ${c30} |\n`;
    md += `| Last 60 days | ${c60} |\n`;
    md += `| Last 90 days | ${c90} |\n`;
    md += `| All fetched   | ${list.length} |\n\n`;

    md += `## Most active contributors\n\n`;
    md += `| Author | Commits |\n|--------|--------:|\n`;
    for (const [a, n] of topAuthors) {
      md += `| ${a} | ${n} |\n`;
    }

    md += `\n## Recent commits\n\n`;
    md += `| Date | Author | Title |\n|------|--------|-------|\n`;
    for (const c of list.slice(0, 80)) {
      const dateStr = c.date.split("T")[0];
      const safeTitle = c.title.replace(/\|/g, "\\|").slice(0, 120);
      md += `| ${dateStr} | ${c.author} | ${safeTitle} |\n`;
    }
    if (list.length > 80) {
      md += `\n_… and ${list.length - 80} more commits._\n`;
    }

    const outFile = path.join(SUBSYSTEM_DIR, `${sub}.md`);
    fs.writeFileSync(outFile, md, "utf8");
    console.log(`  Wrote ${outFile}  (${list.length} commits)`);
  }

  return { groups, summaries };
}

// ─── 3.  Timeline summary ───────────────────────────────────────────────────
function buildTimeline(commits, summaries) {
  const now = new Date();
  const d90 = new Date(now - 90 * 86400000);

  // Group by ISO week
  function weekKey(dateStr) {
    const d = new Date(dateStr);
    // Use Monday-based weeks: find the Monday
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    return monday.toISOString().split("T")[0];
  }

  const weeks = {};
  const recent = commits.filter((c) => new Date(c.date) >= d90);
  for (const c of recent) {
    const wk = weekKey(c.date);
    (weeks[wk] ??= []).push(c);
  }

  // Most active subsystems (last 90 days)
  const subActivity = Object.entries(summaries)
    .map(([sub, s]) => [sub, s.c90])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  let md = `# Aptos Core — Commit Timeline (last 90 days)\n\n`;
  md += `> Auto-generated on ${now.toISOString().split("T")[0]} from ${commits.length} fetched commits.\n\n`;

  // Subsystem heat map
  md += `## Subsystem activity (last 90 days)\n\n`;
  md += `| Subsystem | Commits (90d) |\n|-----------|-------------:|\n`;
  for (const [sub, n] of subActivity.slice(0, 20)) {
    md += `| ${sub} | ${n} |\n`;
  }

  // Releases / tags
  const releases = commits.filter(
    (c) =>
      /bump deployer|release|tag/i.test(c.title) &&
      c.subsystems.includes("release")
  );
  if (releases.length) {
    md += `\n## Notable releases\n\n`;
    md += `| Date | Title | Author |\n|------|-------|--------|\n`;
    for (const r of releases.slice(0, 30)) {
      md += `| ${r.date.split("T")[0]} | ${r.title.replace(/\|/g, "\\|").slice(0, 100)} | ${r.author} |\n`;
    }
  }

  // Weekly breakdown
  md += `\n## Weekly breakdown\n\n`;
  const sortedWeeks = Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
  for (const [wk, wCommits] of sortedWeeks) {
    md += `### Week of ${wk}  (${wCommits.length} commits)\n\n`;
    // Subsystem counts for the week
    const subCounts = {};
    for (const c of wCommits) {
      for (const s of c.subsystems) {
        subCounts[s] = (subCounts[s] || 0) + 1;
      }
    }
    const topSubs = Object.entries(subCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    md += `Active subsystems: ${topSubs.map(([s, n]) => `**${s}** (${n})`).join(", ")}\n\n`;

    md += `| Date | Author | Title |\n|------|--------|-------|\n`;
    for (const c of wCommits.slice(0, 30)) {
      md += `| ${c.date.split("T")[0]} | ${c.author} | ${c.title.replace(/\|/g, "\\|").slice(0, 100)} |\n`;
    }
    if (wCommits.length > 30) {
      md += `\n_… and ${wCommits.length - 30} more._\n`;
    }
    md += "\n";
  }

  const outFile = path.join(HISTORY_DIR, "timeline.md");
  fs.writeFileSync(outFile, md, "utf8");
  console.log(`  Wrote ${outFile}`);
}

// ─── 4.  Contributor map ────────────────────────────────────────────────────
function buildContributorMap(commits) {
  const map = {}; // author -> { commits, subsystems: {sub: count} }
  for (const c of commits) {
    const a = c.author;
    if (!map[a]) map[a] = { commits: 0, subsystems: {} };
    map[a].commits++;
    for (const s of c.subsystems) {
      map[a].subsystems[s] = (map[a].subsystems[s] || 0) + 1;
    }
  }

  // Sort by commit count
  const sorted = Object.entries(map).sort((a, b) => b[1].commits - a[1].commits);

  // Subsystem experts
  const subExperts = {};
  for (const [author, info] of sorted) {
    for (const [sub, count] of Object.entries(info.subsystems)) {
      if (!subExperts[sub] || count > subExperts[sub].count) {
        subExperts[sub] = { author, count };
      }
    }
  }

  let md = `# Aptos Core — Contributor Map\n\n`;
  md += `> Auto-generated on ${new Date().toISOString().split("T")[0]} from ${commits.length} commits.\n\n`;

  md += `## Top contributors\n\n`;
  md += `| # | Author | Commits | Primary subsystems |\n|---|--------|--------:|--------------------|\n`;
  for (let i = 0; i < Math.min(sorted.length, 50); i++) {
    const [author, info] = sorted[i];
    const topSubs = Object.entries(info.subsystems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s, n]) => `${s}(${n})`)
      .join(", ");
    md += `| ${i + 1} | ${author} | ${info.commits} | ${topSubs} |\n`;
  }

  md += `\n## Subsystem experts (most commits per subsystem)\n\n`;
  md += `| Subsystem | Expert | Commits |\n|-----------|--------|--------:|\n`;
  for (const [sub, { author, count }] of Object.entries(subExperts).sort(
    (a, b) => b[1].count - a[1].count
  )) {
    md += `| ${sub} | ${author} | ${count} |\n`;
  }

  const outFile = path.join(HISTORY_DIR, "contributors.md");
  fs.writeFileSync(outFile, md, "utf8");
  console.log(`  Wrote ${outFile}`);
}

// ─── 5.  Web app commits.json ───────────────────────────────────────────────
function writeWebCommits(commits) {
  const webData = commits.map((c) => ({
    sha: c.sha,
    title: c.title,
    author: c.author,
    date: c.date,
    url: c.url,
    category: c.category,
  }));
  fs.mkdirSync(WEB_DATA_DIR, { recursive: true });
  const outFile = path.join(WEB_DATA_DIR, "commits.json");
  fs.writeFileSync(outFile, JSON.stringify(webData, null, 2), "utf8");
  console.log(`  Wrote ${outFile}  (${webData.length} entries)`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Aptos Core commit-history knowledge-base builder ===\n");

  // Ensure output dirs exist
  fs.mkdirSync(SUBSYSTEM_DIR, { recursive: true });
  fs.mkdirSync(WEB_DATA_DIR, { recursive: true });

  // 1. Fetch
  const raw = await fetchAllCommits();
  console.log(`\nTotal raw commits fetched: ${raw.length}\n`);

  // Normalize
  const commits = raw.map(normalizeCommit);

  // 2. Subsystem files
  console.log("Building per-subsystem files…");
  const { summaries } = buildSubsystemFiles(commits);

  // 3. Timeline
  console.log("\nBuilding timeline…");
  buildTimeline(commits, summaries);

  // 4. Contributors
  console.log("\nBuilding contributor map…");
  buildContributorMap(commits);

  // 5. Web commits.json
  console.log("\nWriting web commits.json…");
  writeWebCommits(commits);

  // Summary
  console.log("\n=== Done ===");
  console.log(`  Commits fetched : ${commits.length}`);
  console.log(`  Subsystem files : ${Object.keys(summaries).length}`);
  console.log(`  History dir     : ${HISTORY_DIR}`);
  console.log(`  Web data        : ${WEB_DATA_DIR}/commits.json`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
