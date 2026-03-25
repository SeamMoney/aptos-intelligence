# Comprehensive Aptos Knowledge Extraction

Extracted from the `aptos-intelligence` project (2026-03-25). This document synthesizes all Aptos-related knowledge found across the knowledge base, source code, data files, and configuration.

---

## 1. Consensus Pipeline Model

The project models the Aptos consensus pipeline as a multi-stage system with the following flow:

```
Client -> Mempool -> Quorum Store (batching) -> Consensus (Raptr/Prefix ordering) -> Execution (Block-STM parallel) -> Storage (Jellyfish Merkle Tree)
```

### Stage-by-Stage Breakdown

**Stage 1 -- Submission.** A client constructs a signed transaction containing a payload (entry function call or script), sender address, sequence number, gas parameters, and expiration time. The client submits this to a fullnode's REST service over HTTPS.

**Stage 2 -- Mempool Admission.** The fullnode validates the transaction: it checks the signature against the sender's on-chain authentication key, verifies the sequence number matches or exceeds the account's current sequence number, confirms sufficient gas balance, and ensures the transaction has not expired. Valid transactions enter the in-memory mempool and are forwarded to validator mempools via inter-node gossip.

**Stage 3 -- Ordering (Consensus).** The consensus layer selects a leader validator based on a deterministic formula incorporating reputation and stake weight. The leader pulls certified transaction batches from the Quorum Store layer and proposes a block containing batch metadata (not raw transactions). Validators vote on the proposal. With 2f+1 agreeing votes (where n = 3f+1 validators), the block is ordered.

**Stage 4 -- Execution.** Once ordered, the block enters the execution pipeline. The execution engine invokes Block-STM, which speculatively executes all transactions in parallel across multiple threads. The Move VM processes each transaction's bytecode, producing a write set (state mutations), events, and gas charges. Block-STM's MVCC layer validates all reads against a preset serialization order and re-executes any transaction whose speculative reads were invalidated.

**Stage 5 -- Certification and Commit.** Validators sign the execution result (state root hash). Once 2f+1 execution certificates are collected, the block is certified. The write set is applied to persistent storage (RocksDB), the Jellyfish Merkle Tree is updated, events are appended to the event accumulator, and the ledger version increments.

### Detailed Consensus Internal Flow

```
Quorum Store -> ProofManager -> OrderedBlocks -> ExecutionPipeline
```

- **Quorum Store**: Validators package txns into batches. Each batch gets signed proofs from 2f+1 validators before inclusion. This SEPARATES data dissemination from ordering.
- **ProofManager**: Collects and validates batch proofs, feeds them to the ordering layer.
- **OrderedBlocks**: Output of consensus -- a totally ordered sequence of blocks.
- **ExecutionPipeline**: Receives ordered blocks and executes them through Block-STM.

### Cross-Cutting Data Flow (from subsystem index)

```
User submits txn
    |
    v
[Mempool] -- add_txn() --> CoreMempool/TransactionStore
    |
    v (QuorumStore pulls batch)
[Consensus/QuorumStore] -- BatchCoordinator --> ProofManager --> RoundManager
    |
    v (block proposal with proofs)
[RoundManager] -- process_proposal_msg() --> BlockStore --> propose/vote/commit
    |
    v (ordered block)
[Execution/Block-STM] -- BlockExecutor.execute_block()
    |                     Scheduler assigns tasks to workers
    |                     AptosVM.execute_user_transaction() per txn
    |                     MoveVM.execute_loaded_function() for Move code
    |
    v (execution results)
[Storage/AptosDB] -- commit to LedgerDb, StateKvDb, StateMerkleDb
    |                 JellyfishMerkleTree updates state root
    |
    v
[State Sync] -- StateSyncDriver replicates to non-validators
```

---

## 2. Architecture Descriptions

### 2.1 Quorum Store (Narwhal-based)

Quorum Store separates data dissemination from metadata ordering. All n validators continuously broadcast batches of transactions to each other in parallel. Each batch is a set of serialized transactions with a batch identifier. When a validator receives a batch, it signs an acknowledgment. Once 2f+1 acknowledgments are collected for a batch, a Proof-of-Store (PoS) certificate is formed.

The consensus leader does not include raw transactions in its block proposal. Instead, it references certified batch identifiers along with their PoS certificates. Since each certified batch uniquely maps to an ordered list of transactions, this implicitly orders all transactions.

