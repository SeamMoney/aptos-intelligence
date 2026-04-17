#!/usr/bin/env node
/**
 * Add two new deep-dive reports (Shardines, Aptos Stack Map) and
 * append one new section to the existing Prefix Consensus deep-dive.
 *
 * Sources: knowledge-base/docs/architecture-overview.md §9,
 *          knowledge-base/docs/20m-nft-analysis.md §2.5,
 *          arXiv:2602.02892 (Xiang/Tonkikh/Spiegelman, Feb 2026),
 *          moonshiesty/toly/Daniel Xiang public thread, Mar 2026.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'web/public/data');

const reports = JSON.parse(readFileSync(join(DATA, 'reports.json'), 'utf8'));
const commits = JSON.parse(readFileSync(join(DATA, 'commits.json'), 'utf8'));

/* ─────────────────────────── Prefix enrichment ─────────────────────────── */

const prefixNewSection = `

<h3>Leaderless vs Multi-Proposer — The Distinction That Matters</h3>

<p>The paper is explicit: Prefix Consensus yields a protocol that is both <strong>leaderless</strong> and <strong>multi-proposer</strong>. These are two different properties and every other production BFT protocol lacks at least one of them.</p>

<ul>
<li><strong>Multi-proposer.</strong> In every slot, every honest validator broadcasts its own proposal in parallel. There is no "proposer of the round."</li>
<li><strong>Leaderless.</strong> There is no designated leader, no rotating leader, no primary. Progress continues even if the adversary suspends any single party in any round (plus up to <em>f−1</em> Byzantine faults).</li>
</ul>

<p>This distinction surfaced publicly in March 2026 when <a href="https://x.com/moonshiesty/status/2034669976766873787">a widely-read X thread</a> asked why DAG-based chains like Sui and Hedera have failed to attract trading volume, and why Solana's MCP (Multi-Client Proposal) mechanism would fare any better. Daniel Xiang (first author of the Prefix Consensus paper) replied with the protocol as the direct answer:</p>

<blockquote>"DAG-based consensus is not stronger wrt censorship resistance than standard leader-based consensus. The leader/anchor can decide which 2f+1 proposals go into a block."</blockquote>

<p>When Solana co-founder Anatoly Yakovenko countered that "MCP is leader-based, not leaderless," Daniel linked the paper and clarified: <em>"MCP can be both leaderless and censorship resistant. We have some latest protocol stack on that."</em> The paper is the technical proof that such a protocol exists.</p>

<h3>Theoretical Contributions Beyond SMR</h3>

<p>Beyond the full SMR protocol, the paper contributes several results that are of independent interest for distributed systems research:</p>

<ul>
<li><strong>Tight round-complexity lower bound.</strong> Strong Prefix Consensus requires exactly 3 asynchronous rounds for <em>n &gt; 3f</em>. Two rounds is impossible unless <em>n &ge; 5f+1</em>. The paper proves both directions.</li>
<li><strong>Graded Consensus in 3 rounds.</strong> Prefix Consensus yields a graded consensus protocol with 3 message-delay latency, improving on the prior state of the art of 7.</li>
<li><strong>Leaderless Binary / Validated Consensus.</strong> The same techniques give <em>O(n&sup3;)</em> message and <em>O(n&#8308;)</em> communication leaderless consensus — a strict improvement over prior leaderless protocols.</li>
<li><strong>Optimistic fast path.</strong> A 2-round optimistic variant decides in the good case, falling back to the 3-round worst case.</li>
<li><strong>Communication-optimized variants.</strong> Aggregated signatures plus compact encoding of differing entries bring communication down further for large validator sets.</li>
</ul>

<p>These are the building blocks that make Archon's full leaderless mode practical at mainnet scale — not just theoretically sound.</p>
`;

const prefixIdx = reports.findIndex(r => r.githubId === 'prefix-consensus-deep-dive');
if (prefixIdx === -1) throw new Error('prefix-consensus-deep-dive not found');

