# Aptos Architecture Deep Reference

This document provides a comprehensive technical reference for the Aptos blockchain architecture, covering transaction lifecycle, parallel execution, consensus, state storage, the Move VM, encrypted mempool, optimistic pipelining, and internal sharding.

---

## 1. Transaction Lifecycle End-to-End

A transaction on Aptos traverses five stages from client submission to permanent commitment.

**Stage 1 -- Submission.** A client constructs a signed transaction containing a payload (entry function call or script), sender address, sequence number, gas parameters, and expiration time. The client submits this to a fullnode's REST service over HTTPS.

**Stage 2 -- Mempool Admission.** The fullnode validates the transaction: it checks the signature against the sender's on-chain authentication key, verifies the sequence number matches or exceeds the account's current sequence number, confirms sufficient gas balance, and ensures the transaction has not expired. Valid transactions enter the in-memory mempool and are forwarded to validator mempools via inter-node gossip.

**Stage 3 -- Ordering (Consensus).** The consensus layer selects a leader validator based on a deterministic formula incorporating reputation and stake weight. The leader pulls certified transaction batches from the Quorum Store layer and proposes a block containing batch metadata (not raw transactions). Validators vote on the proposal. With 2f+1 agreeing votes (where n = 3f+1 validators), the block is ordered.

**Stage 4 -- Execution.** Once ordered, the block enters the execution pipeline. The execution engine invokes Block-STM, which speculatively executes all transactions in parallel across multiple threads. The Move VM processes each transaction's bytecode, producing a write set (state mutations), events, and gas charges. Block-STM's MVCC layer validates all reads against a preset serialization order and re-executes any transaction whose speculative reads were invalidated. The final output is a deterministic state delta and a new Merkle root hash.

**Stage 5 -- Certification and Commit.** Validators sign the execution result (state root hash). Once 2f+1 execution certificates are collected, the block is certified. The write set is applied to persistent storage (RocksDB), the Jellyfish Merkle Tree is updated, events are appended to the event accumulator, and the ledger version increments. Fullnodes sync the committed state and serve it to clients.

The deterministic function `Apply(S_{i-1}, T_i) -> S_i` ensures every honest node arrives at the same state. Sequence numbers increment atomically per committed transaction, preventing replays.

---

## 2. Block-STM Parallel Execution

Block-STM is Aptos's parallel execution engine, published at PPoPP 2023 and adopted by multiple other chains including Polygon, Sei, and Starknet. It achieves over 160,000 TPS in benchmarks -- a 17-20x improvement over sequential execution.

**MVCC (Multi-Version Concurrency Control).** Block-STM maintains a multi-version data structure where each write from transaction T_i at version i is stored alongside its incarnation number. When transaction T_j reads a memory location, `MVMemory.read` returns the value written by the highest-versioned transaction T_k (where k < j in the preset order). This is the "best guess" for speculative execution.

**Speculative Execution.** All transactions in a block are dispatched to worker threads simultaneously. Each thread executes its assigned transaction optimistically, reading from the multi-version store and recording its read-set and write-set.

**Validation.** After execution, each transaction is validated by checking whether every value in its read-set still matches the latest version in the multi-version store. If all reads are consistent with the preset serialization order, the transaction passes validation.

**Re-execution on Conflict.** When validation fails (another transaction wrote a new value to a location that was speculatively read), the transaction is aborted. Its write-set entries are marked as ESTIMATION in the multi-version store, signaling dependent transactions to pause and wait. The aborted transaction is re-executed with updated values. This process converges because the preset block order bounds dependency chains.

**Collaborative Scheduling.** A novel cooperative scheduler assigns execution and validation tasks to threads dynamically, avoiding redundant work. Threads coordinate to ensure that once a transaction's dependencies are resolved, it is re-executed promptly.

The result is deterministic: despite parallel execution, the output matches a serial execution in the preset transaction order.

---

## 3. Quorum Store: Decoupling Data Dissemination from Ordering

Quorum Store is based on Narwhal, the peer-reviewed protocol that separates data dissemination from metadata ordering.

**Data Dissemination.** All n validators continuously broadcast batches of transactions to each other in parallel. Each batch is a set of serialized transactions with a batch identifier. When a validator receives a batch, it signs an acknowledgment. Once a validator collects 2f+1 acknowledgments for a batch, it forms a Proof-of-Store (PoS) certificate, proving the batch is available to a quorum.

**Metadata Ordering.** The consensus leader does not include raw transactions in its block proposal. Instead, it references certified batch identifiers along with their PoS certificates. Consensus agrees on the ordered sequence of batch metadata. Since each certified batch uniquely maps to an ordered list of transactions, this implicitly orders all transactions.

