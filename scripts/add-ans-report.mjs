import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));

const advanced = `<h2>Aptos Names Service (ANS) — Architecture &amp; History</h2>

<h3>What Is ANS?</h3>
<p>The Aptos Names Service is the official domain name system for Aptos — like ENS for Ethereum. It maps human-readable <code>.apt</code> names (e.g. <code>alice.apt</code>) to on-chain addresses, and supports reverse lookups (address to primary name), subdomains (<code>payments.alice.apt</code>), and NFT-based ownership.</p>

<h3>Architecture</h3>
<p>ANS lives in a single repo: <a href="https://github.com/aptos-labs/aptos-names-contracts" target="_blank">aptos-labs/aptos-names-contracts</a> (65 stars, 8 contributors).</p>
<p>The system has <strong>three layers</strong>:</p>
<ul>
<li><strong>Router</strong> (<code>router::router</code>) — the canonical entry point. Routes all operations to v1 or v2 based on mode. Currently in <code>MODE_V1_AND_V2</code> on mainnet.</li>
<li><strong>ANS v1</strong> (<code>aptos_names::domains</code>) — Original implementation using Token v1. Table-based registry.</li>
<li><strong>ANS v2</strong> (<code>aptos_names_v2_1::v2_1_domains</code>) — Complete rewrite using Token Objects. Deterministic addresses, linear pricing, free subdomains, renewal support.</li>
</ul>

<h3>Key Move Types</h3>
<pre><code>// V1
struct NameRecordKeyV1 { subdomain_name: Option&lt;String&gt;, domain_name: String }
struct NameRecordV1 { property_version: u64, expiration_time_sec: u64, target_address: Option&lt;address&gt; }

// V2
struct NameRecord { domain_name, expiration_time_sec, target_address, transfer_ref }
struct SubdomainExt { subdomain_name, subdomain_expiration_policy }
struct ReverseRecord { token_addr: Option&lt;address&gt; }</code></pre>

<h3>Pricing Comparison</h3>
<table>
<tr><th>Name Length</th><th>V1 Price/yr</th><th>V2 Price/yr</th></tr>
<tr><td>3 chars</td><td>80 APT</td><td>20 APT</td></tr>
<tr><td>4 chars</td><td>40 APT</td><td>10 APT</td></tr>
<tr><td>5 chars</td><td>20 APT</td><td>5 APT</td></tr>
<tr><td>6+ chars</td><td>5 APT</td><td>1 APT</td></tr>
<tr><td>Subdomain</td><td>0.2 APT</td><td>Free</td></tr>
</table>

<h3>V1 to V2 Migration</h3>
<p>The router handles migration via <code>migrate_name()</code>. V1 tokens are transferred to the router signer (effectively burned), then re-created as v2 Token Objects. Domains expired before 2024-03-07 get 1 free year. Primary names and target addresses are preserved.</p>

<h3>Integration Points</h3>
<ul>
<li><strong>TypeScript SDK</strong>: <code>ANS</code> class with 10+ methods</li>
<li><strong>Indexer</strong>: <code>ans_processor.rs</code> writes to 8 PostgreSQL tables</li>
<li><strong>On-chain</strong>: Any Move contract can call <code>router::get_target_addr()</code></li>
<li><strong>Wallets</strong>: Display primary names via <code>aptos-wallet-adapter</code></li>
<li><strong>Web</strong>: <a href="https://aptosnames.com" target="_blank">aptosnames.com</a></li>
</ul>

<h3>Contributors</h3>
<table>
<tr><th>Developer</th><th>Commits</th><th>Role</th></tr>
<tr><td>0xChucky</td><td>43</td><td>Primary author, original creator</td></tr>
<tr><td>BriungRi</td><td>7</td><td>Core developer</td></tr>
<tr><td>angieyth</td><td>6</td><td>Core developer (v2, migration)</td></tr>
<tr><td>gregnazario</td><td>5</td><td>Core developer</td></tr>
<tr><td>0x-j</td><td>5</td><td>Core developer (v1 updates)</td></tr>
</table>

<h3>Timeline</h3>
<ul>
<li><strong>Nov 2022</strong>: Repository initialized, V1 development begins</li>
<li><strong>Dec 2022</strong>: V1 launches with registration, primary names, events</li>
<li><strong>Oct 2023</strong>: ANS V2 launches — complete rewrite on Token Objects</li>
<li><strong>2024</strong>: Security hardening, primary name ownership verification</li>
<li><strong>Jan 2025</strong>: Move-2 syntax migration</li>
</ul>

<h3>Current Status</h3>
<p><strong>Active</strong> — V2 deployed on mainnet with router in dual mode. 5 open issues, bug bounty active via HackenProof.</p>`;

const eli5 = `<p><strong>What is it?</strong> Aptos Names Service is like a phone book for the Aptos blockchain. Instead of remembering a long string of random numbers and letters (like <code>0x1a2b3c...</code>), you can just use a simple name like <code>alice.apt</code>.</p>

<p><strong>How does it work?</strong> You pay a small fee (as low as 1 APT per year for most names) to "rent" a name. That name points to your blockchain address. You can also create subnames — like <code>payments.alice.apt</code> — for free!</p>

<p><strong>The big upgrade:</strong> It started as Version 1 in late 2022, then got a complete rewrite as Version 2 in October 2023. V2 is way better — names are cheaper (prices dropped 75%), subdomains are free, you can renew your name, and the tech is more modern.</p>

<p><strong>Who built it?</strong> Mostly one developer called 0xChucky (43 of the 60+ commits!), with help from 7 other Aptos Labs engineers.</p>

<p><strong>Why does it matter?</strong> Every blockchain needs a naming system. Without it, sending crypto means copying and pasting long addresses — scary and error-prone. With ANS, you just type a name. Wallets, apps, and smart contracts can all use these names.</p>`;

reports.push({
  id: 99999,
  githubId: 'ans-deep-dive',
  title: 'Aptos Names Service (ANS) — Complete Deep Dive',
  author: '0xChucky',
  date: '2026-04-08T00:00:00Z',
  category: 'Feature Progress',
  importance: 9,
  sourceUrl: 'https://github.com/aptos-labs/aptos-names-contracts',
  relatedFeatures: ['Keyless Accounts', 'Aptos Framework', 'Token Objects'],
  labels: ['ans', 'naming', 'infrastructure'],
  advanced,
  eli5,
});

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Added ANS deep dive. Total reports:', reports.length);