const marker = '<h3>Why This Kills DAG-Based Approaches</h3>';
if (!reports[prefixIdx].advanced.includes(marker)) {
  throw new Error('Expected marker not found in prefix report — aborting to avoid corruption');
}
if (reports[prefixIdx].advanced.includes('Leaderless vs Multi-Proposer')) {
  console.log('Prefix enrichment already present — skipping');
} else {
  reports[prefixIdx].advanced = reports[prefixIdx].advanced.replace(
    marker,
    prefixNewSection + '\n\n' + marker
  );
  reports[prefixIdx].date = '2026-04-17T00:00:00Z';
  console.log(`Enriched prefix-consensus-deep-dive (+${prefixNewSection.length} chars)`);
}

/* ──────────────────────────── Shardines deep-dive ──────────────────────── */

const shardinesAdvanced = `<h2>Shardines — Internal Validator Sharding for 1M+ TPS on a Single Logical Node</h2>

<p>Shardines is Aptos's approach to horizontal scaling <em>inside</em> a single validator. Rather than cross-chain sharding (which fragments state and breaks atomic composability), Shardines partitions execution across multiple sub-executors within each validator node. The target is over 1 million TPS for non-conflicting transactions and over 500,000 TPS for conflicting transactions — on a single logical validator, not a multi-chain construction.</p>

<p>As of April 2026, Shardines sits at roughly 15% progress. The research design is complete, the partition algorithm is the active open problem, and the prototype depends on Block-STM v2 landing first. Mainnet deployment is targeted 2027+.</p>

<h3>The Core Idea: Three-Layer Internal Sharding</h3>

<p>Traditional sharding (Ethereum danksharding, NEAR Nightshade, Polkadot parachains) partitions the chain itself. Every shard has its own validator subset, its own state, and cross-shard transactions require bridging. This breaks synchronous composability — the single most valuable property of a DeFi-focused L1.</p>

<p>Shardines takes the opposite approach. The chain stays unified. Each validator <em>internally</em> partitions its own work across three layers:</p>

<ul>
<li><strong>Storage sharding.</strong> AptosDB / Jellyfish Merkle Tree state is partitioned across storage nodes within the validator. Reads and writes go to the correct partition; cross-partition reads are resolved via a local coordinator.</li>
<li><strong>Execution sharding.</strong> Block-STM v2 is extended to run multiple parallel speculation engines — one per shard — with cross-shard conflict resolution at commit time.</li>
<li><strong>Consensus-layer sharding.</strong> Proposal dissemination (Quorum Store batches) and certification are fanned out across shards so the consensus layer itself scales.</li>
</ul>

<p>All three layers are partitioned independently, and the partition function is chosen to minimize cross-shard traffic. The chain remains one chain; only the internal implementation is multi-machine.</p>

<pre><code>┌─────────────────────────────────────────────────────────┐
│  VALIDATOR NODE (one logical identity)                  │
│                                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │
│  │ Shard0 │  │ Shard1 │  │ Shard2 │  │ Shard3 │         │
│  │        │  │        │  │        │  │        │         │
│  │ Exec   │  │ Exec   │  │ Exec   │  │ Exec   │         │
│  │ Store  │  │ Store  │  │ Store  │  │ Store  │         │
│  │ QS     │  │ QS     │  │ QS     │  │ QS     │         │
│  └────────┘  └────────┘  └────────┘  └────────┘         │
│      │           │           │           │              │
│      └───────────┴────┬──────┴───────────┘              │
│                       │                                  │
│              Cross-shard coordinator                    │
│        (micro-batching + pipelined commits)             │
└─────────────────────────────────────────────────────────┘</code></pre>

<h3>Micro-Batching and Pipelining</h3>

<p>The central engineering problem is that cross-shard messages would otherwise dominate throughput. Shardines solves this with micro-batching: small batches of cross-shard messages are pipelined so communication overlaps with computation. Each shard processes its local block while exchanging only hashes and deltas with other shards, never full transaction bodies.</p>

<p>The partition function is the other central challenge. A naive hash partition would scatter related accounts across shards and explode cross-shard traffic. The research prototype uses a workload-aware partitioner that co-locates accounts that frequently transact together (a variant of METIS-style graph partitioning applied to the recent block-transaction graph), with periodic rebalancing.</p>

<h3>Dependencies — Why Block-STM v2 Must Land First</h3>

<p>Shardines cannot be built on the current Block-STM. Block-STM v1 assumes a single MVHashMap shared across all worker threads and a single global commit log. For multi-shard execution, each shard needs its own MVHashMap plus a cross-shard conflict detector that runs at commit time without blocking local progress.</p>

<p>Block-STM v2 (currently in development by Rati Gelashvili and team) is the primitive that makes this possible. It adds delayed fields, pre-write timestamps, and a redesigned MVHashMap specifically so multi-executor coordination is efficient. Only after v2 ships can the Shardines prototype graduate from research to implementation.</p>

<h3>Throughput Targets and Realistic Expectations</h3>

<table>
<tr><th>Configuration</th><th>Target TPS</th><th>Status</th></tr>
<tr><td>Current mainnet (pre-Shardines)</td><td>~12,000 TPS sustained, ~40,000 peak</td><td>Live</td></tr>
<tr><td>Block-STM v2 only</td><td>2–3&times; improvement over v1</td><td>In development</td></tr>
<tr><td>Shardines conservative (4 shards)</td><td>&gt;500,000 TPS (conflicting workload)</td><td>Research</td></tr>
<tr><td>Shardines full (16 shards, non-conflicting)</td><td>&gt;1,000,000 TPS</td><td>Research</td></tr>
</table>

<p>The 1M+ TPS number assumes a predominantly non-conflicting workload (e.g., NFT mints, independent token transfers, payment rails). Real DeFi workloads will hit the conservative number because of hotspot accounts (AMM pools, liquidation engines). Both remain a generational leap over any production L1.</p>

<h3>Relationship to the Rest of the Stack</h3>

<p>Shardines is strictly an <em>execution-layer</em> upgrade. It does not change the consensus protocol, the fee model, the state model, or the developer API. This is by design:</p>

<ul>
<li><strong>Consensus (Prefix / Raptr / Archon)</strong> orders the transactions. Shardines executes the ordered block.</li>
<li><strong>Zaptos</strong> pipelines optimistic execution before full ordering. Shardines makes each pipelined step faster.</li>
<li><strong>Block-STM v2</strong> is the single-node parallel engine. Shardines extends it to multi-node.</li>
<li><strong>Encrypted mempool</strong> is orthogonal — ciphertexts are decrypted before execution regardless of sharding.</li>
</ul>

<p>This layering is important. When Avery Ching (Aptos CTO) publicly stated the four active research priorities are Zaptos, Shardines, Block-STM v2, and Archon, the layering is why it works: each piece is independently shippable and each composes with the others.</p>

<h3>The 20M NFT Scenario — Why Shardines Matters Economically</h3>

<p>The canonical benchmark for Shardines is the "20M NFT mint" scenario analyzed internally by Aptos Labs. At today's throughput, minting 20 million NFTs takes hours. With full optimizations active (Raptr + Block-STM v2 + Zaptos + full Shardines), the projected time collapses to 20 seconds at 1M TPS, or 40 seconds at the conservative 500K TPS.</p>

<p>The economic framing matters: if a single chain can settle 20M atomic mints in under a minute, the addressable workload expands from "crypto-native apps" to "every web-scale consumer app that needs ownership." That is the entire point of the execution-scale roadmap.</p>

<h3>Current State and Open Questions</h3>

<table>
<tr><th>Component</th><th>Status</th></tr>
<tr><td>Three-layer design document</td><td>Complete (internal)</td></tr>
<tr><td>Workload-aware partition algorithm</td><td>Research — active open problem</td></tr>
<tr><td>Cross-shard atomic commit protocol</td><td>Design phase</td></tr>
<tr><td>Prototype</td><td>Blocked on Block-STM v2</td></tr>
<tr><td>Testnet validation</td><td>2027 target</td></tr>
<tr><td>Mainnet deployment</td><td>2027+ target</td></tr>
</table>

<p><strong>Lead researchers:</strong> design and partitioning work is led by the execution team (Rati Gelashvili, Manu Dhundi). Consensus-layer sharding overlap is coordinated with the Archon team (Zhuolun Xiang, Andrei Tonkikh).</p>

<h3>The Bottom Line</h3>

<p>Shardines is the most ambitious piece of the Aptos execution roadmap and the one with the longest timeline. It is not a near-term ship. But when it lands, it collapses the execution bottleneck that every L1 hits at scale, while keeping the chain unified and composable. The short-term story is Block-STM v2 plus Zaptos. The long-term story is Shardines turning one validator into the throughput equivalent of an entire sharded chain — without the fragmentation.</p>
`;

