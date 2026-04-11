import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));
const md = readFileSync('knowledge-base/docs/20m-nft-analysis.md', 'utf-8');

// Convert markdown to basic HTML
function mdToHtml(text) {
  let html = text
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h2>$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Remove frontmatter-style lines
    .replace(/^\*\*Date\*\*:.*$/gm, '')
    .replace(/^\*\*Scope\*\*:.*$/gm, '')
    .replace(/^\*\*Target\*\*:.*$/gm, '');

  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => {
    return '<pre><code>' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim() + '</code></pre>';
  });

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim()).map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return ''; // separator row
    return '<tr>' + cells.map(c => {
      // Detect header row (first table row)
      return '<td>' + c + '</td>';
    }).join('') + '</tr>';
  });
  // Wrap consecutive <tr> rows in <table>
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>');
  // Fix first row to use <th> in each table
  html = html.replace(/<table><tr>(.*?)<\/tr>/g, (_, firstRow) => {
    const ths = firstRow.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
    return '<table><tr>' + ths + '</tr>';
  });

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
  html = html.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
    return '<ol>' + match.replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>') + '</ol>';
  });

  // Paragraphs - wrap remaining text lines
  const lines = html.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('<h') || line.startsWith('<table') || line.startsWith('<tr') ||
        line.startsWith('<ul') || line.startsWith('<ol') || line.startsWith('<li') ||
        line.startsWith('<pre') || line.startsWith('<hr') || line.startsWith('</')) {
      result.push(line);
    } else {
      result.push('<p>' + line + '</p>');
    }
  }

  return result.join('\n');
}

const analysisHtml = mdToHtml(md);

// Find the aggregator report
const idx = reports.findIndex(r => r.githubId === 'aggregator-nft-deep-dive');
if (idx < 0) {
  console.log('Aggregator report not found!');
  process.exit(1);
}

// Append the 20M analysis to the existing advanced content
reports[idx].advanced += '\n\n<hr/>\n\n' + analysisHtml;

// Also update the ELI5 with the key numbers
reports[idx].eli5 += `

<p><strong>So How Fast Can We Mint 20 Million NFTs?</strong></p>
<p>Here's the breakdown at every stage of Aptos's evolution:</p>
<ul>
<li><strong>Today (April 2026)</strong>: ~17-25 minutes, costing 2,200 APT (~$22,000 at $10/APT)</li>
<li><strong>With Full Raptr + Block-STM v2 + Zaptos</strong>: ~3.3 minutes, costing ~1,100-1,650 APT</li>
<li><strong>With Shardines (conservative)</strong>: ~40 seconds, costing ~660-1,100 APT</li>
<li><strong>Theoretical maximum (1M TPS)</strong>: ~20 seconds, costing ~440-880 APT</li>
</ul>
<p>For comparison, minting 20 million NFTs on Ethereum would take <em>days</em> and cost millions of dollars in gas fees. On Aptos with full upgrades, it takes less time than brushing your teeth.</p>
<p>The key trick: you need ~100-1,000 separate sender accounts submitting transactions in parallel, because even though the NFT counter doesn't bottleneck anymore (thanks to aggregators), each sender's account still has a sequence number that can only increment one at a time.</p>`;

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Updated aggregator report with 20M analysis');
console.log('Advanced length:', reports[idx].advanced.length, 'chars');
console.log('ELI5 length:', reports[idx].eli5.length, 'chars');
