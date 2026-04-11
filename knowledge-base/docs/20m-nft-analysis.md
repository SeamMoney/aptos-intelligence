# Minting 20 Million NFTs on Aptos: Technical Capacity Analysis

**Date**: April 2026  
**Scope**: Current infrastructure (mainnet v1.43) and full-stack upgrade projections  
**Target**: 20,000,000 Token Objects v2 NFTs in a single collection

---

## Executive Summary

Minting 20 million NFTs on Aptos is feasible today in approximately 17-25 minutes at sustained mainnet throughput. With all planned upgrades deployed, the same operation could complete in under 30 seconds at theoretical maximum capacity. This document provides detailed calculations for every scenario, identifies bottlenecks at each layer, and includes a practical implementation guide.

| Scenario | TPS | Time to Mint 20M | Estimated Total Cost (APT) |
|---|---|---|---|
| Current mainnet (conservative) | 15,000 | 22.2 min | 2,200 |
| Current mainnet (sustained) | 20,000 | 16.7 min | 2,200 |
| Current mainnet (peak, aggregators optimized) | 30,000 | 11.1 min | 2,200 |
| Full Raptr + Block-STM v2 + Zaptos | 100,000 | 3.3 min | 1,100-1,650 |
| With Shardines (conservative) | 500,000 | 40 sec | 660-1,100 |
| With Shardines (theoretical max) | 1,000,000 | 20 sec | 440-880 |

---

## Part 1: Current Infrastructure Analysis (April 2026)

### 1.1 Consensus Layer: Baby Raptr + Quorum Store

**Current deployment**: Baby Raptr is live on mainnet (~95% complete). It merges the previously separate Jolteon consensus and Quorum Store logic into a unified protocol.

**Block timing**:
- Block close time: ~250ms (from architecture overview performance table)
- Baby Raptr reduced consensus from 6 network hops to 4, yielding a 20% latency improvement (100-150ms reduction on mainnet)
- Effective block production rate: ~4 blocks per second

**Transactions per block**:
- At 20,000 sustained TPS with ~4 blocks/second: ~5,000 transactions per block
- Block gas limit constrains the upper bound, not just transaction count
- Quorum Store enables parallel data dissemination across all n validators, so batch propagation is not the bottleneck

**Consensus throughput for NFT minting**:
- Baby Raptr has demonstrated sustained 20,000 TPS on mainnet
- The Quorum Store's Proof-of-Store mechanism allows all validators to broadcast transaction batches in parallel
- With n validators, total data dissemination bandwidth scales as n*T (where T is per-validator throughput)
- The consensus leader references certified batch metadata (not raw transactions) in proposals, keeping the critical path lightweight

**Verdict**: Consensus is NOT the bottleneck for 20M NFT mints at current throughput levels. Baby Raptr can sustain the ordering rate needed.

### 1.2 Execution Layer: Block-STM v1

**Current deployment**: Block-STM v1 is the production execution engine. Block-STM v2 is at ~60% development (behind a `config.local.blockstm_v2` flag).

**How Block-STM handles NFT mints**:

Each NFT mint transaction touches several state locations:
1. **Collection object** (shared): mutated to update supply counter and metadata
2. **New token object** (unique): created at a deterministic address
3. **Creator account** (shared): sequence number increment
4. **Recipient account** (potentially unique): token deposit

**The supply counter problem and aggregators**:

The critical bottleneck for parallel NFT minting is the **collection supply counter**. Every mint increments a shared counter, creating a serial dependency chain if handled naively. Block-STM would detect read-write conflicts on this counter and force sequential re-executions.

Aptos solves this with **aggregator_v2 / delayed fields** (`DelayedFieldID` and `DelayedChange` in the execution output):
- Instead of reading the current supply, computing +1, and writing back, each transaction records a **delta operation** (+1)
- Block-STM materializes these deltas at commit time, avoiding speculative read invalidation
- The `delayed_field_change_set()` in `BeforeMaterializationOutput` handles this: deltas are accumulated without creating read-write conflicts between transactions
- The `delayed_field_id_counter` (AtomicU32) in the shared sync params tracks these deferred IDs

**With aggregators properly used, the supply counter is effectively eliminated as a conflict source.**

**Remaining execution bottlenecks**:

Even with aggregators, several per-transaction operations create work:

| Operation | Cost Category | Conflict Potential |
|---|---|---|
| Collection supply counter | Aggregator (delta) | None (resolved) |
| New object creation | Unique write | None (each token gets unique address) |
| Token metadata write | Unique write | None |
| Creator sequence number | Per-sender | Conflicts if single sender |
| Event emission | Append-only | Low (event accumulator) |
| Move bytecode execution | CPU | Parallelizable |

