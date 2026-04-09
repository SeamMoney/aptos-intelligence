import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));

const advanced = `<h2>Aptos Names Service — V1 vs V2 Deep Dive</h2>

<p>ANS is Aptos's domain name system — <code>alice.apt</code> instead of <code>0x1a2b3c...</code>. It went through a complete architectural rewrite from V1 to V2 in October 2023. This page explains exactly what changed, why, and what it unlocks.</p>

<h3>Why the Rewrite? The Token v1 Problem</h3>

<p>ANS V1 was built on <strong>Aptos Token v1</strong>, the original NFT standard. Token v1 has a fundamental design problem: tokens don't have their own on-chain addresses. They exist inside a <code>TokenStore</code> resource on the owner's account, indexed by <code>(creator, collection, name, property_version)</code>.</p>

<p>This means:</p>
<ul>
<li><strong>No deterministic addresses</strong> — you can't predict where a name's data lives on-chain. To look up <code>alice.apt</code>, you need to know who owns it first, then look inside their TokenStore.</li>
<li><strong>No direct resource storage</strong> — you can't attach custom data (like resolution records) directly to the token. V1 used separate <code>Table</code>-based registries to store name records.</li>
<li><strong>Property version complexity</strong> — every mutation increments a property version, creating a new "instance" of the token. This made tracking ownership messy.</li>
<li><strong>No composability</strong> — other contracts can't easily reference or interact with a specific name token because it has no stable address.</li>
</ul>

<h3>The V2 Solution: Token Objects</h3>

<p><strong>Token Objects</strong> (the <code>aptos_token_objects</code> framework) solve all of these problems. Each token is an <strong>Object</strong> — a first-class on-chain entity with its own address. This is the key insight:</p>

<pre><code>// V1: Name data lives in a separate Table, disconnected from the token
struct NameRegistryV1 {
    registry: Table&lt;NameRecordKeyV1, NameRecordV1&gt;
}

// V2: Name data lives ON the token object itself
// The NameRecord struct is stored at the token's address
struct NameRecord has key {
    domain_name: String,
    expiration_time_sec: u64,
    target_address: Option&lt;address&gt;,
    transfer_ref: Option&lt;TransferRef&gt;,
    registration_time_sec: u64,
    extend_ref: ExtendRef,
}</code></pre>

<p>With Objects, each <code>.apt</code> name IS an on-chain object at a deterministic address. The name's resolution data, expiration, and ownership are all stored directly on that object.</p>

<h3>What Token Objects Unlock</h3>

<table>
<tr><th>Capability</th><th>V1 (Token v1)</th><th>V2 (Token Objects)</th></tr>
<tr><td><strong>Deterministic addresses</strong></td><td>No — must search TokenStore</td><td>Yes — <code>create_named_token()</code> gives predictable address from seed</td></tr>
<tr><td><strong>Direct data storage</strong></td><td>No — uses separate Table registries</td><td>Yes — NameRecord stored on the object itself</td></tr>
<tr><td><strong>On-chain composability</strong></td><td>Limited — other contracts can't easily reference names</td><td>Full — any contract can read/verify name data at a known address</td></tr>
<tr><td><strong>Domain renewal</strong></td><td>Not possible — no way to extend expiration without re-minting</td><td>Built-in — <code>ExtendRef</code> allows modifying expiration in-place</td></tr>
<tr><td><strong>Subdomain control</strong></td><td>Basic — fixed expiration, always transferable</td><td>Rich — expiration policies, transferability toggle, domain owner controls</td></tr>
<tr><td><strong>Transfer control</strong></td><td>Always transferable</td><td>Domain owner can lock/unlock subdomain transfers via <code>TransferRef</code></td></tr>
</table>

<h3>The ExtendRef — Why Renewal Works in V2</h3>

<p>One of the most important Object capabilities is the <code>ExtendRef</code>. When an ANS name object is created, the contract saves an <code>ExtendRef</code> inside the <code>NameRecord</code>. This ref allows the contract to later modify the object's resources — specifically, to update <code>expiration_time_sec</code>.</p>

<pre><code>// V2 renewal — modify the object in-place
public fun renew_domain(user: &amp;signer, domain_name: String, renewal_duration_secs: u64) {
    let name_record = borrow_global_mut&lt;NameRecord&gt;(token_addr);
    name_record.expiration_time_sec = name_record.expiration_time_sec + renewal_duration_secs;
    // The ExtendRef proves the contract has authority to do this
}</code></pre>

<p>In V1, this was impossible. To "renew" a name, you'd have to burn the old token and mint a new one — losing the property version history and breaking any references.</p>

<h3>Subdomain Expiration Policies — A V2-Only Feature</h3>

<p>V2 introduces the <code>SubdomainExt</code> struct with an <code>subdomain_expiration_policy</code> field:</p>
<ul>
<li><code>MANUAL_SET_EXPIRATION (0)</code> — the subdomain has its own expiration, set by the domain owner. It can outlive or predate the parent domain.</li>
<li><code>LOOKUP_DOMAIN_EXPIRATION (1)</code> — the subdomain automatically expires when the parent domain expires. No manual management needed.</li>
</ul>

<p>This is critical for organizations. A company owning <code>company.apt</code> can create <code>team.company.apt</code> with auto-follow policy, so when they renew the parent domain, all subdomains automatically stay valid.</p>

<h3>The Router Architecture</h3>

<p>Since V1 and V2 coexist on mainnet, the <strong>Router</strong> is the unified entry point. Currently in <code>MODE_V1_AND_V2</code>:</p>

<pre><code>// Router logic (simplified)
public entry fun register_domain(user: &amp;signer, domain_name: String, years: u64) {
    if (mode == MODE_V1_AND_V2) {
        // New registrations always go to V2
        v2_1_domains::register_domain(router_signer, user, domain_name, years * SECS_PER_YEAR);
    } else {
        domains::register_domain(user, domain_name, years);
    }
}

// Resolution checks V2 first, falls back to V1
public fun get_target_addr(domain: String, subdomain: Option&lt;String&gt;): Option&lt;address&gt; {
    let v2_result = v2_1_domains::get_target_address(domain, subdomain);
    if (option::is_some(&amp;v2_result)) return v2_result;
    // Fall back to V1
    domains::get_name_address(subdomain, domain)
}</code></pre>

<h3>Migration: V1 → V2</h3>

<p>Users migrate via <code>router::migrate_name()</code>:</p>
<ol>
<li>V1 token is transferred to the router's resource account (effectively burned)</li>
<li>A new V2 Token Object is created with the same name</li>
<li>Target address and primary name settings are copied over</li>
<li>Domains expired before March 7, 2024 get 1 free year of renewal</li>
<li>Domain must be migrated before its subdomains (parent-first)</li>
</ol>

<h3>Pricing: 75% Cheaper in V2</h3>

<table>
<tr><th>Name Length</th><th>V1 Annual</th><th>V2 Annual</th><th>Reduction</th></tr>
<tr><td>3 chars (e.g. <code>max.apt</code>)</td><td>80 APT</td><td>20 APT</td><td>-75%</td></tr>
<tr><td>4 chars (e.g. <code>alex.apt</code>)</td><td>40 APT</td><td>10 APT</td><td>-75%</td></tr>
<tr><td>5 chars (e.g. <code>alice.apt</code>)</td><td>20 APT</td><td>5 APT</td><td>-75%</td></tr>
<tr><td>6+ chars (e.g. <code>satoshi.apt</code>)</td><td>5 APT</td><td>1 APT</td><td>-80%</td></tr>
<tr><td>Subdomains</td><td>0.2 APT</td><td><strong>Free</strong></td><td>-100%</td></tr>
</table>

<p>V2 also switched from <strong>exponential</strong> to <strong>linear</strong> multi-year pricing. In V1, year 2 cost 110% of year 1 (compounding). In V2, 2 years = 2x the annual price. Simple.</p>

<h3>Integration Points</h3>

<ul>
<li><strong>TypeScript SDK</strong> (<code>src/api/ans.ts</code>): Full <code>ANS</code> class — <code>getTargetAddress()</code>, <code>getPrimaryName()</code>, <code>registerName()</code>, <code>renewDomain()</code>, plus batch queries for all names on an account</li>
<li><strong>Indexer</strong> (<code>ans_processor.rs</code>): Writes to 8 PostgreSQL tables tracking all v1+v2 lookups, registrations, and primary names in real-time</li>
<li><strong>On-chain resolution</strong>: Any Move contract calls <code>router::get_target_addr(domain, subdomain)</code> — one line to resolve a name</li>
<li><strong>Wallets</strong>: <code>aptos-wallet-adapter</code> displays primary names instead of raw addresses everywhere</li>
<li><strong>Web</strong>: <a href="https://aptosnames.com" target="_blank">aptosnames.com</a> for registration and management</li>
</ul>

<h3>Who Built It</h3>

<table>
<tr><th>Developer</th><th>Commits</th><th>Period</th><th>Contribution</th></tr>
<tr><td><strong>0xChucky (Charles)</strong></td><td>43</td><td>Nov 2022 – Feb 2023</td><td>Built V1 from scratch — registration, primary names, reverse lookup, events. Left Aptos Labs ~Feb 2023.</td></tr>
<tr><td><strong>BriungRi (Brian Li)</strong></td><td>7 (contracts) + 131 (org-wide)</td><td>May 2023 – present</td><td>Took over ANS, built V2, router, migration, bulk operations. Also works on token-minter, explorer, account abstraction.</td></tr>
<tr><td><strong>angieyth</strong></td><td>6</td><td>2023</td><td>V2 development, migration scripts</td></tr>
<tr><td><strong>gregnazario</strong></td><td>5</td><td>2022-2023</td><td>Core infrastructure</td></tr>
<tr><td><strong>0x-j</strong></td><td>5</td><td>2023</td><td>V1 updates for V2 compatibility</td></tr>
</table>

<p><strong>Key finding:</strong> 0xChucky and BriungRi are confirmed different people (different emails: <code>charles@aptoslabs.com</code> vs <code>brnli7@gmail.com</code>). Classic employee handoff — Charles built V1, left, Brian took over and built V2.</p>

<h3>Current Status (April 2026)</h3>

<ul>
<li><strong>V2 on mainnet</strong> with router in <code>MODE_V1_AND_V2</code></li>
<li><strong>5 open issues</strong>, <strong>2 open PRs</strong> (Move 2 syntax migration)</li>
<li><strong>Bug bounty active</strong> via HackenProof</li>
<li><strong>Last push</strong>: March 2026</li>
<li>Stable, production infrastructure — not under heavy development anymore</li>
</ul>`;