Key Rust types:
- `RoundManager` -- Central consensus round coordinator
- `UnverifiedEvent` / `VerifiedEvent` -- Event enums for all consensus messages
- `BatchInfo`, `ProofOfStore`, `BatchCoordinator`, `ProofManager`
- `Batch<T>`, `BatchMsg<T>`, `BatchRequest`, `BatchResponse`
- `PersistedValue<T>` -- Wraps batch info with optional payload

### 2.2 Raptr / Prefix Consensus

Raptr is Aptos's next-generation consensus protocol, achieving over 250,000 TPS at 750ms latency.

**Prefix Consensus Paradigm.** Unlike classical single-value consensus, prefix consensus ensures that committed outputs across all honest participants maintain consistent prefix relationships.

**Baby Raptr (Production Stage 1).** Deployed on mainnet, merges previously-separate Jolteon consensus and Quorum Store logic. The proposer optimistically includes batch digests in the block without waiting for full Proof-of-Store certificates. Reduces consensus from six network hops to four, yielding 20% latency improvement.

**Full Raptr.** Adds decoupled prefix voting and prefix commit, further reducing latency and increasing censorship resistance through leaderless multi-proposer designs.

### 2.3 Block-STM Parallel Execution

Published at PPoPP 2023. Achieves over 160,000 TPS (17-20x vs sequential).

Key concepts:
- **MVCC (Multi-Version Concurrency Control)** -- Each write from transaction T_i is stored alongside its incarnation number
- **Speculative Execution** -- All transactions dispatched to worker threads simultaneously
- **Validation** -- Each transaction validated by checking read-set consistency
- **Re-execution on Conflict** -- Write-set entries marked as ESTIMATION, dependent transactions pause
- **Collaborative Scheduling** -- Novel cooperative scheduler avoids redundant work

Key Rust types:
- `BlockExecutor<T, E, S, L, TP, A>` -- Main parallel block executor
- `Scheduler` -- Coordinates execution/validation tasks across threads
- `SchedulerTask` -- `ExecutionTask`, `ValidationTask`, `Retry`, `Done`
- `DependencyStatus` -- `Unresolved`, `Resolved`, `ExecutionHalted`
- `ExecutionStatus<O, E>` -- `Success`, `Abort`, `SkipRest`, `SpeculativeExecutionAbortError`

Block-STM v2 is under development, selectable via `config.local.blockstm_v2`.

### 2.4 Zaptos (Optimistic Pipelining)

Reduces end-to-end transaction latency by 40% through three techniques:

1. **Optimistic Execution** -- Begin executing before consensus ordering finalizes
2. **Optimistic Commit** -- Persist state as "OptCommitted" before certification completes
3. **Piggybacking State Certification** -- Attach execution certificates to OrderVote messages

Achieves sub-second latency at 20,000 TPS across 100 geographically distributed validators.

### 2.5 Shardines (Internal Sharding)

Achieves over 1M TPS for non-conflicting transactions and over 500K TPS for conflicting.

Three-layer sharding within each validator node:
- **Storage Sharding** -- JMT partitioned across multiple storage shards (deployed to mainnet)
- **Execution Sharding** -- Dynamic partitioner assigns transactions to execution shards
- **Consensus Sharding** -- Multiple data dissemination shards handle propagation in parallel

### 2.6 Archon (Proxy-Primary Architecture)

- Proxy node handles networking; primary handles consensus + execution
- Reduces attack surface (primary never directly exposed)
- Enables heterogeneous hardware optimization

### 2.7 Jellyfish Merkle Tree

256-bit sparse Merkle tree optimized for IOPS. Subtrees containing 0 or 1 leaf replaced by placeholder or leaf. InternalNodes compress 4 levels of binary tree into one node (16 children, 4x IOPS reduction).

Key types:
- `AptosDB` -- Main database with sub-databases: `LedgerDb`, `StateKvDb`, `StateMerkleDb`, `EventStore`, `TransactionStore`, `StateStore`
- `JellyfishMerkleTree<'a, R, K>` -- Stateless tree implementation
- `NodeKey` (version + nibble_path), `InternalNode`, `LeafNode`, `TreeUpdateBatch`
- 16 shards for parallel state updates (`batch_put_value_set_for_shard`)

### 2.8 Move VM

Completely stateless execution runtime. Key characteristics:
- Bytecode verification (type safety, resource safety, reference safety) at publish time
- Stack-based interpreter
- Linear type system (resources cannot be copied/dropped unless permitted)
- Static dispatch only (no dynamic dispatch)
- Gas metering per bytecode instruction