**Horizontal Scalability.** Because data dissemination is parallelizable and independent of the consensus critical path, throughput scales linearly with additional hardware. Adding more machines to run Quorum Store increases data dissemination bandwidth without changing the consensus protocol. With n validators, the system can broadcast nT transactions per second, where T is per-validator throughput.

---

## 4. Raptr / Prefix Consensus: Multi-Proposer BFT

Raptr is Aptos's next-generation consensus protocol, achieving over 250,000 TPS at 750ms latency in global-scale experiments.

**Prefix Consensus Paradigm.** Unlike classical single-value consensus, prefix consensus ensures that committed outputs across all honest participants maintain consistent prefix relationships. If one honest validator commits sequence [B1, B2, B3], another can only commit a prefix of or extension of this sequence -- never a conflicting order. This generalizes agreement to ordered sequences.

**Integration of Leader-Based and DAG-Based Approaches.** Raptr combines the low-latency properties of leader-based protocols (derived from Jolteon) with the high-throughput parallel data dissemination of DAG-based BFT systems. The core insight is that data can be disseminated by all validators in parallel (like a DAG), while a lightweight leader-based protocol orders the resulting metadata with minimal latency.

**Baby Raptr (Production Stage 1).** Baby Raptr, deployed on mainnet, merges the previously-separate Jolteon consensus and Quorum Store logic. The proposer optimistically includes batch digests in the block without waiting for full Proof-of-Store certificates. Validators independently retrieve and verify batch contents during voting. This reduces consensus from six network hops to four, yielding a 20% latency improvement (100-150ms) on mainnet.

**Full Raptr.** The full protocol adds decoupled prefix voting and prefix commit, further reducing latency and increasing censorship resistance through leaderless multi-proposer designs. In a leaderless protocol, liveness is guaranteed even if an adversary suspends any single party at any round.

---

## 5. Jellyfish Merkle Tree and State Storage

Aptos stores all on-chain state in a Jellyfish Merkle Tree (JMT), a space-optimized 256-bit sparse Merkle tree.

**Structure.** The JMT is a binary trie where keys are 256-bit hashes of state keys (account address + resource type). Any subtree containing zero or one leaf node is replaced by a placeholder or the leaf itself, avoiding hashing across many empty levels. Internal nodes represent 4-level binary trees (16 children, analogous to Ethereum Patricia Merkle branch nodes). Leaf nodes store the actual state value.

**Versioning.** Every committed transaction creates a new version of the tree. The JMT uses a monotonically increasing version-based key schema, optimized for write amplification on LSM-tree-based storage engines like RocksDB. Two separate RocksDB instances store ledger data and Merklized state data.

**In-Memory Caching.** An in-memory, lock-free sparse Merkle tree implementation caches recent state and works with Block-STM to facilitate parallel global state updates. The execution engine's "scratchpad" holds in-memory Merkle accumulator copies for computing speculative state root hashes before consensus finalization.

**Storage Layout.** Node data is stored as key-value pairs where the key is the node key (combining version and path bits) and the value is the serialized node. The tree implementation itself is stateless -- it computes R/W operations and produces intermediate results in a batch for the storage layer to commit atomically.

---

## 6. Move VM Execution

The Move Virtual Machine (MoveVM) is the execution runtime for all smart contract logic on Aptos.

**Bytecode Verification.** Before execution, every Move module undergoes bytecode verification ensuring type safety, resource safety (no duplication or loss of resources), and reference safety. This happens at module publish time and is cached.

**Transaction Processing.** When the execution engine hands a transaction to the MoveVM, it: (1) deserializes the transaction payload to identify the target module, function, and arguments; (2) loads the relevant modules from the module cache or storage; (3) executes the bytecode in a stack-based interpreter; (4) applies the resulting changeset (resource mutations, module publishes, event emissions) to the multi-version data structure.

**Resource Model.** Move's linear type system enforces that resources (structs with the `key` ability) cannot be copied or dropped unless explicitly permitted. This provides compile-time guarantees against double-spending and asset loss. The `store` ability allows nesting within resources; the `copy` and `drop` abilities opt into duplication and destruction respectively.

**Static Dispatch.** All function calls in Move are statically dispatched -- there is no dynamic dispatch or virtual function tables. This enables precise static analysis of dependencies and simplifies parallel execution scheduling.

**Gas Metering.** Every bytecode instruction has an associated gas cost defined in the on-chain gas schedule. Execution halts if the gas budget is exhausted, and the transaction is marked as aborted (but still committed, consuming gas).

---

## 7. Encrypted Mempool (Batched Identity-Based Encryption)