const eli5 = `<p><strong>What is Aptos Names Service?</strong></p>
<p>It's a phone book for the Aptos blockchain. Instead of telling someone to send money to <code>0x7a8f3e2d1b...</code> (a scary 64-character code), you just say "send it to <code>alice.apt</code>." Way easier, right?</p>

<p><strong>What happened with V1 vs V2?</strong></p>
<p>Think of it like phone books. V1 was like a paper phone book — your name was listed, but it was just an entry in a big shared list. You couldn't really DO much with your entry. Want to renew? Tear out the page and paste in a new one. Want someone to look you up? They had to flip through the whole book.</p>

<p>V2 is like getting your own personal phone card — a physical thing you OWN. Your name, your number, your info is all on YOUR card. You can update your card (renewal), lend it to someone (transfer), or create mini-cards for your family (subdomains). And anyone can find you instantly because every card has a unique serial number (deterministic address).</p>

<p><strong>Why did they switch to "Objects"?</strong></p>
<p>In the old system (Token v1), your name was just data in a shared spreadsheet. In the new system (Token Objects), your name is its own thing on the blockchain — like a tiny app with its own address. This means:</p>
<ul>
<li>Other apps can easily find and verify your name (composability)</li>
<li>You can renew without re-creating your name (ExtendRef magic)</li>
<li>Domain owners have real control over subdomains (lock/unlock transfers, set expiration policies)</li>
<li>Everything is way cheaper — prices dropped 75% and subdomains became free</li>
</ul>

<p><strong>Who built it?</strong></p>
<p>A developer named Charles (0xChucky) built the original V1 in late 2022. He left Aptos Labs around February 2023. Brian Li (BriungRi) then took over and built the much better V2 from scratch in October 2023. Brian is still actively maintaining it and works on many other Aptos projects too.</p>

<p><strong>What you learned:</strong> You now understand why Aptos rebuilt their naming system — the old token standard couldn't support renewal, subdomain policies, or easy composability. The new Object-based design gives each name its own on-chain identity, making the entire system more powerful and 75% cheaper.</p>`;

// Find and replace the existing ANS report
const idx = reports.findIndex(r => r.githubId === 'ans-deep-dive');
if (idx >= 0) {
  reports[idx].advanced = advanced;
  reports[idx].eli5 = eli5;
  console.log('Updated existing ANS report at index', idx);
} else {
  console.log('ANS report not found!');
}

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Total reports:', reports.length);