const shardinesEli5 = `<p><strong>Imagine a single factory that makes one million products an hour — without splitting into multiple factories.</strong></p>

<p>That is Shardines. Today, every Aptos validator is like a factory with one assembly line. Shardines turns each validator into a factory with sixteen assembly lines running in parallel, coordinated by one foreman.</p>

<p><strong>Why not just build more factories?</strong></p>

<p>Other blockchains (Ethereum shards, Polkadot parachains) solve scale by building more factories — but then the factories can't easily ship products to each other. You can't atomically trade a token on factory A for a token on factory B without a bridge. Bridges break, and worse, they make apps think harder than they should have to.</p>

<p>Shardines keeps one factory. One chain. One atomic transaction model. It just makes the factory's internal production lines parallel.</p>

<p><strong>The three production lines:</strong></p>
<ul>
<li>Where things are stored (storage shards)</li>
<li>Who does the assembling (execution shards)</li>
<li>Who writes down what got built (consensus shards)</li>
</ul>

<p><strong>What's the target?</strong> Over 1 million transactions per second for non-competing work, over 500,000 for competing work. For context: Visa peaks around 65,000 transactions per second.</p>

<p><strong>When?</strong> It's still in the research phase (~15% done). The partition algorithm — deciding which accounts go on which production line — is the hard open problem. It also depends on Block-STM v2 shipping first. Realistic mainnet timeline: 2027 or later.</p>

<p><strong>Why it matters:</strong> if Aptos can mint 20 million NFTs in 20 seconds on a unified chain, the class of apps that can live on-chain stops being "DeFi and crypto-natives" and starts being "every consumer app that needs verifiable ownership."</p>
`;

