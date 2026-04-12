import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));
const idx = reports.findIndex(r => r.githubId === 'confidential-assets-deep-dive');
if (idx < 0) { console.log('Not found'); process.exit(1); }

const appendAdvanced = readFileSync('knowledge-base/docs/ca-append.html', 'utf-8');

reports[idx].advanced += '\n\n<hr/>\n\n' + appendAdvanced;

reports[idx].eli5 += `
<p><strong>The Bigger Picture — Three Zones of Privacy</strong></p>
<p>Confidential Assets is just Level 1 of three levels:</p>
<ul>
<li><strong>Level 0 (Public):</strong> Everything visible — how most blockchains work</li>
<li><strong>Level 1 (Confidential Assets):</strong> Balances and amounts hidden, but people see WHO sent to whom — like a bank statement with dollar amounts blacked out but names visible</li>
<li><strong>Level 2 (UTT — Invisible Assets):</strong> EVERYTHING hidden — amounts, sender, receiver. Like digital cash. Nobody knows who paid whom or how much. The Bank of Israel tested this because it has a built-in monthly spending cap enforced by math, not policy</li>
</ul>
<p>There is also <strong>ACE</strong> — encrypts any data and lets a smart contract decide who can decrypt it. Like a lock controlled by code, not a person. Even if someone breaks into the server, they get encrypted gibberish.</p>
<p>All three designed by <strong>Alin Tomescu</strong> — Head of Cryptography at Aptos Labs. PhD MIT. UTT co-authors include Ittai Abraham (Aptos co-founder, now a16z) and Benny Pinkas (top 5 global MPC researcher).</p>`;

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Updated. Advanced:', reports[idx].advanced.length, 'chars');