Key types:
- `MoveVM` -- Stateless core VM
- `AptosVM` -- Aptos-specific wrapper with gas metering, prologue/epilogue
- `AptosVMBlockExecutor` -- Block-level executor integrating with Block-STM

### 2.9 Mempool

In-memory transaction pool with priority-based ordering.

Key types:
- `Mempool` (CoreMempool) -- Stores `TransactionStore`, manages `add_txn`, `get_batch`, `gc`
- `MempoolTransaction` -- Includes `ranking_score`, `TimelineState`, `InsertionInfo`
- `SharedMempool` -- Owns networking, validation, storage dependencies
- `QuorumStoreRequest::GetBatchRequest` -- Interface between QuorumStore and Mempool

Transaction ordering in `get_batch`: iterates by gas price descending, ensures sequence number ordering for sequence-number txns, directly includes nonce-based (orderless) txns.

### 2.10 State Sync

Layered architecture:
1. `DriverFactory` -- Creates and wires components
2. `StateSyncDriver` -- Main event loop (bootstrapping + continuous sync)
3. `Bootstrapper` -- Initial node sync
4. `ContinuousSyncer` -- Ongoing sync after bootstrapping
5. `StorageSynchronizer` -- Applies chunks to local storage

### 2.11 Encrypted Mempool (BIBE-based)

Three-state lifecycle for encrypted transaction payloads:
- `Encrypted` -- Contains ciphertext, extra_config, payload_hash
- `FailedDecryption` -- Decryption failed with reason
- `Decrypted` -- Successfully decrypted with eval_proof and executable

Encryption uses Broadcast Identity-Based Encryption (BIBE):
- `BIBECiphertext` -- Contains elliptic curve elements (G2Affine), padded key, symmetric ciphertext
- `PreparedBIBECiphertext` -- Pre-computed pairing outputs for efficient decryption
- Only Ed25519 authenticator supported for encrypted transactions
- `BatchKind::Encrypted` enforces all txns in batch are encrypted with parallel ciphertext verification

Decryption failure reasons: `CryptoFailure`, `BatchLimitReached`, `ConfigUnavailable`, `DecryptionKeyUnavailable`

Encrypted transaction flow:
1. User encrypts payload with BIBE (`BIBECTEncrypt::bibe_encrypt`)
2. Signs with Ed25519 over encrypted variant of RawTransaction
3. Submitted as `TransactionPayload::EncryptedPayload`
4. Quorum Store: batched as `BatchKind::Encrypted`, ciphertext verified in parallel
5. Block execution: decrypted with `BlockTxnDecryptionKey`
6. If decryption fails: `EncryptedPayload::into_failed_decryption_with_reason()`

---

## 3. Core Transaction Types

```rust
pub enum TransactionPayload {
    Script(Script),
    ModuleBundle(DeprecatedPayload),
    EntryFunction(EntryFunction),
    Multisig(Multisig),
    Payload(TransactionPayloadInner),    // New versioned format
    EncryptedPayload(EncryptedPayload),  // Encrypted transaction payload
}

pub enum Transaction {
    UserTransaction(SignedTransaction),
    GenesisTransaction(WriteSetPayload),
    BlockMetadata(BlockMetadata),
    StateCheckpoint(HashValue),
    ValidatorTransaction(ValidatorTransaction),
    BlockMetadataExt(BlockMetadataExt),
    BlockEpilogue(BlockEpiloguePayload),
}

pub enum ReplayProtector {
    Nonce(u64),           // Orderless transactions (AIP-123)
    SequenceNumber(u64),  // Traditional ordering
}
```

### Authentication Schemes
- Ed25519, MultiEd25519, MultiAgent, FeePayer, SingleSender
- Generalized: Ed25519 (`0x00`), Secp256k1 ECDSA (`0x01`), Secp256r1 WebAuthn (`0x02`), Keyless (`0x03`)

---

## 4. Key AIPs Documented

### AIP-61: Keyless Accounts
- OIDC-based blockchain accounts using zero-knowledge proofs
- Eliminates secret key management via Google/Apple/GitHub login
- Uses Groth16 over BN254 (128-byte proof, ~1.5ms verification, ~3.5s proving)
- Training wheels mode for initial deployment safety
- Recovery service mechanism for lost application access
- Identity commitment: `addr_idc = H'(uid_key, uid_val, aud_val; r)`

