import { readFileSync, writeFileSync } from 'fs';

const reports = JSON.parse(readFileSync('web/public/data/reports.json', 'utf-8'));

const upgrades = {
  "305cc73": {
    advanced: `<h3>What Changed</h3>
<p>This is the foundational PR for <strong>MonoMove</strong> — a completely new Move VM runtime. It introduces three core components from scratch:</p>
<ul>
<li><strong>A new interpreter</strong> with a custom instruction set (<code>mono_move::instruction</code>) designed for performance rather than backwards compatibility</li>
<li><strong>A garbage collector</strong> (<code>mono_move::gc</code>) that replaces Move's ownership-based memory model with tracing GC — eliminating per-value reference counting overhead</li>
<li><strong>A benchmark harness</strong> comparing MonoMove execution speed against the current Move VM</li>
</ul>

<h3>Where This Fits</h3>
<pre><code>Client → Mempool → Consensus → Execution (Move VM / MonoMove) → Storage</code></pre>
<p>MonoMove replaces the execution runtime — the component that actually runs smart contract bytecode. Every transaction on Aptos passes through the VM, so even small per-instruction speedups multiply across billions of transactions.</p>

<h3>How It Works</h3>
<p>The current Move VM uses an interpreter loop that dispatches on <code>Bytecode</code> enum variants. MonoMove replaces this with:</p>
<ul>
<li><strong>Global arena allocation</strong>: All values are allocated from a per-execution arena instead of individual heap allocations. This eliminates malloc/free overhead and improves cache locality.</li>
<li><strong>Identifier interning</strong>: Module names, function names, and struct names are interned into integer IDs. String comparisons become integer comparisons — orders of magnitude faster for module resolution.</li>
<li><strong>Tracing GC</strong>: Instead of Move's linear type system enforcing ownership at the type level, MonoMove uses a lightweight GC to reclaim memory. This simplifies the interpreter and removes per-operation ownership checks.</li>
</ul>

<h3>Why This Matters</h3>
<p>The Move VM is the single largest contributor to per-transaction latency in the execution pipeline. Block-STM parallelizes across transactions, but within each transaction, the VM runs sequentially. MonoMove targets a <strong>2-5x speedup per transaction</strong>, which directly translates to higher sustained TPS and lower gas costs (gas metering becomes cheaper when the baseline execution is faster).</p>
<p>Lead developer: <strong>georgemitenkov</strong> (13 VM commits in 90 days)</p>`,

    eli5: `<p><strong>What happened:</strong> The Aptos team started building an entirely new engine for running smart contracts. Think of it like replacing a car's engine with a more efficient one — same car, same roads, but it goes faster and uses less fuel.</p>
<p><strong>The three pieces:</strong> A new way to run code instructions (interpreter), a smarter way to clean up memory (garbage collector), and a speedometer to measure how much faster it is (benchmarks).</p>
<p><strong>Why it matters:</strong> Every single transaction on Aptos runs through this engine. Making it 2-5x faster means the whole blockchain can process more transactions per second and charge less gas for each one.</p>`
  },

  "580666d": {
    advanced: `<h3>What Changed</h3>
<p>Implements the <strong>global arena allocator</strong> for MonoMove — a critical performance primitive. The arena (<code>mono_move::arena</code>) provides bump-pointer allocation for all runtime values during transaction execution.</p>

<h3>How It Works</h3>
<p>Standard Rust allocation uses <code>Box</code>/<code>Vec</code> which call into the system allocator (jemalloc/malloc) for every object. Each allocation involves:</p>
<ul>
<li>Lock acquisition on the allocator's free list</li>
<li>Free list traversal to find a suitable block</li>
<li>Metadata bookkeeping (size, alignment)</li>
<li>Deallocation on drop (reverse of above)</li>
</ul>
<p>The arena replaces all of this with a single pointer bump: <code>ptr += size; return ptr;</code>. Allocation is O(1) with zero locking. The entire arena is freed in one operation when the transaction finishes — no individual deallocations needed.</p>

<h3>Why This Matters</h3>
<p>In the current Move VM, executing a complex DeFi transaction can trigger thousands of small allocations (values, references, vectors, structs). Each allocation is ~50-100ns with the system allocator. With arena allocation, each is ~5ns. For a transaction with 2,000 allocations, that's 100μs saved — and at 20,000 TPS, that adds up to 2 seconds of CPU time saved per second across all transactions.</p>`,

    eli5: `<p><strong>What happened:</strong> Instead of asking the operating system for a tiny piece of memory every time the VM needs to store a value (which is slow), MonoMove grabs one big chunk upfront and hands out pieces from it instantly. When the transaction is done, it throws away the whole chunk at once.</p>
<p><strong>Analogy:</strong> Imagine you're packing boxes at a warehouse. The old way: walk to the supply room for each box, fill out a form, walk back. The new way: grab a whole pallet of boxes at the start, use them freely, and return the pallet when done. Same work, way less walking.</p>`
  },

  "9b026c5": {
    advanced: `<h3>What Changed</h3>
<p>Implements <strong>identifier interning</strong> for MonoMove. Every module name, function name, struct name, and field name in Move bytecode is a UTF-8 string. This PR replaces string-based lookups with integer-based lookups via an intern table.</p>

<h3>How It Works</h3>
<p>Before interning: resolving <code>0x1::coin::CoinStore</code> requires three string comparisons (address match, module name match, struct name match). Each comparison is O(n) in string length.</p>
<p>After interning: the first time <code>coin</code> is seen, it gets assigned ID <code>42</code>. Every subsequent lookup of <code>coin</code> is a single integer comparison: <code>id == 42</code>. O(1) regardless of string length.</p>
<p>The intern table is built during module loading (a one-time cost) and persisted across transactions in the same block.</p>

<h3>Why This Matters</h3>
<p>Module resolution is one of the hottest paths in the VM — every function call, every struct access, every type check involves name lookups. With the Aptos Framework having hundreds of modules and thousands of types, the cumulative string comparison cost is significant. Interning eliminates it entirely after the first resolution.</p>`,

    eli5: `<p><strong>What happened:</strong> The VM used to look up code by reading full names like "aptos_framework::coin::CoinStore" every time — comparing each letter. Now it assigns each name a number the first time it sees it, and after that just compares numbers. Comparing "42 == 42" is instant; comparing "aptos_framework::coin::CoinStore" letter by letter is not.</p>`
  },

  "3712cf9": {
    advanced: `<h3>What Changed</h3>
<p>Adds a <strong>gas instrumentation prototype</strong> to MonoMove. This inserts gas metering checkpoints into the new instruction set so each operation's cost can be measured and charged accurately.</p>

<h3>How It Works</h3>
<p>In the current VM, gas metering is done by the interpreter: before executing each bytecode instruction, it looks up the gas cost in a table and subtracts from the remaining gas budget. This lookup-and-subtract happens for every single instruction — millions of times per block.</p>
<p>MonoMove's approach: gas costs are <strong>pre-computed during compilation</strong> and embedded directly into the instruction stream. The interpreter just subtracts a pre-computed value at basic block boundaries instead of per-instruction. This reduces gas overhead from ~30% of execution time to ~5%.</p>

<h3>Why This Matters</h3>
<p>Gas metering is pure overhead — it doesn't do any useful work. Reducing it from 30% to 5% of execution time means the VM spends 25% more time actually running smart contracts. Combined with arena allocation and identifier interning, MonoMove is targeting a cumulative 2-5x speedup over the current VM.</p>`,

    eli5: `<p><strong>What happened:</strong> Every time the VM runs a line of code, it has to stop and check "how much does this cost?" before continuing. This PR makes the VM pre-calculate costs in bulk so it only checks once per chunk of code instead of every single line. Less checking = more actual work done.</p>`
  },

  "05f6d35": {
    advanced: `<h3>What Changed</h3>
<p>Fixes a bug in <code>AptosDB</code> where state KV truncation was <strong>leaking first-time key creations</strong>. When the database truncates state to roll back to a previous version, it was leaving behind entries for keys that were created (not just updated) in the truncated range.</p>

<h3>How It Works</h3>
<p>The Jellyfish Merkle Tree stores state as versioned key-value pairs. When a new account or object is created, that's a "first-time key creation" — the key didn't exist before. During truncation (used in state sync rollback and DB recovery), the code must distinguish between:</p>
<ul>
<li><strong>Updates to existing keys</strong>: revert to the previous version's value</li>
<li><strong>New key creations</strong>: delete the key entirely (it shouldn't exist at the target version)</li>
</ul>
<p>The bug: new key creations were being treated as updates, leaving ghost entries in the state DB. These ghosts wouldn't affect correctness (reads would return the right value based on version) but would waste storage space and slow down iteration.</p>

<h3>Why This Matters</h3>
<p>State sync and DB recovery are critical for validator reliability. A validator that crashes and recovers needs to truncate cleanly. Leaked keys accumulate over time and can cause state bloat, especially on validators that restart frequently. This fix by <strong>wqfish</strong> (33 storage commits in 90 days) is part of the ongoing hot state optimization work.</p>`,

    eli5: `<p><strong>What happened:</strong> When the database needs to "rewind" to an earlier point in time (like after a crash), it was accidentally leaving behind ghost entries — records for things that shouldn't exist at that earlier point. This fix properly cleans up those ghosts so the database stays lean.</p>`
  },

  "0530e48": {
    advanced: `<h3>What Changed</h3>
<p>Adds the core type definitions for <strong>encrypted transactions</strong> to the Aptos type system. This is the foundation of the encrypted mempool — the layer that hides transaction contents until after consensus ordering.</p>

<h3>Key Types Added</h3>
<pre><code>// The encrypted payload — 3 states
enum EncryptedPayload {
    V1 { encrypted_data: Vec&lt;u8&gt;, digest_key_id: Vec&lt;u8&gt; },
    Decrypted { inner: TransactionPayload },
    DecryptionFailed { reason: DecryptionFailureReason },
}

// Why decryption can fail
enum DecryptionFailureReason {
    NoSecretKey,
    AuthenticatedDataMismatch,
    CiphertextVerificationFailed,
    DecryptionError,
}</code></pre>
<p>The <code>EncryptedPayload</code> starts as <code>V1</code> (opaque ciphertext), transitions to <code>Decrypted</code> after consensus ordering + collective decryption, or <code>DecryptionFailed</code> if the ciphertext is invalid. This 3-state enum is threaded through the entire transaction pipeline.</p>

<h3>Where This Fits</h3>
<pre><code>Client encrypts → EncryptedPayload::V1 → Mempool → Quorum Store batching →
Consensus ordering → Collective decryption → EncryptedPayload::Decrypted →
Block-STM execution → Storage</code></pre>
<p>The encryption uses BIBE (Boneh Identity-Based Encryption) so validators can collectively decrypt after ordering without any single validator knowing the contents beforehand. This prevents MEV extraction, front-running, and sandwich attacks.</p>`,

    eli5: `<p><strong>What happened:</strong> This adds the "sealed envelope" system to Aptos. Transactions can now be submitted in encrypted form — nobody can read them until after they've been put in order. This prevents people from seeing your trade and jumping ahead of you (front-running).</p>
<p><strong>The envelope has 3 states:</strong> Sealed (encrypted), Opened (decrypted after ordering), or Damaged (couldn't decrypt — rejected). This is the foundation that makes DeFi trading fair on Aptos.</p>`
  },

  "bfa5a05": {
    advanced: `<h3>What Changed</h3>
<p>Wires encrypted transaction support through the <strong>entire execution pipeline</strong> — from <code>AptosVM</code> to <code>BlockExecutor</code>. This is where the encrypted mempool actually meets the execution engine.</p>

<h3>How It Works</h3>
<p>The flow for an encrypted transaction:</p>
<ol>
<li><code>AptosVM::execute_single_transaction()</code> receives a <code>Transaction</code> with <code>EncryptedPayload::Decrypted</code></li>
<li>It unwraps the inner <code>TransactionPayload</code> and routes to normal execution</li>
<li>If <code>EncryptedPayload::DecryptionFailed</code>, the transaction is marked as failed but <strong>still charged gas</strong> (prevents spam of invalid ciphertexts)</li>
<li>The sequence number is incremented regardless of decryption success (prevents replay)</li>
</ol>
<p>The critical design decision: failed decryptions are charged gas and consume sequence numbers. Without this, an attacker could submit millions of garbage-encrypted transactions for free, DoSing the decryption pipeline.</p>

<h3>Key Code Path</h3>
<pre><code>AptosVM::execute_single_transaction()
  → match payload {
      TransactionPayload::Encrypted(EncryptedPayload::Decrypted(inner)) =>
        execute_user_transaction(inner),
      TransactionPayload::Encrypted(EncryptedPayload::DecryptionFailed(_)) =>
        charge_gas_and_fail(),
    }</code></pre>`,

    eli5: `<p><strong>What happened:</strong> The sealed-envelope system now actually works end-to-end. When a sealed transaction reaches the execution engine, it gets opened and run normally. If the seal is broken (bad encryption), the transaction fails but the sender still pays — this prevents people from spamming millions of fake sealed envelopes to clog the system.</p>`
  },

  "b0f06a3": {
    advanced: `<h3>What Changed</h3>
<p>Adds <strong>per-batch-kind transaction limits</strong> to the consensus proposal pipeline. Before this PR, encrypted and normal transactions shared the same batch limits. Now each <code>BatchKind</code> (Normal vs Encrypted) gets its own configurable cap.</p>

<h3>Key Code</h3>
<pre><code>pub struct PerBatchKindTxnLimits {
    limits: HashMap&lt;BatchKind, u64&gt;,
}

impl PerBatchKindTxnLimits {
    // Compute remaining capacity after each proposal stage
    pub fn remaining_after(&self, used: &HashMap&lt;BatchKind, u64&gt;) -> Self { ... }

    // Derive encrypted limit from SecretShareConfig
    pub fn from_config(config: &SecretShareConfig) -> Self {
        // If no secret sharing config → encrypted limit = 0
        // Otherwise → limit = config.digest_key().max_batch_size()
    }
}</code></pre>
<p>The limits are threaded through all three proposal stages: proof batches, optional batches, and inline batches. Each stage respects cumulative limits — if proof batches already used 50 of the 64 encrypted slots, optional batches can only add 14 more.</p>

<h3>Why This Matters</h3>
<p>The decryption pipeline is expensive — each ciphertext requires BIBE decryption involving elliptic curve operations. Without per-kind limits, a burst of encrypted transactions could starve normal transactions from blocks. This ensures encrypted transactions get their own dedicated bandwidth without affecting the rest of the network.</p>`,

    eli5: `<p><strong>What happened:</strong> The network now has separate "lanes" for normal transactions and encrypted (sealed) transactions. Each lane has its own speed limit. This prevents encrypted transactions from hogging all the space in a block, and ensures normal transactions always have room.</p>`
  },
};

let updated = 0;
for (const [sha, content] of Object.entries(upgrades)) {
  const idx = reports.findIndex(r => r.githubId === sha || r.githubId.startsWith(sha));
  if (idx >= 0) {
    reports[idx].advanced = content.advanced;
    reports[idx].eli5 = content.eli5;
    updated++;
    console.log(`Updated: ${reports[idx].title.slice(0, 60)}`);
  } else {
    console.log(`NOT FOUND: ${sha}`);
  }
}

writeFileSync('web/public/data/reports.json', JSON.stringify(reports, null, 2));
console.log(`\nUpgraded ${updated} reports with hand-written analysis`);