const shardinesReport = {
  id: 0,
  githubId: 'shardines-deep-dive',
  title: 'Shardines — How Aptos Plans to Hit 1M+ TPS on a Single Logical Validator',
  author: 'aptos-labs',
  date: '2026-04-17T00:00:00Z',
  category: 'Feature Progress',
  importance: 9,
  sourceUrl: 'https://github.com/aptos-labs/aptos-core',
  relatedFeatures: ['Block-STM v2', 'Zaptos', 'Raptr', 'Archon', 'Prefix Consensus'],
  labels: ['sharding', 'execution', 'throughput', 'shardines', 'block-stm'],
  advanced: shardinesAdvanced,
  eli5: shardinesEli5,
};

const shardinesCommit = {
  sha: 'shardines-deep-dive',
  title: shardinesReport.title,
  author: 'aptos-labs',
  date: shardinesReport.date,
  url: 'https://github.com/aptos-labs/aptos-core',
  category: 'Feature Progress',
};

/* ──────────────────────── Aptos Stack Map deep-dive ────────────────────── */

const stackAdvanced = `<h2>The Aptos Stack — One Map of How Every Piece Fits Together</h2>

<p>Aptos's next-generation technical roadmap is five pieces of research shipping in parallel: Prefix Consensus, Raptr / Archon, Zaptos, Block-STM v2, Shardines, and the encrypted mempool. Each deep-dive on this site covers one piece. This page is the canonical map of how they fit together — and what each layer is actually responsible for.</p>

<h3>The Layered Architecture</h3>

<pre><code>┌───────────────────────────────────────────────────────────────────┐
│                        PRIVACY / MEV PROTECTION                   │
│  Encrypted Mempool (BIBE, PerBatchKindTxnLimits, Quorum Store)    │
├───────────────────────────────────────────────────────────────────┤
│                        CONSENSUS / ORDERING                       │
│  Prefix Consensus  ─&gt;  Raptr (live)  ─&gt;  Archon (next)            │
│  Baby Raptr + Velociraptr already ordering blocks on mainnet      │
├───────────────────────────────────────────────────────────────────┤
│                        PIPELINING                                 │
│  Zaptos — optimistic validation + execution before final order    │
├───────────────────────────────────────────────────────────────────┤
│                        EXECUTION                                  │
│  Block-STM v2 (single node, 256 cores)                            │
│  Shardines (multi-node internal, 1M+ TPS target)                  │
├───────────────────────────────────────────────────────────────────┤
│                        STATE / STORAGE                            │
│  AptosDB + Jellyfish Merkle Tree + Hot State Cache + RocksDB      │
└───────────────────────────────────────────────────────────────────┘</code></pre>

<h3>What Each Layer Is Actually Responsible For</h3>

<h4>Privacy — Encrypted Mempool</h4>

<p>Transactions arrive from users as BIBE ciphertexts. Validators cannot see the plaintext, so they cannot front-run or reorder by content. The encrypted mempool layer verifies ciphertexts in parallel (via Balaji Arun's PR #19130), caps encrypted txns per batch kind via <code>PerBatchKindTxnLimits</code>, and threads encrypted batches through Quorum Store without blocking the decryption pipeline. Decryption happens after ordering, so ordering is content-blind.</p>

<h4>Consensus — Prefix Consensus, Raptr, Archon</h4>

<p>The Prefix Consensus primitive (arXiv:2602.02892) is the theoretical foundation. Raptr is the production instantiation — Baby Raptr is already ordering blocks on mainnet. Velociraptr is the optimized variant. Archon is the next-generation deployment, bringing the fully leaderless multi-proposer SMR protocol with f-censorship resistance and the demotion rule. No single validator can censor transactions for more than f slots after GST.</p>

<h4>Pipelining — Zaptos</h4>

<p>Consensus decides the order. Execution decides the result. Zaptos runs execution speculatively on the current candidate order while consensus is still finalizing. If the order is confirmed, execution is already done; if the order changes, Zaptos re-executes only the delta. This collapses end-to-end latency from the consensus-finality-then-execute sequential model into a single overlapped pipeline.</p>

<h4>Execution — Block-STM v2 and Shardines</h4>

<p>Block-STM v2 is the single-node parallel execution engine. Transactions are speculatively executed in parallel across up to 256 cores via MVCC, with delayed fields, pre-write timestamps, and a redesigned MVHashMap that reduces validation overhead. Shardines extends this to multi-executor within a single logical validator — the target is &gt;1M TPS on non-conflicting workloads. Shardines depends on Block-STM v2; it is not an alternative, it is an extension.</p>

<h4>State — AptosDB</h4>

<p>Underneath everything sits AptosDB: a Jellyfish Merkle Tree (versioned sparse Merkle tree), a hot state cache that keeps frequently-accessed resources in memory, and RocksDB as the persistent store. Storage is not currently on the active research frontier — the JMT is mature — but storage sharding is the first layer of Shardines that will ship.</p>

<h3>The Dependency Graph</h3>

<pre><code>Encrypted Mempool (shipping)   ─┐
                                ├─&gt; Prefix Consensus ─&gt; Raptr (live) ─&gt; Archon (next)
Prefix Consensus (paper Feb26) ─┘                              │
                                                               v
                                                            Zaptos ─&gt; Block-STM v2 ─&gt; Shardines
                                                           (merged) (in progress)   (research)</code></pre>

<p>Reading this graph: the left-to-right order is roughly the order in which each piece locks in. Encrypted mempool is already merging (PR #19130 landed in March 2026). Raptr is live on mainnet. Zaptos is shipping. Block-STM v2 is in active development. Archon and Shardines are the two biggest remaining unlocks — Archon for consensus, Shardines for execution.</p>

<h3>Current State — Where Each Piece Actually Is</h3>

<table>
<tr><th>Piece</th><th>Status</th><th>Lead</th><th>Mainnet Target</th></tr>
<tr><td>Encrypted Mempool</td><td>Merging (PR #19130 live)</td><td>Balaji Arun (ibalajiarun)</td><td>2026 rollout</td></tr>
<tr><td>Prefix Consensus (primitive)</td><td>Paper + prototype branch</td><td>Zhuolun Xiang</td><td>Goes into Archon</td></tr>
<tr><td>Raptr / Baby Raptr</td><td>Live on mainnet</td><td>Zhuolun Xiang, Balaji Arun</td><td>Shipped</td></tr>
<tr><td>Archon</td><td>Research / design</td><td>Zhuolun Xiang, Andrei Tonkikh</td><td>2026–2027</td></tr>
<tr><td>Zaptos</td><td>Merged + on-chain config</td><td>Zekun Li, Zhuolun Xiang</td><td>Shipped</td></tr>
<tr><td>Block-STM v2</td><td>Active development</td><td>Rati Gelashvili</td><td>2026</td></tr>
<tr><td>Shardines</td><td>Research (~15%)</td><td>Rati Gelashvili, Manu Dhundi</td><td>2027+</td></tr>
</table>

<h3>Why This Stack Beats the Alternatives</h3>

<p>Every major L1 has picked one or two of these properties and sacrificed the others:</p>

<ul>
<li><strong>Solana.</strong> Fast and parallel, but MCP is leader-based — censorship-vulnerable by the consensus protocol's design.</li>
<li><strong>Sui / Mysten.</strong> DAG-based (multi-proposer), but not formally censorship-resistant — the anchor validator can still drop honest proposals. Also fragments state across objects in a way that limits atomic composability.</li>
<li><strong>Ethereum.</strong> Rollup-centric scaling, which fragments liquidity and breaks synchronous composability between rollups.</li>
<li><strong>Hedera.</strong> DAG-based, but permissioned and governance-bottlenecked.</li>
</ul>

<p>Aptos's bet is that you can have all four at once: <strong>leaderless + multi-proposer + censorship-resistant + unified chain at &gt;1M TPS</strong>. Prefix Consensus is the theoretical proof that it is possible. The other four pieces are the engineering to ship it.</p>

<h3>The Cohesive Vision</h3>

<p>Every one of these pieces is led or co-led by a small core team: Zhuolun Xiang (Daniel), Andrei Tonkikh, Alexander Spiegelman, Rati Gelashvili, Zekun Li, Balaji Arun, Manu Dhundi. The same researchers who wrote the Prefix Consensus paper wrote the Raptr paper and the Zaptos paper. The same engineering team building Block-STM v2 is designing Shardines. This is not five disconnected research projects that happen to share a codebase — it is one cohesive vision for what the next decade of L1 infrastructure should look like, executed by a team small enough that the pieces compose.</p>

<p>That is why Aptos Labs's leadership (publicly, Avery Ching) has stated that the four active research priorities are Zaptos, Shardines, Block-STM v2, and Archon — with Prefix Consensus as the primitive underneath Archon. Shoal++, the 2024 DAG-BFT upgrade that came before Raptr, has been deprecated. The stack you see here is the one that is actually shipping.</p>

<p><strong>For deeper reading:</strong> see the individual deep-dive pages for <a href="#" data-github-id="prefix-consensus-deep-dive">Prefix Consensus</a>, <a href="#" data-github-id="shardines-deep-dive">Shardines</a>, <a href="#" data-github-id="confidential-assets-deep-dive">Confidential Assets</a>, <a href="#" data-github-id="randomness-deep-dive">On-Chain Randomness</a>, and <a href="#" data-github-id="aggregator-nft-deep-dive">Aggregators &amp; NFT Scale</a>.</p>
`;