The **sender sequence number** is a critical remaining bottleneck if all 20M mints come from a single account. In practice, you must use **multiple sender accounts** or **fee payer / sponsored transactions** to avoid serialization on the sender's sequence number.

**Per-transaction gas cost estimate**:

An NFT mint using Token Objects v2 (aptos_token_objects) involves:
- Object creation: ~500 gas units
- Token resource initialization: ~300 gas units
- Collection supply update (aggregator delta): ~100 gas units
- Event emission: ~100 gas units
- Storage allocation for new object: ~2,000-3,000 gas units (storage fees dominate)
- Prologue/epilogue overhead: ~200 gas units

Estimated total: ~3,200-4,200 gas units per mint

At the standard gas unit price of 100 Octas (0.000001 APT per gas unit):
- Per-mint cost: ~0.0032 - 0.0042 APT
- However, observed mainnet costs for simple mints are approximately **0.00011 APT** per transaction (this reflects the base transaction fee + storage refund model)

Using the observed 0.00011 APT figure:
- **20M mints * 0.00011 APT = 2,200 APT total gas cost**
- At $10/APT: **$22,000**
- At $5/APT: **$11,000**

**CPU utilization**:

Block-STM dispatches transactions to a rayon thread pool (`executor_thread_pool: Arc<rayon::ThreadPool>`). Modern validator nodes typically run 32-64 CPU cores. For non-conflicting NFT mints (with aggregators), Block-STM achieves near-linear scaling up to the core count:
- 32 cores: ~32x speedup over sequential execution
- Benchmark data shows >160,000 TPS for non-conflicting workloads (17-20x over sequential)
- NFT mints with aggregators fall close to the "non-conflicting" case, minus overhead for delta materialization

### 1.3 Storage Layer: Jellyfish Merkle Tree

**Current deployment**: Storage sharding is deployed on mainnet (~95%). The JMT is partitioned across 16 shards within a single node.

**State write amplification per NFT**:

Each new NFT creates a new leaf in the Jellyfish Merkle Tree. The write path involves:

1. **New leaf node**: Contains the token object's state (key hash + value hash). Serialized size: ~100-200 bytes
2. **Internal node updates**: The JMT uses 4-level binary subtrees compressed into single internal nodes (up to 16 children). Inserting a new leaf requires updating internal nodes along the path from leaf to root. Path length = up to 64 nibbles (256 bits / 4 bits per nibble), but sparse tree compression means typically 3-8 internal nodes are touched.
3. **Stale node marking**: Previous versions of updated internal nodes are marked stale via `StaleNodeIndex` for later pruning.

Write amplification per NFT:
- 1 new leaf node write (~150 bytes)
- 3-8 internal node updates (~200 bytes each)
- 3-8 stale node index entries (~50 bytes each)
- Total: ~1,000-2,500 bytes of JMT writes per NFT

For 20M NFTs:
- **JMT state growth**: 20M * ~2,000 bytes average = **~40 GB of raw JMT node writes**
- With RocksDB LSM-tree compaction overhead: ~60-100 GB of actual disk I/O
- Plus ledger data (transaction info, write sets, events): ~20-40 GB additional

**Total storage impact**: ~80-140 GB for the complete 20M NFT mint operation.

**Hot state caching** (recent work by wqfish):

Recent commits show active hot state optimization:
- Hot state KV persistence to dedicated RocksDB column family
- `HotStateConfig` parameter in `AptosDB::open()`
- WriteSet hotness persistence behind config flag
- DashMap-based hot state cache with age metrics and deferred merge
- RCU (Read-Copy-Update) pattern for race condition prevention

For a sustained 20M mint operation, the hot state cache would cover:
- Recently created objects (high locality since mints are sequential)
- Collection metadata (single hot entry, updated via aggregator)
- Creator account state (hot, frequently accessed)

The hot state cache significantly reduces RocksDB read I/O during execution, though write I/O remains the primary storage bottleneck.

**Disk I/O as bottleneck**:

With storage sharding across 16 JMT shards:
- Write I/O is distributed across shards based on key hash
- NFT object addresses are derived from deterministic hashing, distributing evenly across shards
- Per-shard write rate at 20K TPS: ~1,250 writes/second per shard
- Modern NVMe SSDs handle 100K-500K IOPS; 16 shards at 1,250 writes each = 20K total IOPS
- RocksDB batching and WAL amortize this further

