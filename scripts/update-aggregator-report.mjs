import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));

const advanced = `<h2>How Aptos Minted 1 Million NFTs in 90 Seconds — Full Technical Breakdown</h2>

<p>In November 2023, during Aptos Previewnet, Aptos Labs demonstrated minting <strong>1 million NFTs in approximately 90 seconds</strong>, sustaining over 10,000 NFTs per second. Then 5 million in ~8 minutes. This was not a marketing stunt or a client-side batching trick. It was made possible by a fundamental VM-level primitive called <strong>Aggregators</strong> — one of the most technically interesting innovations in Aptos's architecture.</p>

<p>This page explains exactly why sequential NFT minting is hard, how Aptos solved it at the VM level, what the numbers look like today versus 2023, and what this means for anyone building on Aptos.</p>

<h3>Why Sequential NFT Minting Collapses Throughput</h3>

<p>To understand why this is hard, you need to understand Block-STM's parallel execution model.</p>

<p>Block-STM executes all transactions in a block <em>speculatively in parallel</em>. Each transaction records what it reads (read set) and what it writes (write set). After execution, a validation phase checks for conflicts: if transaction B read a value that transaction A wrote, B must be re-executed with the updated value. This is MVCC — Multi-Version Concurrency Control.</p>

<p>Now imagine minting NFTs with sequential names: "NFT #1", "NFT #2", "NFT #3"...</p>

<p>Every mint transaction must:</p>
<ol>
<li>Read the current <code>total_supply</code> counter from the collection object</li>
<li>Compute <code>token_name = "NFT #" + total_supply</code></li>
<li>Increment <code>total_supply</code> by 1</li>
<li>Create the token with that name</li>
</ol>

<p>Step 1 (read) and Step 3 (write) on the same counter create a <strong>read-modify-write dependency</strong>. Every single mint transaction reads and writes the same global counter. Block-STM detects this as a conflict for every transaction pair — and re-executes them all sequentially. Instead of running 10,000 mints in parallel across CPU cores, you get 10,000 sequential operations. Throughput collapses completely.</p>

<p>This is the same reason Ethereum NFT launches are painful. Gas wars during hot mints, crashes, failed transactions — it's not just network congestion. It's a fundamental architectural constraint when all transactions touch the same counter.</p>

<h3>Aggregator v1 — The First Solution (AIP-11, October 2022)</h3>

<p>Aptos introduced Aggregators in October 2022 as AIP-11. The core insight: what if a counter could <em>accumulate additions without requiring reads</em>?</p>

<pre><code>// Module: 0x1::aggregator
// aggregator.move

struct Aggregator has store {
    handle: address,
    key: address,
    limit: u128,
}

/// Add value to aggregator. Does NOT read current value.
public native fun add(aggregator: &mut Aggregator, value: u128);

/// Subtract value. Does NOT read current value.
public native fun sub(aggregator: &mut Aggregator, value: u128);

/// Read the current value — forces serialization point
public native fun read(aggregator: &Aggregator): u128;

/// Destroy the aggregator
public native fun destroy(aggregator: Aggregator);
</code></pre>

<p>The magic is in <code>add()</code>: it does NOT read the current value of the counter. Internally, the VM maintains a delta — "this transaction wants to add 1" — and applies all deltas atomically at commit time. Multiple transactions calling <code>add()</code> on the same aggregator are NOT in conflict, because none of them are reading the counter.</p>

<p>Aggregator v1 was initially used for the APT total supply counter — tracking the global coin supply without forcing sequential writes. But it had a critical limitation: you couldn't use the aggregated value <em>within the same transaction that modifies it</em> to derive names or IDs, because reading during execution would reintroduce the conflict.</p>

<h3>Aggregator v2 and AggregatorSnapshot — The Full Solution (AIP-47, Q1 2024)</h3>

<p>AIP-47 introduced <code>aggregator_v2</code> with a crucial new primitive: <code>AggregatorSnapshot</code>.</p>

<pre><code>// Module: 0x1::aggregator_v2
// aggregator_v2.move

struct Aggregator&lt;IntElement: copy + drop&gt; has store {
    value: IntElement,
    max_value: IntElement,
}

/// Snapshot — captures the value at commit time, not execution time
struct AggregatorSnapshot&lt;IntElement: copy + drop&gt; has store, drop {
    value: IntElement,
}

/// DerivedStringSnapshot — a string built from a snapshot at commit time
struct DerivedStringSnapshot has store, drop {
    value: String,
    padding: vector&lt;u8&gt;,
}

/// Increment — parallel safe, no read
public native fun add&lt;IntElement: copy + drop&gt;(
    aggregator: &mut Aggregator&lt;IntElement&gt;,
    value: IntElement
);

/// Create a snapshot — does NOT expose the value during execution
/// The actual value is substituted at commit time
public native fun snapshot&lt;IntElement: copy + drop&gt;(
    aggregator: &Aggregator&lt;IntElement&gt;
): AggregatorSnapshot&lt;IntElement&gt;;

/// Derive a string from a snapshot with prefix and suffix
/// e.g., snapshot of 42 with prefix "NFT #" → "NFT #42" at commit
public native fun derive_string_concat&lt;IntElement: copy + drop&gt;(
    snapshot: &AggregatorSnapshot&lt;IntElement&gt;,
    prefix: String,
    suffix: String,
): DerivedStringSnapshot;

/// Read the snapshot value — forces serialization, use carefully
public native fun read_snapshot&lt;IntElement: copy + drop&gt;(
    snapshot: &AggregatorSnapshot&lt;IntElement&gt;
): IntElement;
</code></pre>

<p>The key innovation: <code>snapshot()</code> captures a "promise" of the value — not the value itself. During parallel execution, no actual number is read. At commit time, after all deltas are applied and the final counter value is known, the VM substitutes the real numbers into every snapshot. The <code>DerivedStringSnapshot</code> is then resolved into actual strings like "NFT #1", "NFT #2", etc.</p>

<h3>The Complete NFT Minting Pattern</h3>

<p>Here's exactly how a parallel-safe NFT collection looks in Move with aggregator_v2:</p>

<pre><code>module collection_addr::parallel_nft {
    use aptos_framework::object::{Self, Object};
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_std::aggregator_v2::{Self, Aggregator, AggregatorSnapshot};
    use std::string::{Self, String};
    use std::signer;

    /// Stored at the collection creator's address
    struct MintState has key {
        /// Parallel-safe counter — no read needed during mint
        supply_counter: Aggregator&lt;u64&gt;,
        /// Reference to the collection object
        collection: Object&lt;collection::Collection&gt;,
    }

    /// Create the collection
    public entry fun create_collection(creator: &signer, name: String) {
        let collection = collection::create_unlimited_collection(
            creator,
            string::utf8(b"A parallel NFT collection"),
            name,
            option::none(),
            string::utf8(b"https://example.com"),
        );
        move_to(creator, MintState {
            supply_counter: aggregator_v2::create_aggregator(u64::MAX),
            collection,
        });
    }

    /// Mint one NFT — fully parallel-safe
    public entry fun mint(user: &signer, creator_addr: address) acquires MintState {
        let state = borrow_global_mut&lt;MintState&gt;(creator_addr);

        // 1. Snapshot BEFORE incrementing — captures current position
        //    without reading the actual value (no conflict!)
        let snapshot: AggregatorSnapshot&lt;u64&gt; = aggregator_v2::snapshot(
            &state.supply_counter
        );

        // 2. Increment — parallel safe, no read
        aggregator_v2::add(&mut state.supply_counter, 1);

        // 3. Derive token name from snapshot — resolved at commit time
        //    At commit: snapshot → actual number → "NFT #42"
        let token_name = aggregator_v2::derive_string_concat(
            &snapshot,
            string::utf8(b"NFT #"),
            string::utf8(b""),
        );

        // 4. Mint the token — name will be correct at commit
        token::create(
            // creator signer (via resource account)
            user,
            collection::name(state.collection),
            string::utf8(b""),  // description
            token_name,          // DerivedStringSnapshot — resolved at commit
            option::none(),      // royalty
            string::utf8(b"https://example.com/nft"),
        );
    }
}
</code></pre>

<p>Steps 1-4 can run for thousands of users simultaneously. No transaction conflicts on the supply counter. Block-STM executes all of them in parallel. At commit time, the VM resolves all the snapshots to their actual values (1, 2, 3, ... 1,000,000) and builds all the token names atomically.</p>

<h3>Why This Is Fundamentally Different From Ethereum Batching</h3>

<p>Ethereum developers often work around sequential minting by <em>batching transactions off-chain</em>: one relayer sends a single transaction that mints 100 NFTs at once. This reduces the number of transactions but doesn't change the fundamental architecture — you're still reading and writing the same counter, just doing it less often. It's a band-aid.</p>

<p>Aptos aggregators eliminate the bottleneck at the <strong>execution engine level</strong>:</p>

<table>
<tr><th>Approach</th><th>Where</th><th>Mechanism</th><th>Conflict?</th></tr>
<tr><td>Ethereum sequential mint</td><td>EVM</td><td>Read-modify-write counter</td><td>All transactions conflict</td></tr>
<tr><td>Ethereum batching</td><td>Client-side</td><td>Bundle N mints into 1 tx</td><td>Reduces tx count, same conflict within tx</td></tr>
<tr><td>Aptos aggregator_v2</td><td>Move VM</td><td>Delta accumulation, snapshot resolution</td><td>No conflicts — fully parallel</td></tr>
</table>

<p>The aggregator approach means 10,000 separate mint transactions from 10,000 different users can all execute simultaneously with zero conflicts. No bundling required. No relayer. Each user sends their own transaction and gets parallelism for free.</p>

<h3>The Original 1M NFT Demo — What Actually Happened</h3>

<p>The demonstration occurred during <strong>Aptos Previewnet in November 2023</strong> (November 6–21). This was an internal Aptos Labs scalability test, not a named external NFT project, designed to validate AIP-43 (Digital Assets / Token Objects v2) and AIP-47 (Aggregator v2) before mainnet enablement in Q1 2024.</p>

<p><strong>Official numbers:</strong></p>
<ul>
<li>1 million NFTs: ~90 seconds</li>
<li>5 million NFTs: ~8 minutes</li>
<li>Sustained rate: &gt;10,000 NFTs/second</li>
<li>Improvement over sequential: ~10x</li>
</ul>

<p>Gas costs were not disclosed for the Previewnet demo. The test used the new Token Objects (v2) standard, not Token v1. AIP-43 and AIP-47 were enabled on mainnet in Q1 2024.</p>

<h3>The Math Today: What Would 1M NFTs Cost in April 2026?</h3>

<p>The Aptos infrastructure has changed significantly since the 2023 demo:</p>

<table>
<tr><th>Component</th><th>Nov 2023 (Previewnet)</th><th>Apr 2026 (Mainnet)</th></tr>
<tr><td>Consensus</td><td>Jolteon (pre-Raptr)</td><td>Baby Raptr + Velociraptr</td></tr>
<tr><td>Block time</td><td>~200ms</td><td>&lt;50ms (40% reduction from Velociraptr)</td></tr>
<tr><td>Execution</td><td>Block-STM v1</td><td>Block-STM v2 (ramping)</td></tr>
<tr><td>Token standard</td><td>Early Token Objects</td><td>Token Objects v2 (AIP-43, ~10x cheaper)</td></tr>
<tr><td>Sustained TPS</td><td>10,000+ (demo)</td><td>~20,000 mainnet</td></tr>
<tr><td>Research peak TPS</td><td>—</td><td>1.033M (single-node cluster)</td></tr>
</table>

<p><strong>Estimated cost for 1 million NFT mints today:</strong></p>
<ul>
<li>Gas per Token Objects v2 mint: ~0.00011 APT</li>
<li>Total for 1M mints: ~110 APT</li>
<li>At current APT price (~$7): ~$770 total, or <strong>$0.00077 per NFT</strong></li>
<li>Estimated time: <strong>~33–50 seconds</strong> (vs. 90 seconds in 2023)</li>
</ul>

<p>Compare to Ethereum: a single NFT mint during a hot launch typically costs $20–$500 in gas. Minting 1 million NFTs on Ethereum would be practically impossible during peak demand — even with batching, the coordination overhead and gas costs would be prohibitive.</p>

<h3>The Three Aggregator Modules</h3>

<table>
<tr><th>Module</th><th>Path in aptos-core</th><th>Purpose</th></tr>
<tr><td><code>aggregator</code></td><td><code>aptos-move/framework/aptos-stdlib/sources/aggregator/aggregator.move</code></td><td>v1 — parallel-safe u128 counters. Used for APT total supply.</td></tr>
<tr><td><code>aggregator_v2</code></td><td><code>aptos-move/framework/aptos-stdlib/sources/aggregator/aggregator_v2.move</code></td><td>v2 — generic Aggregator&lt;T&gt;, AggregatorSnapshot, DerivedStringSnapshot. Used for NFT names.</td></tr>
<tr><td><code>aggregator_factory</code></td><td><code>aptos-move/framework/aptos-stdlib/sources/aggregator/aggregator_factory.move</code></td><td>Creates aggregator instances. Manages the underlying storage handles.</td></tr>
</table>

<h3>IMPORTANT: Two Completely Different Things Called "Aggregator"</h3>

<p>There is significant naming confusion in the Aptos ecosystem. Make sure you know which one is being discussed:</p>

<p><strong>1. Transaction Aggregators (what enables 1M NFT minting)</strong></p>
<ul>
<li>Location: <code>0x1::aggregator_v2</code> — Move modules in the Aptos Framework</li>
<li>What they do: VM-level parallel-safe counters that eliminate execution conflicts</li>
<li>Who uses them: NFT collection creators, DeFi protocols tracking balances, anyone needing parallel-safe global counters</li>
<li>Introduced: AIP-11 (v1, Oct 2022), AIP-47 (v2, Q1 2024)</li>
</ul>

<p><strong>2. Marketplace Aggregators (a different thing entirely)</strong></p>
<ul>
<li>Location: <a href="https://github.com/aptos-labs/aptos-nft-aggregator" target="_blank">aptos-labs/aptos-nft-aggregator</a> — Rust indexer, launched Feb 2025</li>
<li>What they do: Aggregate NFT listings from multiple marketplaces (Tradeport, Wapal, Bluemove) for price comparison and unified APIs</li>
<li>Who uses them: NFT trading interfaces, portfolio trackers, analytics dashboards</li>
<li>Has nothing to do with parallel minting</li>
</ul>

<h3>Current NFT Ecosystem on Aptos</h3>

<table>
<tr><th>Platform</th><th>Type</th><th>Notes</th></tr>
<tr><td><a href="https://tradeport.xyz" target="_blank">Tradeport</a></td><td>Marketplace + marketplace aggregator</td><td>Leading volume, aggregates listings</td></tr>
<tr><td><a href="https://wapal.io" target="_blank">Wapal</a></td><td>NFT marketplace</td><td>Active, modern UI</td></tr>
<tr><td><a href="https://bluemove.net" target="_blank">Bluemove</a></td><td>NFT marketplace</td><td>Active</td></tr>
<tr><td><a href="https://rarible.com" target="_blank">Rarible</a></td><td>Multi-chain marketplace</td><td>Supports Aptos</td></tr>
<tr><td>Topaz</td><td>NFT marketplace (OG)</td><td>Legacy, reduced activity after 2023</td></tr>
<tr><td><a href="https://github.com/aptos-labs/token-minter" target="_blank">Token Minter</a></td><td>Collection launch tool</td><td>Official Aptos Labs tool by BriungRi</td></tr>
<tr><td><a href="https://aptosnames.com" target="_blank">Aptos Names (ANS)</a></td><td>.apt domain names</td><td>Uses Token Objects, 1 APT/yr for 6+ char names</td></tr>
</table>

<h3>What Aggregators Enable Beyond NFTs</h3>

<p>Transaction aggregators are not just for NFTs. Any use case that requires a global parallel-safe counter benefits:</p>
<ul>
<li><strong>DeFi liquidity pools</strong>: Track total liquidity without forcing sequential writes on every swap</li>
<li><strong>Stablecoins</strong>: Track total supply without bottlenecking mint/burn operations</li>
<li><strong>Voting / governance</strong>: Accumulate votes in parallel without conflicts</li>
<li><strong>Gaming</strong>: Track global scores, item counts, player counts across many simultaneous actions</li>
<li><strong>Token bridges</strong>: Track cross-chain transfer volumes without serialization</li>
</ul>

<p>The APT coin supply itself uses Aggregator v1 — every time APT is staked, unstaked, burned, or created, a parallel-safe aggregator tracks the total supply without any of these operations conflicting with each other.</p>`;

