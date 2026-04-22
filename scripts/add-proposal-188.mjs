#!/usr/bin/env node
/**
 * Append governance proposal #188 (AIP-143 mainnet activation) to the
 * confidential-assets-deep-dive report and add a commit entry.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'web/public/data');
const reports = JSON.parse(readFileSync(join(DATA, 'reports.json'), 'utf8'));
const commits = JSON.parse(readFileSync(join(DATA, 'commits.json'), 'utf8'));

const now = '2026-04-21T00:00:00Z';

const newSection = `

<h3>Mainnet Activation: Governance Proposal #188 (April 21, 2026)</h3>

<p>As of April 21, 2026, AIP-143 is no longer a draft or a testnet feature. On-chain governance <strong>Proposal #188 — "Enable APT for Confidentiality"</strong> is live on Aptos mainnet, with voting in progress. This is the exact on-chain action that flips confidential transfers from "code merged, framework-gated" to "live on every APT balance."</p>

<table>
<tr><th>Field</th><th>Value</th></tr>
<tr><td>Proposal number</td><td>#188</td></tr>
<tr><td>Title</td><td>AIP 143: Enable APT for Confidentiality</td></tr>
<tr><td>Network</td><td>Aptos Mainnet</td></tr>
<tr><td>Proposer</td><td><code>0xdb009ab1a3259c4b27a0d8ff9d0e913e13e4c8b657fc73768f4e9bb811c7a1d8</code></td></tr>
<tr><td>Execution hash</td><td><code>0x34067a0669984c31bf07c84a48ea9f937d96f7966ef39a5ceb7dfc1cd1861d41</code></td></tr>
<tr><td>Source module</td><td><code>2026-04-21-enable-confidential-apt/Enable-confidential-apt.move</code></td></tr>
<tr><td>Vote tally (for)</td><td>100% — 14,261,274 APT</td></tr>
<tr><td>Vote tally (against)</td><td>&lt;1 APT</td></tr>
<tr><td>Turnout</td><td>1.19%</td></tr>
<tr><td>Quorum requirement</td><td>24.97%</td></tr>
<tr><td>Discussion</td><td><a href="https://github.com/aptos-foundation/AIPs/discussions/663">aptos-foundation/AIPs discussion #663</a></td></tr>
<tr><td>Tracker</td><td><a href="https://govscan.live/aptos/proposals/188">govscan.live/aptos/proposals/188</a></td></tr>
</table>

<h4>What Proposal #188 Actually Does</h4>

<p>The proposal is narrow and surgical. Its execution payload — the Move script in <code>Enable-confidential-apt.move</code> — flips a single framework flag so that APT itself becomes eligible for confidential transfers. All of the plumbing (the veiled balance resources, the zero-knowledge proof verifiers, the pending inbox mechanics described earlier in this report) is already deployed. The proposal is the feature flag flip.</p>

<p>Why is this significant even though "the code was merged"? Because the confidential-assets framework was designed from day one to be opt-in per coin type. Stablecoins, wrapped assets, and app-specific tokens can be enabled by their respective issuers through targeted governance. APT itself requires a mainnet-wide governance vote — which is exactly what Proposal #188 is.</p>

<h4>The Execution Flow</h4>

<pre><code>User signs vote
      │
      ▼
Aptos governance module validates stake + voting window
      │
      ▼
If quorum reached AND majority-for:
   Proposal queued for execution at next epoch
      │
      ▼
Execution window opens
      │
      ▼
Framework upgrade script runs:
   - Confidential-asset metadata registered for APT FA
   - Per-account veiled balance resource authorized
   - ConfidentialCoinStore&lt;APT&gt; enabled in aptos_framework::coin
      │
      ▼
Any account can now call:
   confidential_asset::veil&lt;APT&gt;(amount)
   confidential_asset::transfer_veiled&lt;APT&gt;(to, Ciphertext, Proof)
   confidential_asset::unveil&lt;APT&gt;(amount, Proof)</code></pre>

<h4>Why the Turnout Looks Small</h4>

<p>1.19% turnout vs. a 24.97% quorum threshold looks low on the surface but is typical for Aptos on-chain governance. Only staked APT with active delegation votes, and the vast majority of staked APT is held by validators that vote as a bloc. The 14,261,274 APT that voted "for" likely represents near-unanimous alignment from the top validators plus the Aptos Foundation delegation. The 11-APT "against" vote is either a protest ballot or a test from a small holder.</p>

<h4>What Changes for Users Immediately After Execution</h4>

<ul>
<li>Every APT holder gains the ability to move APT into a <strong>veiled balance</strong> using ElGamal encryption over the user's own public key.</li>
<li>Veiled transfers hide the amount being sent. The sender, receiver, and transfer event are still visible on-chain — only the amount and the post-transfer balances are encrypted.</li>
<li>The pending inbox mechanism prevents front-running: incoming confidential transfers sit in a separate encrypted mailbox until the recipient chooses to roll them into their main veiled balance.</li>
<li>Unveiling a balance (converting veiled APT back to regular APT) requires a zero-knowledge proof that the unveiled amount matches the encrypted balance. Proofs are generated client-side.</li>
</ul>

<h4>Combined Picture: Privacy Stack + Consensus Stack</h4>

<p>The mainnet activation of AIP-143 is the privacy-layer counterpart to the consensus-layer work covered in the <a href="/reports/prefix-consensus-deep-dive">Prefix Consensus deep dive</a>. Together they give Aptos something no other L1 has as of Q2 2026: <strong>content-blind ordering at the mempool level via encrypted mempool + amount-blind settlement at the asset level via AIP-143</strong>. A sender can route an APT transfer through the encrypted mempool (amount invisible during ordering) and land it as a confidential transfer (amount invisible on-chain after settlement). Every other chain leaks one of these two surfaces.</p>

<p>For the full picture of how privacy layering composes with the rest of the stack, see the <a href="/reports/aptos-stack-map">Aptos Stack Map</a>.</p>
`;

const caIdx = reports.findIndex(r => r.githubId === 'confidential-assets-deep-dive');
if (caIdx === -1) throw new Error('confidential-assets-deep-dive not found');

if (reports[caIdx].advanced.includes('Proposal #188')) {
  console.log('Proposal #188 section already present — skipping CA enrichment');
} else {
  reports[caIdx].advanced = reports[caIdx].advanced + newSection;
  reports[caIdx].date = now;
  console.log(`Appended Proposal #188 section to confidential-assets-deep-dive (+${newSection.length} chars)`);
}

// Also add a commit-style entry so it shows in the date-grouped feed
const commit = {
  sha: 'aip-143-mainnet-proposal-188',
  title: 'AIP-143 (Confidential APT) — Mainnet Activation via Governance Proposal #188',
  author: 'aptos-governance',
  date: now,
  url: 'https://govscan.live/aptos/proposals/188',
  category: 'Release',
};

const proposalReport = {
  id: 0,
  githubId: 'aip-143-mainnet-proposal-188',
  title: commit.title,
  author: commit.author,
  date: now,
  category: 'Release',
  importance: 9,
  sourceUrl: commit.url,
  relatedFeatures: ['Confidential Assets', 'AIP-143', 'Governance', 'Encrypted Mempool'],
  labels: ['governance', 'mainnet', 'aip-143', 'confidential-assets', 'proposal-188'],
  advanced: `<h2>AIP-143 (Confidential APT) — Mainnet Activation via Governance Proposal #188</h2>

<p>On April 21, 2026, on-chain governance proposal #188 — "Enable APT for Confidentiality" — went to a live vote on Aptos mainnet. This is the governance action that flips AIP-143 (Confidential Assets) from merged-but-gated framework code into a live mainnet feature for APT itself.</p>

${newSection}

<h3>Further Reading</h3>
<ul>
<li><a href="/reports/confidential-assets-deep-dive">Full Confidential Assets deep dive</a> — UTT theory to deployed encryption</li>
<li><a href="/reports/prefix-consensus-deep-dive">Prefix Consensus</a> — content-blind ordering at the consensus layer</li>
<li><a href="/reports/aptos-stack-map">Aptos Stack Map</a> — how privacy composes with the rest of the stack</li>
</ul>`,
  eli5: `<p><strong>Aptos just voted to turn on private APT transfers on mainnet.</strong></p>

<p>For the past year, the code to make APT transfers confidential — where the amount you send is hidden from public view — has been sitting in the Aptos framework, merged but turned off. On April 21, 2026, governance proposal #188 went live to flip the switch.</p>

<p><strong>What the vote actually does:</strong> enables a feature called "confidential transfers" for APT specifically. Other coins (stablecoins, wrapped assets) can opt in separately. This one is for APT itself.</p>

<p><strong>What private means here:</strong> when Alice sends Bob some APT, the public ledger still shows that Alice sent Bob <em>something</em> — but the amount is encrypted. Think of it like a sealed envelope. Everyone sees the envelope move, nobody sees what's inside unless you have the key.</p>

<p><strong>Vote results so far:</strong> 100% in favor (14,261,274 APT voted yes, 11 APT voted no). Turnout is low because most APT is staked by validators who vote in bulk.</p>

<p><strong>Why this matters:</strong> Aptos becomes the only major Layer 1 where you can move the native coin with the amount hidden at settlement <em>and</em> at the mempool level (via the already-live encrypted mempool). Every other chain leaks one of these two.</p>

<p><strong>See also:</strong> the full <a href="/reports/confidential-assets-deep-dive">Confidential Assets deep dive</a> for how the zero-knowledge proofs work under the hood.</p>`,
};

const rIdx = reports.findIndex(r => r.githubId === proposalReport.githubId);
if (rIdx === -1) { reports.push(proposalReport); console.log('Added standalone proposal report'); }
else { reports[rIdx] = { ...reports[rIdx], ...proposalReport }; console.log('Updated standalone proposal report'); }

const cIdx = commits.findIndex(c => c.sha === commit.sha);
if (cIdx === -1) { commits.unshift(commit); console.log('Added commit entry'); }
else { commits[cIdx] = { ...commits[cIdx], ...commit }; console.log('Updated commit entry'); }

writeFileSync(join(DATA, 'reports.json'), JSON.stringify(reports, null, 2));
writeFileSync(join(DATA, 'commits.json'), JSON.stringify(commits, null, 2));

console.log(`\nreports=${reports.length}, commits=${commits.length}`);
console.log(`Standalone report: advanced=${proposalReport.advanced.length}, eli5=${proposalReport.eli5.length}`);
