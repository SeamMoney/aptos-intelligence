#!/usr/bin/env node
/**
 * Generate crawler-friendly static pages for every important report:
 *   /reports/<slug>.html   — full HTML with meta tags, canonical, OG cards
 *   /reports/<slug>.txt    — plain text (LLM-friendly)
 *   /reports/index.html    — directory listing
 *   /reports/index.txt     — plain-text index
 *   /sitemap.xml           — search-engine sitemap
 *   /llms.txt              — updated with deep-dive links
 *   /llms-full.txt         — full concatenated plaintext for LLMs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SITE = 'https://aptos-intelligence.vercel.app';
const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));
const dir = 'web/public/reports';
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const important = reports.filter(r =>
  r.advanced.length > 3000 ||
  r.githubId.includes('deep-dive') ||
  r.githubId.includes('overview') ||
  r.githubId.includes('analysis') ||
  r.githubId === 'aptos-stack-map'
).sort((a, b) => (b.importance || 0) - (a.importance || 0) || b.advanced.length - a.advanced.length);

function slugOf(r) {
  return r.githubId.replace(/[^a-zA-Z0-9-]/g, '-');
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstSentence(text, maxLen = 200) {
  const t = stripHtml(text).replace(/\s+/g, ' ');
  const dot = t.indexOf('. ');
  const cut = dot > 60 && dot < maxLen ? dot + 1 : maxLen;
  return t.slice(0, cut).trim();
}

const HEAD_STYLES = `
  :root {
    --bg: #0f0f0f; --surface: #1a1a1a; --surface-alt: #242424;
    --text: #f5f5f5; --text-muted: #c7c7c7; --text-faint: #8f8f8f;
    --border: #303030; --border-muted: #3f3f46; --accent: #ff6243;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  body { line-height: 1.65; }
  a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  a:hover { opacity: 0.85; }
  code { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 0.88em; background: var(--surface-alt); color: var(--accent); padding: 0.15em 0.4em; border: 1px solid var(--border-muted); border-radius: 3px; }
  pre { background: #0d1117; color: #e6edf3; padding: 1.2em; overflow-x: auto; font-size: 12px; line-height: 1.7; border: 1px solid var(--border); border-radius: 6px; margin: 1.5em 0; }
  pre code { background: none; border: none; padding: 0; color: inherit; font-size: inherit; }
  blockquote { border-left: 3px solid var(--accent); padding-left: 1.2em; margin: 1.5em 0; color: var(--text-muted); font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 13px; }
  th { text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; color: var(--text-faint); padding: 0.6em 0.7em; border-bottom: 2px solid var(--border); }
  td { padding: 0.6em 0.7em; border-bottom: 1px solid var(--border-muted); vertical-align: top; }
  h1, h2, h3, h4 { font-weight: 700; color: var(--text); letter-spacing: -0.01em; margin: 2em 0 0.75em; }
  h1 { font-size: 32px; letter-spacing: -0.02em; margin-top: 0.4em; }
  h2 { font-size: 22px; border-bottom: 1px solid var(--border); padding-bottom: 0.4em; }
  h3 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); }
  h4 { font-size: 14px; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.4em 0; }
  .container { max-width: 820px; margin: 0 auto; padding: 48px 24px 80px; }
  header.top { border-bottom: 1px solid var(--border); padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
  header.top a { color: var(--accent); text-decoration: none; font-weight: 700; }
  .meta { color: var(--text-faint); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 2em; display: flex; flex-wrap: wrap; gap: 16px; }
  .meta span { display: inline-flex; align-items: center; gap: 6px; }
  .tag { display: inline-block; padding: 2px 8px; border: 1px solid var(--border); border-radius: 2px; font-size: 10px; color: var(--text-muted); margin-right: 6px; }
  .section-divider { border: none; border-top: 1px solid var(--border); margin: 3em 0; }
  .eli5 { background: var(--surface); border-left: 3px solid var(--accent); padding: 1em 1.4em; border-radius: 4px; }
  footer.bottom { border-top: 1px solid var(--border); padding: 24px; text-align: center; font-size: 12px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 48px; }
  .related a { display: inline-block; margin-right: 12px; margin-bottom: 8px; padding: 4px 10px; border: 1px solid var(--border); border-radius: 2px; font-size: 12px; text-decoration: none; color: var(--text-muted); }
  .related a:hover { border-color: var(--accent); color: var(--accent); }
`;

function renderReportHtml(r) {
  const slug = slugOf(r);
  const canonical = `${SITE}/reports/${slug}`;
  const interactive = `${SITE}/#${encodeURIComponent(r.githubId)}`;
  const description = firstSentence(r.advanced, 200);
  const published = new Date(r.date).toISOString();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: r.title,
    description,
    author: { '@type': 'Person', name: r.author },
    datePublished: published,
    url: canonical,
    mainEntityOfPage: canonical,
    publisher: { '@type': 'Organization', name: 'Aptos Intelligence' },
    keywords: (r.labels || []).join(', '),
  };

  const related = (r.relatedFeatures || []).map(f => `<span class="tag">${esc(f)}</span>`).join('');
  const labels = (r.labels || []).map(l => `<span class="tag">${esc(l)}</span>`).join('');
  const otherDives = important
    .filter(x => x.githubId !== r.githubId)
    .slice(0, 6)
    .map(x => `<a href="/reports/${slugOf(x)}">${esc(x.title)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title)} — Aptos Intelligence</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(r.title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Aptos Intelligence">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(r.title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="author" content="${esc(r.author)}">
<meta name="article:published_time" content="${published}">
<link rel="alternate" type="text/plain" href="/reports/${slug}.txt">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>${HEAD_STYLES}</style>
</head>
<body>
<header class="top">
  <a href="/">← Aptos Intelligence</a>
  <span style="color: var(--text-faint)">Deep Dive</span>
</header>
<main class="container">
  <article>
    <h1>${esc(r.title)}</h1>
    <div class="meta">
      <span>By ${esc(r.author)}</span>
      <span>${new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      <span>${esc(r.category)}</span>
      <span>Importance ${r.importance}/10</span>
      <span><a href="${esc(r.sourceUrl)}" rel="noopener">Source</a></span>
    </div>
    ${labels ? `<div style="margin-bottom: 2em;">${labels}</div>` : ''}

    ${r.advanced}

    <hr class="section-divider">

    <section class="eli5">
      <h2 style="border: none; padding: 0; margin-top: 0;">ELI5 — Explain Like I'm 5</h2>
      ${r.eli5}
    </section>

    ${related ? `<hr class="section-divider"><h3>Related Systems</h3><div>${related}</div>` : ''}

    ${otherDives ? `<hr class="section-divider"><h3>Other Deep Dives</h3><div class="related">${otherDives}</div>` : ''}

    <hr class="section-divider">
    <p style="color: var(--text-faint); font-size: 13px;">
      View this report interactively with Advanced / ELI5 tabs at
      <a href="${interactive}">${interactive}</a>.
      Plain-text version: <a href="/reports/${slug}.txt">/reports/${slug}.txt</a>.
    </p>
  </article>
</main>
<footer class="bottom">
  Aptos Intelligence — every commit that matters, explained.
</footer>
</body>
</html>`;
}

function renderIndexHtml() {
  const rows = important.map(r => {
    const slug = slugOf(r);
    return `<tr>
      <td><a href="/reports/${slug}">${esc(r.title)}</a></td>
      <td>${esc(r.category)}</td>
      <td>${esc(r.author)}</td>
      <td>${new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td>${r.importance}/10</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>All Deep Dives — Aptos Intelligence</title>
<meta name="description" content="Index of ${important.length} technical deep-dive reports on Aptos blockchain infrastructure — consensus, execution, privacy, sharding.">
<link rel="canonical" href="${SITE}/reports/">
<link rel="alternate" type="text/plain" href="${SITE}/reports/index.txt">
<style>${HEAD_STYLES}</style>
</head>
<body>
<header class="top">
  <a href="/">← Aptos Intelligence</a>
  <span style="color: var(--text-faint)">All Deep Dives</span>
</header>
<main class="container" style="max-width: 1000px;">
  <h1>All Deep Dives</h1>
  <p style="color: var(--text-muted); margin-bottom: 2em;">${important.length} technical reports on Aptos blockchain infrastructure. Each page is indexable and linkable. Interactive SPA at <a href="/">the homepage</a>.</p>
  <table>
    <thead><tr><th>Title</th><th>Category</th><th>Author</th><th>Date</th><th>Importance</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
<footer class="bottom">Aptos Intelligence — every commit that matters, explained.</footer>
</body>
</html>`;
}

function renderSitemap() {
  const now = new Date().toISOString();
  const urls = [
    `<url><loc>${SITE}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>`,
    `<url><loc>${SITE}/reports/</loc><lastmod>${now}</lastmod><priority>0.9</priority></url>`,
    ...important.map(r => {
      const slug = slugOf(r);
      const lastmod = new Date(r.date).toISOString();
      const priority = Math.min(1.0, 0.5 + (r.importance || 5) * 0.05).toFixed(2);
      return `<url><loc>${SITE}/reports/${slug}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
    }),
  ].join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>\n`;
}

function renderRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

console.log(`Generating HTML + TXT for ${important.length} reports...`);

for (const r of important) {
  const slug = slugOf(r);
  writeFileSync(`${dir}/${slug}.html`, renderReportHtml(r));
  const txt = `# ${r.title}

Author: ${r.author}
Date: ${r.date}
Category: ${r.category}
Importance: ${r.importance}/10
Source: ${r.sourceUrl}
Canonical: ${SITE}/reports/${slug}
Interactive: ${SITE}/#${r.githubId}

---

## Advanced Analysis

${stripHtml(r.advanced)}

---

## ELI5 (Explain Like I'm 5)

${stripHtml(r.eli5)}
`;
  writeFileSync(`${dir}/${slug}.txt`, txt);
}

// Index pages
writeFileSync(`${dir}/index.html`, renderIndexHtml());
let indexTxt = `# Aptos Intelligence — Deep Dive Index\n\n${important.length} reports, each at /reports/<slug> (HTML) and /reports/<slug>.txt (plaintext).\n\n`;
for (const r of important) {
  const slug = slugOf(r);
  indexTxt += `- [${r.title}](${SITE}/reports/${slug}) — ${r.category}, importance ${r.importance}/10\n`;
}
writeFileSync(`${dir}/index.txt`, indexTxt);

// Sitemap + robots at the site root
writeFileSync('web/public/sitemap.xml', renderSitemap());
writeFileSync('web/public/robots.txt', renderRobots());

// Rewrite llms.txt fresh — point to new canonical URLs
const llmsHeader = `# Aptos Intelligence
> Real-time technical analysis of every commit to aptos-labs/aptos-core

## Deep Dives (${important.length} reports)

`;
let llms = llmsHeader;
for (const r of important) {
  const slug = slugOf(r);
  llms += `- [${r.title}](${SITE}/reports/${slug}): ${r.category}, importance ${r.importance}/10\n`;
}
llms += `\n## Plain-text versions for LLMs\n\n- [Index](${SITE}/reports/index.txt)\n`;
for (const r of important) {
  const slug = slugOf(r);
  llms += `- [${r.title}](${SITE}/reports/${slug}.txt)\n`;
}
writeFileSync('web/public/llms.txt', llms);

// llms-full.txt — concat all plaintexts
let llmsFull = `# Aptos Intelligence — Full Plaintext Corpus\n\n${important.length} deep dives, concatenated for LLM ingestion.\nGenerated: ${new Date().toISOString()}\n\n`;
for (const r of important) {
  llmsFull += `\n\n====================================================================\n`;
  llmsFull += `${r.title}\nBy ${r.author} · ${r.category} · Importance ${r.importance}/10\n`;
  llmsFull += `Canonical: ${SITE}/reports/${slugOf(r)}\n`;
  llmsFull += `====================================================================\n\n`;
  llmsFull += `## Advanced\n\n${stripHtml(r.advanced)}\n\n## ELI5\n\n${stripHtml(r.eli5)}\n`;
}
writeFileSync('web/public/llms-full.txt', llmsFull);

console.log(`Generated:`);
console.log(`  ${important.length} report HTML pages`);
console.log(`  ${important.length} report TXT pages`);
console.log(`  /reports/index.html, /reports/index.txt`);
console.log(`  /sitemap.xml, /robots.txt`);
console.log(`  /llms.txt, /llms-full.txt`);
