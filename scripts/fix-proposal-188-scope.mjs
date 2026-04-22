#!/usr/bin/env node
/**
 * Correct the AIP-143 scope description. Earlier draft implied
 * stablecoin/wrapped-asset issuers could self-enable confidential
 * transfers. The actual AIP-143 text restricts the feature to APT
 * only at the framework level — other assets cannot opt in.
 * Future expansion is governance-gated per the AIP.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'web/public/data');
const reports = JSON.parse(readFileSync(join(DATA, 'reports.json'), 'utf8'));

const WRONG = `<p>Why is this significant even though "the code was merged"? Because the confidential-assets framework was designed from day one to be opt-in per coin type. Stablecoins, wrapped assets, and app-specific tokens can be enabled by their respective issuers through targeted governance. APT itself requires a mainnet-wide governance vote — which is exactly what Proposal #188 is.</p>`;

const RIGHT = `<p>Why is this significant even though "the code was merged"? Because AIP-143 is deliberately scoped to APT only at launch — and the restriction is enforced <em>at the framework level</em>, not at the issuer level. Quoting the AIP directly:</p>

<blockquote>"At launch, confidential asset functionality is restricted to APT only and enforced at the framework level. Other assets cannot opt into the confidential asset system."</blockquote>

<p>This is explicit: stablecoin issuers, wrapped-asset issuers, and app-token issuers cannot self-enable confidential transfers for their tokens. The framework blocks them. The AIP describes this as "a product and ecosystem decision rather than a technical limitation" — meaning the plumbing exists, but the policy gate is closed for everything except APT.</p>

<p>Expansion beyond APT is future governance work. The AIP states: <em>"Governance may consider enabling confidential functionality for additional assets in the future, subject to security review, economic alignment, and policy considerations."</em> So each future asset (or a blanket policy change) is itself a governance decision — not an issuer opt-in. Proposal #188 is the APT-specific activation; any USDC, USDT, or app-token equivalent would require its own on-chain vote.</p>`;

const caIdx = reports.findIndex(r => r.githubId === 'confidential-assets-deep-dive');
if (caIdx === -1) throw new Error('CA report not found');

let changed = 0;
if (reports[caIdx].advanced.includes(WRONG)) {
  reports[caIdx].advanced = reports[caIdx].advanced.replace(WRONG, RIGHT);
  changed++;
  console.log('Fixed confidential-assets-deep-dive');
}

// Also fix the standalone proposal report which embeds the same section
const propIdx = reports.findIndex(r => r.githubId === 'aip-143-mainnet-proposal-188');
if (propIdx !== -1 && reports[propIdx].advanced.includes(WRONG)) {
  reports[propIdx].advanced = reports[propIdx].advanced.replace(WRONG, RIGHT);
  changed++;
  console.log('Fixed aip-143-mainnet-proposal-188');
}

if (changed === 0) console.log('No occurrences found — nothing to fix');

writeFileSync(join(DATA, 'reports.json'), JSON.stringify(reports, null, 2));
console.log(`Done — ${changed} report(s) updated`);
