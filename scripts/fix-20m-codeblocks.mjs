import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));
const idx = reports.findIndex(r => r.githubId === 'aggregator-nft-deep-dive');
if (idx < 0) { console.log('Not found'); process.exit(1); }

let html = reports[idx].advanced;

// Fix broken code blocks: ``<code>move\n<p>line1</p>\n<p>line2</p>...```
// These are triple-backtick blocks that the converter mangled

// Pattern: "<p>``<code>LANG</p>" followed by "<p>LINE</p>" lines until "</code>``</p>" or "```"
// Replace with proper <pre><code>...</code></pre>

// First, find all the broken patterns and fix them
// The broken pattern is: <p>``<code>LANG</p> or <p>```LANG</p> followed by <p>lines</p> until <p>```</p> or ``</code>

// Strategy: work with the raw markdown source instead of trying to fix broken HTML
const md = readFileSync('knowledge-base/docs/20m-nft-analysis.md', 'utf-8');

// Better markdown to HTML converter that handles code blocks properly
function convertMd(text) {
  const lines = text.split('\n');
  const output = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block start/end
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const code = codeLines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        output.push(`<pre><code>${code}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table handling
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      // Skip separator rows
      if (cells.every(c => /^[-:]+$/.test(c))) continue;

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      // End table
      let tableHtml = '<table>';
      tableRows.forEach((row, ri) => {
        const tag = ri === 0 ? 'th' : 'td';
        tableHtml += '<tr>' + row.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
      });
      tableHtml += '</table>';
      output.push(tableHtml);
      inTable = false;
      tableRows = [];
    }

    // Headers
    if (line.startsWith('### ')) { output.push(`<h3>${line.slice(4)}</h3>`); continue; }
    if (line.startsWith('## ')) { output.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (line.startsWith('# ')) { output.push(`<h2>${line.slice(2)}</h2>`); continue; }

    // Horizontal rule
    if (line.trim() === '---') { output.push('<hr/>'); continue; }

    // List items
    if (line.match(/^- /)) {
      output.push(`<li>${processInline(line.slice(2))}</li>`);
      continue;
    }
    if (line.match(/^\d+\. /)) {
      output.push(`<li>${processInline(line.replace(/^\d+\. /, ''))}</li>`);
      continue;
    }

    // Empty lines
    if (!line.trim()) { continue; }

    // Frontmatter-style lines (skip)
    if (line.startsWith('**Date**:') || line.startsWith('**Scope**:') || line.startsWith('**Target**:')) continue;

    // Regular paragraph
    output.push(`<p>${processInline(line)}</p>`);
  }

  // Close any remaining table
  if (inTable && tableRows.length) {
    let tableHtml = '<table>';
    tableRows.forEach((row, ri) => {
      const tag = ri === 0 ? 'th' : 'td';
      tableHtml += '<tr>' + row.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    });
    tableHtml += '</table>';
    output.push(tableHtml);
  }

  // Wrap consecutive <li> in <ul>
  let result = output.join('\n');
  result = result.replace(/((?:<li>.*?<\/li>\n?)+)/g, '<ul>$1</ul>');

  return result;
}

function processInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// Get the part of the report after the "---" separator (the 20M analysis)
const existingEnd = html.indexOf('\n\n<hr/>\n\n');
const originalPart = existingEnd > 0 ? html.slice(0, existingEnd) : html;

// Re-convert the 20M analysis from markdown
const newAnalysis = convertMd(md);

// Combine
reports[idx].advanced = originalPart + '\n\n<hr/>\n\n' + newAnalysis;

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Fixed code blocks. New length:', reports[idx].advanced.length);

// Verify
const fixed = reports[idx].advanced;
const preCount = (fixed.match(/<pre><code>/g) || []).length;
const brokenCount = (fixed.match(/``<code>/g) || []).length;
console.log('Proper <pre><code> blocks:', preCount);
console.log('Broken code blocks:', brokenCount);