const stackEli5 = `<p><strong>Aptos is five pieces of technology being built at the same time. Here is what each one actually does, in order.</strong></p>

<p><strong>1. Encrypted Mempool — the "sealed envelope" layer.</strong> When you send a transaction, validators can't read it until after they've decided the order. No more front-running, no more MEV extraction based on content.</p>

<p><strong>2. Prefix Consensus, Raptr, Archon — the "no boss" layer.</strong> Instead of one leader deciding the order of transactions (who can censor yours), every validator proposes at the same time and the protocol forces all honest proposals to be included.</p>

<p><strong>3. Zaptos — the "don't wait" layer.</strong> Consensus and execution used to be sequential: decide the order, then run the code. Zaptos runs the code while consensus is still deciding, and only redoes work if the order changes.</p>

<p><strong>4. Block-STM v2 — the "256 hands" layer.</strong> Execution runs in parallel across 256 CPU cores, with a smart conflict detector that notices when two transactions touch the same thing and re-runs only those.</p>

<p><strong>5. Shardines — the "one factory, sixteen production lines" layer.</strong> Each validator internally splits its work across 16 sub-executors, targeting over 1 million transactions per second on a single chain.</p>

<p><strong>How do they fit?</strong> Each one depends on the one above it. Encrypted mempool feeds into consensus. Consensus feeds into Zaptos. Zaptos feeds into Block-STM v2. Block-STM v2 is the foundation for Shardines.</p>

<p><strong>Where are they today?</strong> Raptr is live. Zaptos is shipping. Encrypted mempool is merging this quarter. Block-STM v2 is mid-development. Archon and Shardines are the two biggest ongoing research efforts.</p>

<p><strong>The point:</strong> every other fast chain has picked one or two of these and given up the rest. Aptos is trying to have all five at once — and a small team of maybe ten researchers is actually shipping it.</p>
`;