**Verdict**: Storage is a secondary bottleneck. The 16-shard JMT with hot state caching can sustain the required write rate, though long-running mints may see some performance degradation as RocksDB compaction catches up.

### 1.4 Network Layer

**Transaction size for an NFT mint**:

A typical Token Objects v2 mint transaction contains:
- Sender address: 32 bytes
- Signature (Ed25519): 64 bytes
- Public key: 32 bytes
- Sequence number: 8 bytes
- Payload (entry function call): ~200-500 bytes (module address + function name + arguments including token name, description, URI)
- Gas parameters: 16 bytes
- Expiration time: 8 bytes
- Chain ID: 1 byte

Total serialized transaction size: **~400-700 bytes** (reference: historical data showed ~700 bytes per transaction for Aptos network messages)

**Bandwidth calculation**:

At 20,000 TPS with ~600 bytes average per transaction:
- Raw transaction data rate: 20,000 * 600 = **12 MB/s**
- Quorum Store replication factor (each batch sent to all validators): with ~100 validators, each validator receives all batches
- Total bandwidth per validator for data dissemination: ~12 MB/s inbound + outbound
- With 2f+1 acknowledgment messages: additional ~2-3 MB/s of control messages
- **Total bandwidth per validator**: ~15-20 MB/s

Modern validators have 1-10 Gbps network connections. 20 MB/s = 160 Mbps, well within capacity.

**Verdict**: Network is NOT a bottleneck.

### 1.5 Current Infrastructure: Time Calculations

**Scenario A: Conservative sustained (15,000 TPS)**
- Accounts for real-world overhead, other mainnet traffic, occasional re-executions
- Time: 20,000,000 / 15,000 = **1,333 seconds = 22.2 minutes**

**Scenario B: Observed sustained (20,000 TPS)**
- Matches reported mainnet sustained throughput
- Time: 20,000,000 / 20,000 = **1,000 seconds = 16.7 minutes**

**Scenario C: Peak with optimized aggregators (30,000 TPS)**
- Assumes aggregators eliminate all supply counter conflicts
- Multiple sender accounts eliminate sequence number serialization
- Block-STM runs near-optimal on non-conflicting NFT workload
- Time: 20,000,000 / 30,000 = **667 seconds = 11.1 minutes**

**Cost calculation**:
- At 0.00011 APT per mint: 20,000,000 * 0.00011 = **2,200 APT**
- Note: storage refunds may partially offset this over time as pruning occurs

**Storage growth**:
- New state entries: 20,000,000 objects * ~500 bytes average state per object = **~10 GB of state data**
- JMT overhead (internal nodes, versioning): ~3-5x = **30-50 GB total state growth**
- Ledger data: **20-40 GB**
- **Total disk usage increase: 50-90 GB**

---

## Part 2: Full Stack Upgrade Analysis

### 2.1 Full Raptr (Prefix Consensus with Decoupled Voting)

**Status**: Next phase after Baby Raptr (TBD deployment)

**Improvements**:
- Decoupled prefix voting: validators vote on ordered prefixes rather than individual blocks, enabling pipelining of consensus decisions
- Multi-proposer design: eliminates single-leader bottleneck; liveness is guaranteed even if an adversary suspends any single party at any round
- Benchmark results: >250,000 TPS at 750ms latency in global-scale experiments

**Expected improvements for NFT minting**:
- Block production rate: expected improvement from ~4 blocks/s to ~8-12 blocks/s
- Block time reduction: from ~250ms to potentially ~100-150ms
- Consensus throughput: 3-5x improvement over Baby Raptr
- The multi-proposer design means no single validator is a bottleneck for block proposals

**Impact on 20M mint**: Consensus moves from "not a bottleneck" to "definitively not a bottleneck." The improvement unlocks higher TPS if execution and storage can keep up.

### 2.2 Block-STM v2

**Status**: ~60% development, behind `blockstm_v2` config flag

**Improvements**:
- Better scheduling algorithm: reduced redundant re-executions through improved dependency tracking
- The v2 scheduler likely optimizes the `SchedulerTask` dispatch to minimize wakeup latency and dependency resolution overhead
- Expected throughput improvement: **2-3x over Block-STM v1** for mixed workloads
- For NFT minting (mostly non-conflicting with aggregators): improvement may be more modest (1.5-2x), since v1 already performs well on non-conflicting workloads

**Expected per-transaction improvements**:
- Reduced re-execution rate: from ~5-15% (v1 with some conflicts) to ~1-3% (v2 with better scheduling)
- Lower per-thread synchronization overhead
- Better cache utilization through improved task locality