Aptos's encrypted mempool provides native MEV protection by hiding transaction payloads from submission until execution.

**Design.** Users encrypt transaction payloads before submission. The ciphertexts propagate through the mempool and are included in blocks in encrypted form. Transaction details remain hidden during ordering -- validators cannot read payloads to frontrun, censor selectively, or extract MEV.

**Batched Threshold Encryption.** Aptos Labs developed a novel batched threshold encryption scheme building on identity-based encryption (IBE) principles. Rather than decrypting each transaction individually, validators collectively decrypt entire batches of transactions in a single operation. This reduces both communication and computation overhead by orders of magnitude compared to per-transaction threshold decryption.

**Decryption Flow.** After consensus orders a block of encrypted transactions, validators execute a threshold decryption protocol. Each validator contributes a partial decryption share; once 2f+1 shares are combined, the batch is decrypted. The decrypted transactions then enter the execution pipeline (Block-STM) as normal.

**Security Properties.** No new trust assumptions are introduced -- the same BFT threshold (2f+1 of 3f+1) that secures consensus also governs decryption. An adversary controlling fewer than f+1 validators cannot decrypt transactions before they are ordered. This eliminates frontrunning, sandwich attacks, and order-flow exploitation at the protocol level.

---

## 8. Zaptos: Optimistic Pipelining

Zaptos reduces end-to-end transaction latency by 40% through three optimistic techniques applied to Aptos's pipelined architecture.

**Optimistic Execution.** Validators and fullnodes begin executing a block as soon as they receive the proposal, before consensus ordering finalizes. Since the execution result depends only on the block's content and the parent state (not on whether consensus has committed it yet), this speculation is safe -- if consensus ultimately orders a different block, the speculative execution is discarded.

**Optimistic Commit.** After execution completes, the resulting state is persisted to storage immediately as "OptCommitted," before the state certification round completes. When certification eventually succeeds, only a minimal metadata update marks the entry as fully "Committed." This shifts storage I/O to overlap with the certification round.

**Piggybacking State Certification.** Validators attach their execution state certificate signatures to their final consensus messages (OrderVote) rather than running a separate certification voting round. This merges certification with the last consensus hop, eliminating one full network round-trip from the pipeline.

**Latency Formula.** The baseline pipeline latency is `2*delta_cf + 2*delta_fv + delta_vv + T_con + 2*T_exe + 2*T_cmt`. Zaptos reduces this to `2*delta_cf + 2*delta_fv + T_con + max(T_exe + T_cmt - 2*delta_vv, 0) + max(T_exe - delta_vv, 0) + max(T_cmt - delta_vv, 0)`, achieving sub-second latency at 20,000 TPS across 100 geographically distributed validators.

---

## 9. Shardines: Internal Sharding

Shardines is Aptos's approach to horizontal scaling within a single validator cluster, achieving over 1 million TPS for non-conflicting transactions and over 500,000 TPS for conflicting transactions.

**Three-Layer Sharding.** Unlike traditional cross-chain sharding, Shardines partitions the three core layers -- storage, execution, and consensus -- independently within each validator node.

**Storage Sharding.** The Jellyfish Merkle Tree is partitioned across multiple storage shards within a single node. Each shard manages a subset of the state keyspace, enabling parallel state reads and writes. This has been deployed to mainnet production.

**Execution Sharding.** A dynamic partitioner analyzes incoming transaction batches and assigns them to execution shards based on their access patterns. The partitioner minimizes cross-shard dependencies to reduce synchronization overhead. Each shard runs its own Block-STM instance. Cross-shard transactions are handled through a coordination protocol that resolves dependencies without global locks.

**Consensus Sharding.** Multiple data dissemination shards handle transaction propagation in parallel, each obtaining Proof-of-Store certificates independently. A consensus coordinator orders the metadata from all shards, allowing consensus throughput to scale with the number of dissemination shards.

**Micro-Batching and Pipelining.** Shardines uses micro-batching to amortize network latency costs across shard boundaries. Small batches of cross-shard messages are pipelined to overlap communication with computation, maintaining high utilization even with inter-shard coordination.

---

## Summary of Key Performance Characteristics

| Component | Key Metric |
|---|---|
| Block-STM | >160,000 TPS (17-20x vs sequential) |
| Raptr consensus | >250,000 TPS at 750ms latency |
| Baby Raptr | 4 network hops, 20% latency reduction |
| Zaptos | 40% latency reduction, sub-second at 20K TPS |
| Shardines | >1M TPS (non-conflicting), >500K TPS (conflicting) |
| Block close time | ~250ms |
| Epoch duration | 7,200 seconds (2 hours) |