### AIP-143: Confidential Assets (Confidential APT)
- Privacy-preserving transfers using Twisted ElGamal encryption
- Range proofs constraining values (amounts in [0, 2^64), balances in [0, 2^128))
- Homomorphic balance operations
- Optional governance-assigned auditor access (forward-only, cannot retroactively decrypt)
- APT-only at launch
- Performance: ~25ms proof generation, ~2ms verification, ~13ms balance decryption
- Mainnet target: April 2026
- Six primary functions: `register()`, `deposit()`, `withdraw()`, `transfer()`, `rotate_key()`, `balance()`

---

## 5. Staking Model

- **Owner-Operator-Voter** three-persona delegation model
- Validator states: Inactive -> Pending Active -> Active -> Pending Inactive
- Minimum stake: 1M APT, Maximum: 50M APT
- Epochs: 7,200 seconds (2 hours)
- Rewards: `staked_amount * rewards_rate_per_epoch * (successful_proposals / total_proposals)`
- Only leader validators receive block proposal rewards
- Slashing NOT currently implemented
- Automatic lockup with renewal

---

## 6. Move Language

- Resource-oriented with linear type system
- Abilities: `key` (global storage), `store` (nesting), `copy`, `drop`
- Static dispatch only
- Phantom types for generic parameterization
- Aptos Framework libraries: Token Objects (AIP-11/22), Coin Standard, Fungible Asset Standard (AIP-21), Staking/Delegation

---

## 7. Performance Characteristics

| Component | Key Metric |
|---|---|
| Block-STM | >160,000 TPS (17-20x vs sequential) |
| Raptr consensus | >250,000 TPS at 750ms latency |
| Baby Raptr | 4 network hops, 20% latency reduction |
| Zaptos | 40% latency reduction, sub-second at 20K TPS |
| Shardines | >1M TPS (non-conflicting), >500K TPS (conflicting) |
| Block close time | ~250ms |
| Epoch duration | 7,200 seconds (2 hours) |
| Confidential transfer proof generation | ~25ms client-side |
| Confidential transfer verification | ~2ms validator-side |
| Keyless ZKP verification | ~1.5ms |
| Keyless ZKP proving | ~3.5s |

---

## 8. Active Development Areas (as of March 2026)

### MonoMove Runtime
A next-generation Move VM runtime with:
- Global arena allocation and identifier interning
- Garbage collection
- New instruction set definition
- Interpreter prototype with benchmarks
- Led by `vgao1996` and `georgemitenkov`

### Chunky DKG (Distributed Key Generation)
- `ValidatorTransaction::ChunkyDKGResult` for consensus hooks
- Secret sharing infrastructure for encrypted mempool
- Decryption pipeline and secret share management
- Propagation of `SecretSharedKey` to consensus observer via `PipelinedBlock`

### Hot State Management
- Dedicated RocksDB column family for hot state KV
- WriteSet hotness persistence behind config flag
- Hot state cache age metrics and deferred merge
- RCU (Read-Copy-Update) pattern for race condition prevention

### Subsystem Expert Map

| Subsystem | Primary Expert | Recent Commits (90d) |
|-----------|---------------|---------------------|
| Consensus | ibalajiarun | 26 |
| Storage | wqfish | 36 |
| Move VM | georgemitenkov | 33 |
| Execution | wqfish | 11 |
| Network | JoshLind | 11 |
| State Sync | JoshLind | 7 |
| Framework | ibalajiarun | 14 |
| Prover | wrwg | 8 |
| Compiler v2 | vineethk | 7 |

---

## 9. Project Architecture (aptos-intelligence itself)

The `aptos-intelligence` project is an automated monitoring and analysis system for `aptos-labs/aptos-core` that:

1. **Fetches** recent releases and merged PRs from GitHub
2. **Analyzes** each change using LLM (Groq/Llama-3.3-70b) with deep Aptos architecture context
3. **Tracks features** by mapping PRs to tracked features (8 features tracked)
4. **Generates** Twitter threads with technical depth
5. **Produces** web reports with both advanced technical and ELI5 explanations
6. **Maintains** a knowledge base with subsystem documentation extracted from source code

### Tracked Features Configuration
- AIP-125: Scheduled / Event-Driven Transactions
- AIP-143: Confidential Assets (ACTs)
- Encrypted Mempool
- Baby Raptr Consensus
- Block-STM v2
- Storage Sharding
- Keyless Accounts (AIP-61)
- On-chain Randomness (AIP-41)

### Feature Status Progression Scale
```
Unknown (5) -> Draft (20) -> Stagnant (15) -> Review (35) -> Last Call (45)
-> Accepted (55) -> Ready for Implementation (60) -> Devnet (70)
-> Implemented (75) -> Testnet (80) -> Deployed (95) -> Mainnet/Final (100)
```
