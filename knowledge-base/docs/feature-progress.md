# Aptos Feature Progress Tracker

Extracted from `aptos-intelligence.json`, source configuration, commit history, and knowledge-base documents (2026-03-25).

---

## Feature Status Summary

| Feature | Status | Progress | Last Updated | Source |
|---------|--------|----------|-------------|--------|
| Encrypted Mempool | Testnet | 80% | 2026-03-23 | aptos-cli-v9.0.0 release |
| Confidential Assets (AIP-143) | In Progress (code merged) | 30% | 2026-03-23 | PR #18973 |
| Baby Raptr Consensus | Deployed (Mainnet) | ~95% | -- | architecture-overview.md |
| Block-STM v2 | In Development | ~60% | -- | executor.rs config flag |
| Storage Sharding | Deployed (Mainnet) | ~95% | -- | architecture-overview.md |
| Keyless Accounts (AIP-61) | Accepted/Deployed | ~95% | -- | AIP-61 status |
| On-chain Randomness (AIP-41) | Active | ~80% | -- | config.ts |
| Scheduled Transactions (AIP-125) | Tracked | ~20% | -- | config.ts |

---

## Detailed Feature Histories

### 1. Encrypted Mempool

**Status: Testnet (80%)**

History entries from data:
- **2026-03-23**: Status = "Testnet", Source = aptos-cli-v9.0.0 release

Recent commits (consensus subsystem, last 90 days):
- 2026-03-19: `[consensus] Add per-BatchKind txn limits in proposal pull` (ibalajiarun)
- 2026-03-19: `[consensus] Add per-kind batch size control for encrypted txns` (ibalajiarun)
- 2026-03-19: `[consensus] Add ciphertext verification in QS batch verify` (ibalajiarun)
- 2026-03-18: `[consensus] Add batch_version labels to quorum store metrics for V1/V2 observability` (ibalajiarun)
- 2026-03-18: `Decryption pipeline perf and batch limit handling` (ibalajiarun)
- 2026-03-17: `[consensus] Fix consensus observer encrypted transaction support` (ibalajiarun)
- 2026-03-12: `[encrypted mempool] Change ID to be hash of both VK and AD` (rex1fernando)
- 2026-03-10: `[execution] Add hidden encrypted flag to txn emitter CLI` (ibalajiarun)
- 2026-03-05: `[forge] Add Forge test for encrypted transactions with chunky DKG` (ibalajiarun)
- 2026-03-03: `[vm] Fix sequence number not incrementing for failed encrypted transactions` (ibalajiarun)
- 2026-02-24: `[consensus] Deprecate old Payload enum variants and streamline proof_manager` (ibalajiarun)
- 2026-02-14: `[consensus] Propagate SecretSharedKey to consensus observer via PipelinedBlock` (ibalajiarun)
- 2026-02-14: `[consensus] Add decryption pipeline and secret share management` (ibalajiarun)
- 2026-02-14: `[vm][execution] Support encrypted transaction execution` (ibalajiarun)
- 2026-02-12: `[consensus] Use OptQuorumStore payload exclusively in proof_manager` (ibalajiarun)
- 2026-02-04: `[consensus] Add ValidatorTransaction::ChunkyDKGResult and consensus hooks` (ibalajiarun)
- 2026-01-08: `[consensus] support secret sharing manager in execution client` (ibalajiarun)
- 2025-12-17: `[consensus] secret sharing infra` (ibalajiarun)
- 2025-12-03: `[consensus] Introduce OptQS::V2 Payload` (ibalajiarun)

Technical status: The encrypted mempool (BIBE-based) has been actively developed with `BatchKind::Encrypted` support in Quorum Store, ciphertext verification, per-kind batch size controls, and a full decryption pipeline. The Chunky DKG infrastructure for key management is in place. Secret sharing is propagated through PipelinedBlock to consensus observer nodes.

**Primary developer**: ibalajiarun (20 consensus commits in 90 days)

---

### 2. Confidential Assets / ACTs (AIP-143)

**Status: In Progress (code merged) (30%)**

History entries from data:
- **2026-03-23**: Status = "In Progress (code merged)", Source = PR #18973