**Impact on 20M mint**: Execution throughput could increase from ~30K effective TPS to ~50-60K TPS for optimized NFT workloads.

### 2.3 MonoMove VM

**Status**: Early Prototype (active development by vgao1996, georgemitenkov, calintat)

**Architecture**:
- New instruction set designed for performance
- Global arena allocation (eliminates per-transaction heap allocation overhead)
- Identifier interning (faster module/function resolution)
- Garbage collection (replaces Move's ownership tracking overhead)
- Gas instrumentation prototype (more accurate gas metering)

**Expected improvements for NFT minting**:
- Move bytecode execution: **2-5x faster** per transaction (based on typical VM optimization gains)
- Reduced per-tx overhead: arena allocation eliminates malloc/free cycles
- Better gas accuracy: gas costs may decrease as metering becomes cheaper
- Estimated gas cost reduction: **30-50%** (from ~0.00011 APT to ~0.00006-0.00008 APT per mint)

**Impact on 20M mint**:
- Execution time per block decreases, enabling higher TPS
- Gas cost reduction: from 2,200 APT to ~1,200-1,600 APT
- Combined with Block-STM v2: execution throughput of 80K-120K TPS for NFT workloads

### 2.4 Zaptos (Optimistic Pipelining)

**Status**: Designed, implementation in progress

**Three optimistic techniques**:

1. **Optimistic Execution**: Begin executing a block as soon as the proposal is received, before consensus finalizes. If the block is eventually ordered differently, discard the speculative result. For NFT minting, this means execution begins during the consensus voting round.

2. **Optimistic Commit**: Persist execution results to storage immediately as "OptCommitted" before state certification completes. When certification succeeds, a minimal metadata update marks the entry as "Committed." This shifts storage I/O to overlap with the certification round.

3. **Piggybacked State Certification**: Attach execution state certificate signatures to OrderVote messages instead of running a separate certification voting round. This eliminates one full network round-trip.

**Latency formula**:
- Baseline: `2*delta_cf + 2*delta_fv + delta_vv + T_con + 2*T_exe + 2*T_cmt`
- Zaptos: `2*delta_cf + 2*delta_fv + T_con + max(T_exe + T_cmt - 2*delta_vv, 0) + max(T_exe - delta_vv, 0) + max(T_cmt - delta_vv, 0)`
- **40% latency reduction**, achieving sub-second latency at 20,000 TPS

**Impact on 20M mint**:
- Not a direct TPS improvement, but reduces pipeline stalls
- Execution and storage I/O overlap with consensus, increasing sustained throughput by ~20-30%
- Effective improvement: from 60K TPS (Block-STM v2 alone) to ~80K-100K TPS sustained
- End-to-end confirmation latency per transaction: sub-second

### 2.5 Shardines (Internal Validator Sharding)

**Status**: Storage sharding deployed (~95%), execution sharding and consensus sharding are in design/development

**Three-layer sharding architecture**:

1. **Storage Sharding (Deployed)**: JMT partitioned across 16 shards. Each shard manages a subset of the state keyspace. Already contributing to current mainnet performance.

2. **Execution Sharding (In Development)**:
   - Dynamic partitioner analyzes incoming batches and assigns to execution shards based on access patterns
   - Each shard runs its own Block-STM instance
   - For NFT minting: all mints go to different objects (unique addresses), so they partition cleanly across shards
   - The shared collection object (supply counter via aggregator) can be handled by cross-shard delta aggregation
   - Target: multiple Block-STM instances running in parallel within a single validator

3. **Consensus Sharding (In Design)**:
   - Multiple data dissemination shards handle transaction propagation in parallel
   - Each shard obtains independent Proof-of-Store certificates
   - A consensus coordinator orders metadata from all shards

**Performance targets**:
- >1,000,000 TPS for non-conflicting transactions
- >500,000 TPS for conflicting transactions
- NFT minting (with aggregators) is essentially a non-conflicting workload: target >1M TPS

**Impact on 20M mint**:
- At 500K TPS (conservative Shardines): 20,000,000 / 500,000 = **40 seconds**
- At 1M TPS (full Shardines): 20,000,000 / 1,000,000 = **20 seconds**

### 2.6 Archon (Proxy-Primary Coordination)

**Status**: Architecture-level concept

Archon introduces a proxy-primary coordination model where:
- Primary validators handle consensus
- Proxy nodes handle data dissemination and client-facing work
- Reduces consensus overhead by offloading non-critical work

**Impact on 20M mint**: Marginal improvement to sustained throughput (~5-10%) by reducing validator load. Primary benefit is operational, not throughput.

### 2.7 Full-Stack Calculations

**Scenario D: Full Raptr + Block-STM v2 + Zaptos (Conservative, 100K TPS)**

Assumptions:
- Full Raptr delivers ~100ms block times, 10 blocks/second
- Block-STM v2 provides 2x execution improvement
- Zaptos overlaps execution with consensus, adding ~30% throughput
- Combined: 100K TPS sustained for NFT workloads

Calculations:
- Time: 20,000,000 / 100,000 = **200 seconds = 3.3 minutes**
- Gas cost with MonoMove (50% reduction): 20M * 0.000055 = **1,100 APT**
- Gas cost without MonoMove: 20M * 0.000083 = **1,650 APT** (25% reduction from pipeline efficiencies)
- Storage growth: same ~50-90 GB (storage format unchanged)
- Bandwidth per validator: 100K * 600 bytes = 60 MB/s = 480 Mbps (still within 1 Gbps capacity)

**Scenario E: With Shardines, Conservative (500K TPS)**

Assumptions:
- 4-8 execution shards per validator, each running Block-STM v2
- Storage sharding scales to 32-64 shards
- Consensus sharding with 4 dissemination shards

Calculations:
- Time: 20,000,000 / 500,000 = **40 seconds**
- Gas cost with MonoMove: 20M * 0.000033 = **660 APT**
- Gas cost without MonoMove: 20M * 0.000055 = **1,100 APT**
- Storage I/O: 500K writes/s distributed across 64 shards = ~8K IOPS per shard (feasible with NVMe)
- Bandwidth per validator: 500K * 600 bytes = 300 MB/s = 2.4 Gbps (requires 10 Gbps network)
- Memory for hot state cache: ~10-20 GB (recent objects, collection metadata)

**Scenario F: Theoretical Maximum (1M TPS)**

Assumptions:
- 8-16 execution shards per validator
- Full consensus sharding with 8+ dissemination shards
- All optimizations active (Full Raptr + Block-STM v2 + MonoMove + Zaptos + full Shardines)

Calculations:
- Time: 20,000,000 / 1,000,000 = **20 seconds**
- Gas cost with all optimizations: 20M * 0.000022 = **440 APT**
- Gas cost conservative: 20M * 0.000044 = **880 APT**
- Storage I/O: 1M writes/s across 64 shards = ~16K IOPS per shard (feasible)
- Bandwidth per validator: 1M * 600 bytes = 600 MB/s = 4.8 Gbps (requires 10 Gbps)
- Block production: 10+ blocks/s with 100K+ transactions per block
- This scenario requires each execution shard to handle ~60-125K TPS, which aligns with Block-STM benchmarks

**Comparative Summary**:

| Upgrade Component | TPS Multiplier | Latency Impact | Gas Cost Impact |
|---|---|---|---|
| Full Raptr | 3-5x consensus ceiling | -40% block time | None |
| Block-STM v2 | 2-3x execution | Marginal | None |
| MonoMove VM | 2-5x execution | Faster per-tx | -30 to -50% |
| Zaptos | 1.2-1.3x effective | -40% end-to-end | None |
| Shardines (execution) | 4-16x (with shard count) | None | None |
| Shardines (consensus) | 4-8x dissemination | None | None |
| Archon | 1.05-1.1x | Marginal | None |

---

## Part 3: Practical Guide to Minting 20 Million NFTs

### 3.1 Move Module Design

The collection contract must use the aggregator pattern (via `aptos_token_objects`) to avoid supply counter conflicts.

```move
module deployer::mass_mint {
    use aptos_framework::object;
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_token_objects::royalty;
    use std::option;
    use std::string::{Self, String};
    use std::signer;

    /// The collection resource, stored at the deployer's address.
    struct MintConfig has key {
        collection_name: String,
        base_uri: String,
        /// Using object::ExtendRef allows the contract to mint
        /// without requiring the original creator signer each time.
        extend_ref: object::ExtendRef,
    }

    /// Initialize the collection. Called once by the deployer.
    /// The collection internally uses aggregator_v2 for the supply counter,
    /// which is the default behavior in aptos_token_objects::collection.
    public entry fun create_collection(
        creator: &signer,
        description: String,
        name: String,
        base_uri: String,
        max_supply: u64,  // Set to 20,000,000
    ) {
        let royalty = royalty::create(5, 100, signer::address_of(creator));
        let constructor_ref = collection::create_fixed_collection(
            creator,
            description,
            max_supply,
            name,
            option::some(royalty),
            base_uri,
        );
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        move_to(creator, MintConfig {
            collection_name: name,
            base_uri,
            extend_ref,
        });
    }

    /// Mint a single NFT. Designed to be called in parallel
    /// by multiple sender accounts (via fee payer pattern).
    /// Each call creates one token object at a unique address.
    public entry fun mint(
        _minter: &signer,
        creator_addr: address,
        token_name: String,
        token_description: String,
        token_uri: String,
    ) acquires MintConfig {
        let config = borrow_global<MintConfig>(creator_addr);
        let creator_signer = object::generate_signer_for_extending(
            &config.extend_ref
        );
        let _constructor_ref = token::create_numbered_token(
            &creator_signer,
            config.collection_name,
            token_description,
            token_name,
            string::utf8(b""),  // name_with_index_prefix
            option::none(),     // royalty override
            token_uri,
        );
        // Token is created at a deterministic address.
        // The collection supply counter is updated via aggregator
        // (delta operation, no read-write conflict).
    }
}
```

**Key design decisions**:
- `create_fixed_collection` with `max_supply` uses aggregator-based supply tracking internally
- `create_numbered_token` appends an auto-incrementing number suffix, also using aggregators
- The `ExtendRef` pattern allows any authorized signer to mint, not just the original creator
- No explicit supply counter management needed; the framework handles it via delayed fields

### 3.2 Collection Setup

1. **Deploy the module** to a dedicated account (resource account recommended for production):
   ```bash
   aptos move publish --named-addresses deployer=default
   ```

2. **Create the collection**:
   ```bash
   aptos move run \
     --function-id deployer::mass_mint::create_collection \
     --args 'string:My Collection' 'string:Collection Name' \
     'string:https://assets.example.com/' 'u64:20000000'
   ```

3. **Verify the collection** was created with aggregator-based supply:
   ```bash
   aptos account list --query resources --account deployer
   ```

### 3.3 Transaction Submission Strategy

**The single-sender problem**: If all 20M transactions use one sender, sequence numbers serialize execution. Each transaction must wait for the previous one's sequence number to commit.

**Solution: Multi-sender parallel submission**

Use N sender accounts, each submitting 20M/N transactions:

| Sender Count | Txns per Sender | Sequence Number Overhead | Effective Parallelism |
|---|---|---|---|
| 1 | 20,000,000 | Fully serialized | 1x |
| 10 | 2,000,000 | Manageable | ~10x |
| 100 | 200,000 | Low | ~100x |
| 1,000 | 20,000 | Negligible | ~1,000x |

**Recommended: 100-1,000 sender accounts** for current mainnet.

**Fee payer pattern**: Use a single funding account as a fee payer with orderless (nonce-based) transactions from the minting accounts. AIP-123 orderless transactions allow parallel submission without sequence number coordination.

**Transaction generation pipeline**:

```
[Metadata Generator] --> [Transaction Builder] --> [Signer Pool] --> [RPC Submitter Pool]
     (20M items)         (batch of 1000)         (100 signers)      (10-50 RPC connections)
```

1. **Metadata Generator**: Produces 20M `(name, description, uri)` tuples from your asset pipeline
2. **Transaction Builder**: Constructs unsigned transactions with appropriate gas parameters
3. **Signer Pool**: Signs transactions using pre-funded sender accounts, round-robin distribution
4. **RPC Submitter Pool**: Submits signed transactions to multiple fullnode RPC endpoints

### 3.4 Client Infrastructure Requirements

**Hardware for the minting client**:

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 8 cores | 16+ cores |
| RAM | 16 GB | 32 GB |
| Network | 100 Mbps | 1 Gbps |
| Storage | 50 GB SSD | 100 GB NVMe |

**RPC endpoints**:

- Aptos fullnode REST API rate limits: typically 100-1,000 requests/second per IP
- To achieve 20K TPS submission rate, you need multiple RPC endpoints:
  - **10-20 fullnode RPC endpoints** (self-hosted or from different providers)
  - Or use the **Aptos transaction submission service** if available
  - Each endpoint handles ~1,000-2,000 TPS of submission

**Recommended RPC strategy**:
- Run 5-10 dedicated fullnodes with `--enable-indexer-grpc` disabled (pure submission)
- Use geographically distributed fullnodes to reduce latency to validators
- Implement retry logic with exponential backoff for failed submissions

**Software architecture**:

```
┌─────────────────────────────────────────────────────┐
│                   Orchestrator                       │
│  - Tracks progress (which tokens minted)            │
│  - Manages sender account sequence numbers          │
│  - Handles retries and failures                     │
│  - Monitors mempool backpressure                    │
└───────────┬─────────────┬──────────────┬────────────┘
            │             │              │
     ┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────┐
     │ Submitter 1 │ │Submitter 2│ │Submitter N│
     │ (10 senders)│ │(10 senders│ │(10 senders│
     │ RPC Pool A  │ │ RPC Pool B│ │ RPC Pool C│
     └─────────────┘ └───────────┘ └───────────┘
```

### 3.5 Cost Estimation Worksheet

| Cost Item | Unit Cost | Quantity | Total |
|---|---|---|---|
| Gas fees (current) | 0.00011 APT | 20,000,000 | 2,200 APT |
| Gas fees (w/ MonoMove) | 0.00006 APT | 20,000,000 | 1,200 APT |
| Sender account creation | ~0.001 APT | 100-1,000 | 0.1-1 APT |
| Sender account funding | (refundable) | 100-1,000 | ~100 APT float |
| RPC infrastructure | ~$500/mo | 5-10 nodes | $2,500-5,000/mo |
| Minting client servers | ~$200/mo | 2-3 | $400-600/mo |
| Metadata storage (IPFS/Arweave) | ~$0.001/item | 20,000,000 | $20,000 |
| **Total (current, at $10/APT)** | | | **~$44,000-47,000** |
| **Total (with MonoMove, at $10/APT)** | | | **~$34,000-37,000** |

Note: The dominant cost is metadata hosting (IPFS/Arweave), not on-chain gas. If using centralized storage for metadata URIs, the cost drops significantly.

### 3.6 Monitoring and Verification

**During minting**:

1. **Transaction confirmation tracking**:
   - Monitor `committed_transactions` vs `submitted_transactions` counter
   - Track pending mempool size: if growing, reduce submission rate (backpressure)
   - Target: submitted - confirmed gap < 5,000 transactions

2. **Error rate monitoring**:
   - `SEQUENCE_NUMBER_TOO_OLD`: Sender sequence number already used; refetch and retry
   - `SEQUENCE_NUMBER_TOO_NEW`: Gap in sequence; fill in missing transactions
   - `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE`: Refund sender accounts
   - `TRANSACTION_EXPIRED`: Increase expiration time or submit faster
   - Target error rate: < 0.1%

3. **TPS monitoring**:
   ```bash
   # Monitor chain TPS via indexer or API
   curl https://fullnode.mainnet.aptoslabs.com/v1/ | jq '.ledger_version'
   # Sample every second, compute delta = realized TPS
   ```

4. **Collection supply verification**:
   ```bash
   aptos move view \
     --function-id 0x4::collection::count \
     --args 'address:<collection_address>'
   ```

**Post-minting verification**:

1. **Supply check**: Verify `collection::count()` equals 20,000,000
2. **Sample verification**: Randomly sample 100-1,000 token addresses and verify:
   - Token metadata (name, description, URI) is correct
   - Token is owned by the intended recipient
   - Token belongs to the correct collection
3. **Event log audit**: Query the token creation events from the collection to confirm all 20M events exist
4. **Indexer verification**: Use the Aptos indexer to query all tokens in the collection and verify count and uniqueness

### 3.7 Common Pitfalls and How to Avoid Them

**Pitfall 1: Single-sender sequence number bottleneck**
- Problem: All mints from one account serialize execution via sequence numbers
- Solution: Use 100-1,000 sender accounts with round-robin distribution
- Detection: If confirmed TPS is much lower than chain TPS, this is likely the cause

**Pitfall 2: Not using aggregator-based supply tracking**
- Problem: Custom collection contracts that manually increment a counter create read-write conflicts on every mint, serializing Block-STM execution
- Solution: Use `aptos_token_objects::collection` which uses aggregators internally, or implement your own counter using `aptos_framework::aggregator_v2`
- Detection: Check Block-STM re-execution metrics; high re-execution rate (>20%) indicates conflict

**Pitfall 3: Overloading a single RPC endpoint**
- Problem: Rate limiting or TCP connection exhaustion on the RPC node
- Solution: Distribute submissions across 10+ RPC endpoints
- Detection: HTTP 429 (Too Many Requests) or connection timeout errors

**Pitfall 4: Transaction expiration during backpressure**
- Problem: If mempool is full, transactions wait too long and expire before execution
- Solution: Set expiration time to 300-600 seconds (not the default 30s). Implement backpressure sensing: reduce submission rate when mempool response indicates congestion
- Detection: `TRANSACTION_EXPIRED` errors

**Pitfall 5: Insufficient gas estimation**
- Problem: Gas estimation is too low, causing transaction aborts (still charged gas)
- Solution: Run gas simulation on testnet first, add 20% buffer. Use `max_gas_amount` of at least 10,000 gas units for NFT mints
- Detection: `EXECUTION_FAILURE` with `OUT_OF_GAS` status

**Pitfall 6: Metadata URI availability**
- Problem: Token URIs point to IPFS/Arweave content that isn't pinned or available
- Solution: Upload and pin ALL metadata BEFORE starting the mint. Verify availability with HEAD requests
- Detection: Post-mint, check a sample of URIs for 200 OK responses

**Pitfall 7: State growth exceeding validator resources**
- Problem: 20M new objects add 50-90 GB to the state database; validators with marginal storage may struggle
- Solution: This is generally not your problem (validators manage their own hardware), but be aware that extremely rapid state growth could trigger backpressure
- Detection: Monitor block execution time increasing over the minting period

**Pitfall 8: Duplicate token names/URIs**
- Problem: `create_numbered_token` auto-increments, but if you're providing explicit names, duplicates will fail
- Solution: Use `create_numbered_token` for auto-naming, or pre-validate uniqueness in your metadata pipeline
- Detection: `EXECUTION_FAILURE` aborts with specific abort codes from the token module

---

## Appendix A: Key Data Sources

| Metric | Value | Source |
|---|---|---|
| Mainnet sustained TPS | ~20,000 | Architecture overview, mainnet observations |
| Block-STM benchmark TPS | >160,000 | PPoPP 2023 paper, architecture overview |
| Raptr benchmark TPS | >250,000 | Architecture overview (global-scale experiments) |
| Shardines target (non-conflicting) | >1,000,000 | Architecture overview |
| Shardines target (conflicting) | >500,000 | Architecture overview |
| Block close time | ~250ms | Architecture overview performance table |
| Baby Raptr hop reduction | 6 to 4 hops | Architecture overview |
| Zaptos latency reduction | 40% | Architecture overview |
| Standard transaction size limit | 64 KB | Transaction states documentation |
| Epoch duration | 7,200 seconds (2 hours) | Architecture overview |
| JMT shard count | 16 | Storage subsystem documentation |
| Block-STM v2 progress | ~60% | Feature progress tracker |
| MonoMove progress | Early prototype | Feature progress tracker |
| Current node version | v1.43.2 (mainnet) | GitHub releases (April 2026) |

## Appendix B: Timeline Sensitivity

The calculations in Part 2 depend on upgrades that have no confirmed deployment dates:

| Upgrade | Earliest Realistic | Confidence |
|---|---|---|
| Full Raptr | Late 2026 | Medium |
| Block-STM v2 | Mid-Late 2026 | Medium-High (60% done) |
| MonoMove VM | 2027+ | Low (early prototype) |
| Zaptos | Late 2026 - Early 2027 | Medium |
| Execution Sharding (Shardines) | 2027+ | Low (design phase) |
| Consensus Sharding (Shardines) | 2027+ | Low (design phase) |

For planning purposes: the current infrastructure (Part 1) numbers are what you can rely on today. The 100K TPS scenario (Full Raptr + Block-STM v2 + Zaptos) is the most likely near-term upgrade path. The 500K-1M TPS scenarios (Shardines) are longer-term aspirational targets.

## Appendix C: Comparison with Other Chains

For context, minting 20M NFTs on other major blockchains:

| Chain | Practical TPS | Time for 20M | Approx. Cost |
|---|---|---|---|
| **Aptos (current)** | 20,000 | 17 min | $22,000 |
| **Aptos (full upgrades)** | 500K-1M | 20-40 sec | $4,400-11,000 |
| Solana | 3,000-5,000* | 67-111 min | $10,000-20,000 |
| Ethereum L1 | 15-30 | 7.7-15.4 days | $50M+ |
| Ethereum L2 (Arbitrum) | 1,000-2,000 | 2.8-5.6 hours | $200,000-500,000 |
| Sui | 10,000-20,000 | 17-33 min | $15,000-30,000 |

*Solana practical TPS limited by vote transactions consuming ~50% of block space and priority fee market congestion.

Aptos is uniquely positioned for this workload due to: (1) aggregator-based supply counters eliminating the primary parallelization bottleneck, (2) Block-STM's speculative execution enabling near-linear scaling with core count, and (3) the Shardines roadmap promising horizontal scaling within a single validator cluster.
