import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));
const idx = reports.findIndex(r => r.githubId === 'aggregator-nft-deep-dive');

if (idx < 0) { console.log('Not found!'); process.exit(1); }

// Replace the ELI5 ending with corrected numbers
const oldEli5End = reports[idx].eli5.indexOf('<p><strong>So How Fast Can We Mint 20 Million NFTs?');
if (oldEli5End > 0) {
  reports[idx].eli5 = reports[idx].eli5.slice(0, oldEli5End);
}

reports[idx].eli5 += `
<p><strong>So How Fast and Cheap Can We Mint 20 Million NFTs?</strong></p>

<p>We tracked down the exact contract from the 1M NFT demo — it's called <code>ambassador::ambassador</code>, and it uses <strong>195 gas units per mint</strong>. That's the real number from the actual code in aptos-core.</p>

<table>
<tr><th>Scenario</th><th>Time</th><th>Cost (APT)</th><th>Cost (USD at $10)</th></tr>
<tr><td>Today (20K TPS, demo contract)</td><td>16.7 min</td><td>3,900 APT</td><td>$39,000</td></tr>
<tr><td>Today (20K TPS, minimal NFT)</td><td>16.7 min</td><td>2,000 APT</td><td>$20,000</td></tr>
<tr><td>Full Raptr + Block-STM v2</td><td>3.3 min</td><td>~2,000-3,900 APT</td><td>$20-39K</td></tr>
<tr><td>With Shardines</td><td>40 sec</td><td>~2,000-3,900 APT</td><td>$20-39K</td></tr>
<tr><td>Theoretical max (1M TPS)</td><td>20 sec</td><td>~2,000-3,900 APT</td><td>$20-39K</td></tr>
</table>

<p><strong>For comparison:</strong> Minting 20 million NFTs on Ethereum would cost roughly $400 million in gas and take 15+ days. On Aptos it costs $20-39K and takes 17 minutes — dropping to 20 seconds with full upgrades.</p>

<p><strong>The demo contract wasn't even minimal</strong> — it included property maps, rank/level tracking, burn refs, and soulbound restrictions. A stripped-down Token Object costs only ~100 gas units (vs 195 for ambassador). So the floor cost is about $20K for 20M NFTs.</p>

<p><strong>The key trick:</strong> You need 100-1,000 separate sender accounts submitting in parallel, because even though the NFT supply counter doesn't bottleneck (aggregators), each sender's account sequence number still increments sequentially.</p>`;

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Updated ELI5 with corrected costs. Length:', reports[idx].eli5.length);