Key milestone: **Confidential Assets v1.1** (PR #18973, merged 2026-03-23 by alinush)
- Production-ready Move module for confidential asset management
- Replacement of sigma-protocol proofs with homomorphic framework
- Global auditor support
- Gas benchmarks for every Move entry function
- New package "thousands" for number formatting
- Tagged for v1.43 release

Technical details:
- Twisted ElGamal encryption for additively homomorphic balance encryption
- Zero-knowledge proofs verifying transaction validity
- Range proofs: amounts in [0, 2^64), balances in [0, 2^128)
- Six primary functions: `register()`, `deposit()`, `withdraw()`, `transfer()`, `rotate_key()`, `balance()`
- APT-only at launch
- Testnet URL: https://confidential.aptoslabs.com/
- **Mainnet target: April 2026** (pending security audits and governance approval)

Performance:
- Proof generation: ~25ms client-side
- Proof verification: ~2ms validator-side
- Amount decryption: ~0.3-0.5ms
- Balance decryption: ~13ms native / 130-260ms browser

Future considerations: Confidential staking, confidential governance, DeFi integration.

---

### 3. Baby Raptr Consensus

**Status: Deployed on Mainnet (~95%)**

Baby Raptr has been deployed on mainnet. It merges the previously-separate Jolteon consensus and Quorum Store logic. The proposer optimistically includes batch digests in the block without waiting for full Proof-of-Store certificates. Validators independently retrieve and verify batch contents during voting.

Key improvement: Reduces consensus from 6 network hops to 4, yielding 20% latency improvement (100-150ms) on mainnet.

Full Raptr (next phase) adds decoupled prefix voting and prefix commit for further improvements.

---

### 4. Block-STM v2

**Status: In Development (~60%)**

Evidence from source code:
- `BlockExecutor.execute_block()` dispatches to either `execute_transactions_parallel` (v1) or `execute_transactions_parallel_v2` (v2) based on `config.local.blockstm_v2`
- `AptosVM::set_blockstm_v2_enabled_once()` and `AptosVM::get_blockstm_v2_enabled()` static configuration methods

No specific AIP tracked, but the feature is configurable and under active development.

---

### 5. Storage Sharding

**Status: Deployed on Mainnet (~95%)**

From architecture documentation: "Storage sharding has been deployed to mainnet production." The Jellyfish Merkle Tree is partitioned across 16 shards within a single node, enabling parallel state reads and writes.

Recent storage activity (36 commits in 90 days, led by wqfish):
- Hot state KV persistence to dedicated RocksDB column family
- WriteSet hotness persistence behind config flag
- Hot state cache age metrics and deferred merge
- RCU pattern for race condition prevention
- HashValue as DashMap key for hot state
- Removal of non-sharding dead code
- L0 write stall trigger tuning for sequential-key ledger CFs
- RocksDB property statistics via Prometheus

---

### 6. Keyless Accounts (AIP-61)

**Status: Accepted/Deployed (~95%)**

AIP-61 has been accepted and deployed. Recent activity:
- 2026-03-11: `[keyless] Add support for auth headers to pepper service` (banool)

Technical implementation:
- Groth16 over BN254 (128-byte proof, ~1.5ms verification)
- Training wheels mode active for safety
- Supported OIDC providers: Google, Apple, GitHub
- Recovery service mechanism via on-chain aud override list

---

### 7. On-chain Randomness (AIP-41)

**Status: Active (~80%)**

Recent consensus commits related to randomness:
- 2026-03-10: `[consensus] Remove randomness fast path code` (danielxiangzl)
- 2026-02-25: `[consensus] Defer randomness aggregation for non-rand blocks` (danielxiangzl)
- 2026-02-24: `[consensus] Fix WVUF batch verification off-by-one and log errors` (danielxiangzl)
- 2026-02-12: `[consensus] Add optimistic randomness share verification` (danielxiangzl)

The randomness fast path code has been removed, suggesting the standard path is now mature. Optimistic share verification has been added. WVUF (Weighted Verifiable Unpredictable Function) batch verification is in use.

---

### 8. Chunky DKG (Supporting Feature for Encrypted Mempool)

**Status: Active Development**

Not a standalone tracked feature, but critical infrastructure for encrypted mempool:
- 2026-03-06: `[framework] Fix reconfigure() to start chunky DKG when enabled` (ibalajiarun)
- 2026-03-05: `[consensus][framework] Fix chunky DKG enable-feature: on_new_epoch + pipeline deadlock` (ibalajiarun)
- 2026-03-05: `Add comprehensive tests for chunky DKG module` (ibalajiarun)
- 2026-03-05: `Shplonked rewrite, BSGS speedup, aptos-dkg refactoring` (waamm)
- 2026-03-04: `[smoke-test] Add chunky DKG enable-feature test` (ibalajiarun)
- 2026-03-04: `[smoke-test] Add chunky DKG smoke tests` (ibalajiarun)
- 2026-02-04: `[consensus] Add ValidatorTransaction::ChunkyDKGResult and consensus hooks` (ibalajiarun)

On-chain config: `OnChainChunkyDKGConfig` is now part of `RoundManager` constructor.

---

### 9. MonoMove Runtime (Emerging Feature)

**Status: Early Prototype**

A next-generation Move VM runtime being developed in parallel:
- 2026-03-24: `[vm] Update Mono Move VM design document` (vgao1996)
- 2026-03-24: `[mono-move] Executable cache template` (georgemitenkov)
- 2026-03-24: `[mono-move] Gas instrumentation prototype` (calintat)
- 2026-03-20: `[vm] MonoMove runtime prototype: interpreter, GC, and benchmarks` (vgao1996)
- 2026-03-18: `[mono-move] Interning for identifiers and module IDs` (georgemitenkov)
- 2026-03-18: `[mono-move] Global arena implementation` (georgemitenkov)
- 2026-03-13: `[mono-move] Global context template` (georgemitenkov)
- 2026-03-05: `[vm] mono-move: instruction set definition` (vgao1996)

Features: Global arena allocation, identifier interning, garbage collection, new instruction set, interpreter with benchmarks.

---

## Release Timeline

### Recent Node Releases

| Date | Release | Target | Key Changes |
|------|---------|--------|-------------|
| 2026-03-23 | aptos-node-v1.42.1-rc | Testnet | Security hotfixes (Move VM, block execution), consensus race conditions, gas/storage fee 10x multiplier |
| 2026-03-23 | aptos-node-v1.41.9 | Mainnet | Security hotfixes for Move VM and block execution |
| 2026-03-22 | aptos-node-v1.42.1-rc-hotfix | Testnet | Critical private hotfix |
| 2026-03-22 | aptos-node-v1.41.9-hotfix | Mainnet | Private hotfix for validators |
| 2026-03-23 | aptos-cli-v9.0.0 | All | Python security updates, chunky verifier speedup, linter rules |

### Upcoming Milestones

| Feature | Target | Evidence |
|---------|--------|---------|
| Confidential APT mainnet | April 2026 | AIP-143 deployment timeline |
| Confidential Assets v1.1 | v1.43 release | PR #18973 labeled v1.43 |
| Full Raptr consensus | TBD | architecture-overview.md mentions as next phase after Baby Raptr |
| Execution sharding | TBD | architecture-overview.md describes design, not yet deployed |
| Consensus sharding | TBD | architecture-overview.md describes design |

---

## Commit Activity Summary (Last 90 Days)

| Subsystem | Commits | Primary Contributors |
|-----------|---------|---------------------|
| Other (misc) | 215 | JoshLind (53), ibalajiarun (23) |
| Storage | 36 | wqfish (33), grao1991 (4) |
| Move VM | 33 | georgemitenkov (13), wrwg (7), calintat (6), vgao1996 (4) |
| Forge | 26 | aptos-bot (13), wqfish, JoshLind |
| Consensus | 26 | ibalajiarun (20), danielxiangzl (6) |
| Framework | 14 | ibalajiarun (6), mkurnikov (2), Zekun Li (2) |
| Release | 13 | aptos-bot (13) |
| Network | 11 | JoshLind (11) |
| Execution | 11 | wqfish (5), Zekun Li (3) |
| CLI | 10 | vgao1996 (3) |
| Compiler | 10 | calintat (4), rahxephon89 (3) |
| Prover | 8 | wrwg (8) |
| Compiler v2 | 7 | vineethk (7) |
| Types | 7 | ibalajiarun (6) |
| State Sync | 7 | JoshLind (6) |
| DKG | 6 | ibalajiarun (6) |
| Gas | 4 | calintat (2) |

Total fetched commits: 600 (from 40+ contributors)