const eli5 = `<p><strong>The Big Picture: Why Is This Hard?</strong></p>
<p>Imagine a popular concert where 10,000 people want to buy tickets at the same time. Each ticket needs a unique number. The problem: everyone has to ask "what's the last ticket number?" before they can buy the next one. If 10,000 people ask that question simultaneously, you only have one answer at a time — so everyone ends up waiting in line anyway. That's exactly what happens on most blockchains when thousands of people try to mint NFTs at once.</p>

<p><strong>What Aptos Invented: The Magic Ticket Machine</strong></p>
<p>Aptos built a special kind of counter called an <strong>Aggregator</strong>. Here's the magic: instead of asking "what's the current number?", each person just says "add 1 to whatever the total is." The machine collects all these "add 1" requests from all 10,000 people at once, and at the very end — after everyone has submitted — it hands out the real numbers in order.</p>

<p>Nobody had to wait. Nobody conflicted with anyone else. And everyone got their correct, unique ticket number.</p>

<p><strong>The AggregatorSnapshot Trick</strong></p>
<p>But wait — NFT names need to say "NFT #42" or "NFT #7,893". How do you build that name if you don't know your number yet? That's what <code>AggregatorSnapshot</code> solves. Think of it like a placeholder receipt: "your number will be filled in here." The blockchain hands you a blank receipt, you do all your work with it, and at the very last moment — when all the counting is done — it fills in your actual number everywhere it appears.</p>

<p><strong>The November 2023 Demo</strong></p>
<p>Aptos proved this worked by minting 1 million unique NFTs in about 90 seconds on their test network. Then 5 million in about 8 minutes. That's over 10,000 NFTs per second, sustained. For comparison, during a big NFT launch on Ethereum, people often pay $50–$500 in fees just to mint a single NFT, and the whole thing crashes anyway.</p>

<p><strong>What It Costs Today</strong></p>
<p>On Aptos mainnet today, minting 1 million NFTs would take about 33–50 seconds (even faster than 2023 thanks to infrastructure improvements) and cost about 110 APT in total — roughly $0.001 per NFT at current prices. The entire infrastructure — faster blocks, better parallel execution, cheaper transactions — has improved dramatically since 2023.</p>

<p><strong>Don't Confuse the Two "Aggregators"</strong></p>
<p>There's an unfortunate naming collision. When people say "aggregator" on Aptos, they might mean:</p>
<ul>
<li><strong>Transaction aggregators</strong> (what this page is about): built into the Move VM, enable parallel minting</li>
<li><strong>Marketplace aggregators</strong>: separate apps that pull NFT listings from multiple marketplaces so you can compare prices, like a Kayak for NFTs</li>
</ul>
<p>These are completely unrelated things with the same name.</p>

<p><strong>What You Learned</strong></p>
<p>Aptos built a counter that thousands of people can increment at the exact same time without any of them conflicting with each other. This is possible because the counter doesn't need to be read during the process — only at the very end. This one innovation unlocks massively parallel NFT minting, DeFi operations, gaming, and more. It's built into the Move VM itself, not a workaround on top of it.</p>`;

const idx = reports.findIndex(r => r.githubId === 'aggregator-nft-deep-dive');
if (idx >= 0) {
  reports[idx].advanced = advanced;
  reports[idx].eli5 = eli5;
  console.log('Updated aggregator report at index', idx);
  console.log('Advanced length:', advanced.length, 'chars');
} else {
  console.log('Not found — adding new');
  reports.push({
    id: 99998,
    githubId: 'aggregator-nft-deep-dive',
    title: 'How Aptos Minted 1M NFTs in 90 Seconds — Aggregators Explained',
    author: 'aptos-labs',
    date: '2026-04-09T00:00:00Z',
    category: 'Feature Progress',
    importance: 9,
    sourceUrl: 'https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/framework/aptos-stdlib/sources/aggregator',
    relatedFeatures: ['Block-STM', 'Token Objects', 'AIP-43', 'AIP-47'],
    labels: ['aggregator', 'nft', 'performance'],
    advanced,
    eli5,
  });
}

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log('Done. Total reports:', reports.length);