const stackReport = {
  id: 0,
  githubId: 'aptos-stack-map',
  title: 'The Aptos Stack — One Map of How Every Piece Fits Together',
  author: 'aptos-labs',
  date: '2026-04-17T00:00:00Z',
  category: 'Feature Progress',
  importance: 10,
  sourceUrl: 'https://github.com/aptos-labs/aptos-core',
  relatedFeatures: ['Prefix Consensus', 'Raptr', 'Archon', 'Zaptos', 'Block-STM v2', 'Shardines', 'Encrypted Mempool'],
  labels: ['overview', 'architecture', 'stack-map'],
  advanced: stackAdvanced,
  eli5: stackEli5,
};

const stackCommit = {
  sha: 'aptos-stack-map',
  title: stackReport.title,
  author: 'aptos-labs',
  date: stackReport.date,
  url: 'https://github.com/aptos-labs/aptos-core',
  category: 'Feature Progress',
};

/* ─────────────────────────────── Upsert ────────────────────────────────── */

function upsertReport(r) {
  const i = reports.findIndex(x => x.githubId === r.githubId);
  if (i === -1) { reports.push(r); console.log(`Added report: ${r.githubId}`); }
  else { reports[i] = { ...reports[i], ...r }; console.log(`Updated report: ${r.githubId}`); }
}

function upsertCommit(c) {
  const i = commits.findIndex(x => x.sha === c.sha);
  if (i === -1) { commits.unshift(c); console.log(`Added commit: ${c.sha}`); }
  else { commits[i] = { ...commits[i], ...c }; console.log(`Updated commit: ${c.sha}`); }
}

upsertReport(shardinesReport);
upsertReport(stackReport);
upsertCommit(shardinesCommit);
upsertCommit(stackCommit);

writeFileSync(join(DATA, 'reports.json'), JSON.stringify(reports, null, 2));
writeFileSync(join(DATA, 'commits.json'), JSON.stringify(commits, null, 2));

console.log(`\nDone. reports=${reports.length}, commits=${commits.length}`);
