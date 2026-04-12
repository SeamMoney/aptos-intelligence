import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));
const dir = 'web/public/reports';
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const important = reports.filter(r =>
  r.advanced.length > 3000 ||
  r.githubId.includes('deep-dive') ||
  r.githubId.includes('overview') ||
  r.githubId.includes('analysis')
);

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

console.log(`Generating ${important.length} static report pages...`);

important.forEach(r => {
  const slug = r.githubId.replace(/[^a-zA-Z0-9-]/g, '-');
  const content = `# ${r.title}

Author: ${r.author}
Date: ${r.date}
Category: ${r.category}
Importance: ${r.importance}/10
Source: ${r.sourceUrl}
URL: https://aptos-intelligence.vercel.app/#${r.githubId}

---

## Advanced Analysis

${stripHtml(r.advanced)}

---

## ELI5 (Explain Like I'm 5)

${stripHtml(r.eli5)}
`;

  writeFileSync(`${dir}/${slug}.txt`, content);
});

// Generate index
let index = `# Aptos Intelligence — Static Report Index

These pages are plain-text versions of reports for LLM indexing.
Each report is available at /reports/{slug}.txt

## Reports (${important.length} total)

`;

important.forEach(r => {
  const slug = r.githubId.replace(/[^a-zA-Z0-9-]/g, '-');
  index += `- [${r.title}](https://aptos-intelligence.vercel.app/reports/${slug}.txt) — ${r.category}, ${r.importance}/10\n`;
});

writeFileSync(`${dir}/index.txt`, index);

// Update llms.txt to point to the static pages
let llmsTxt = readFileSync('web/public/llms.txt', 'utf-8');
if (!llmsTxt.includes('/reports/index.txt')) {
  llmsTxt += `\n## Static Report Pages (for LLM indexing)\n`;
  llmsTxt += `- [Report Index](https://aptos-intelligence.vercel.app/reports/index.txt): Index of all deep dive reports as plain text\n`;
  important.slice(0, 10).forEach(r => {
    const slug = r.githubId.replace(/[^a-zA-Z0-9-]/g, '-');
    llmsTxt += `- [${r.title}](https://aptos-intelligence.vercel.app/reports/${slug}.txt)\n`;
  });
  writeFileSync('web/public/llms.txt', llmsTxt);
}

console.log(`Generated ${important.length} pages + index`);
console.log(`Access: https://aptos-intelligence.vercel.app/reports/index.txt`);
