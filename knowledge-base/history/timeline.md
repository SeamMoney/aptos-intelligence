# Aptos Core — Commit Timeline (last 90 days)

> Auto-generated on 2026-03-24 from 600 fetched commits.

## Subsystem activity (last 90 days)

| Subsystem | Commits (90d) |
|-----------|-------------:|
| other | 215 |
| storage | 36 |
| vm | 33 |
| forge | 26 |
| consensus | 26 |
| framework | 14 |
| release | 13 |
| network | 11 |
| execution | 11 |
| cli | 10 |
| compiler | 10 |
| prover | 8 |
| compiler-v2 | 7 |
| types | 7 |
| state-sync | 7 |
| docker | 7 |
| api | 6 |
| dkg | 6 |
| ci | 6 |
| gas | 4 |

## Notable releases

| Date | Title | Author |
|------|-------|--------|
| 2026-03-24 | [forge] bump deployer version | aptos-bot |
| 2026-03-23 | [forge] bump deployer version | aptos-bot |
| 2026-03-22 | [forge] bump deployer version | aptos-bot |
| 2026-03-14 | [forge] bump deployer version | aptos-bot |
| 2026-03-13 | [forge] bump deployer version | aptos-bot |
| 2026-03-08 | [forge] bump deployer version | aptos-bot |
| 2026-03-07 | [forge] bump deployer version (#18974) | aptos-bot |
| 2026-03-06 | [forge] bump deployer version (#18910) | aptos-bot |
| 2026-03-02 | [forge] bump deployer version | aptos-bot |
| 2026-02-05 | [forge] bump deployer version | aptos-bot |
| 2026-01-15 | [forge] bump deployer version (#18446) | aptos-bot |
| 2026-01-13 | [forge] bump deployer version (#18435) | aptos-bot |
| 2026-01-12 | [forge] bump deployer version (#17266) | aptos-bot |

## Weekly breakdown

### Week of 2026-03-23  (16 commits)

Active subsystems: **other** (10), **vm** (2), **forge** (2), **release** (2), **storage** (1), **prover** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-03-24 | vgao1996 | [vm] Update Mono Move VM design document (#19181) |
| 2026-03-24 | junxzm1990 | [move-flow] make mcp server resilient and add claude plugin readme (#19122) |
| 2026-03-24 | georgemitenkov | [mono-move] Executable cache template (#19131) |
| 2026-03-24 | banool | Add otel tracing to grpc v2 stack (#18835) |
| 2026-03-24 | calintat | [mono-move] Gas instrumentation prototype (#19134) |
| 2026-03-24 | igor-aptos | remove unnecessary properties in ordered_map and big_ordered_map (#19184) |
| 2026-03-24 | igor-aptos | Add object_code_deployment::get_code_object_signer (#19162) |
| 2026-03-24 | vgao1996 | [vm] Include verifier config in verified module cache key (#19160) |
| 2026-03-24 | zjma | Gate `0x1::crypto_algebra::multi_scalar_mul` by feature flag `CRYPTOGRAPHY_ALGEBRA_NATIVES` (#19097) |
| 2026-03-24 | aptos-bot | [forge] bump deployer version |
| 2026-03-24 | igor-aptos | fungible_asset::amount use self, duplicate metadata accessor (#19161) |
| 2026-03-23 | banool | Make faucet mint limits configurable per asset (#19172) |
| 2026-03-23 | alinush | Confidential assets v1.1 (#18973) |
| 2026-03-23 | aptos-bot | [forge] bump deployer version |
| 2026-03-23 | wqfish | [storage] Persist hot state KV insertions/evictions to DB |
| 2026-03-23 | wrwg | [prover] Global memory support for behavioral predicates and access declarations (#18979) |

### Week of 2026-03-16  (40 commits)

Active subsystems: **other** (17), **forge** (7), **consensus** (6), **vm** (3), **release** (1), **types** (1), **storage** (1), **ci** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-03-17 | JoshLind | [Forge] Add transaction emitter support for PFNs. |
| 2026-03-16 | JoshLind | [Forge] Enable validator-PFN connections for forge perf. |
| 2026-03-16 | JoshLind | [Forge] Remove VFNs from land-blocking performance tests. |
| 2026-03-22 | cursor[bot] | Update Docker images |
| 2026-03-22 | aptos-bot | [forge] bump deployer version |
| 2026-03-20 | wqfish | [forge] Add auto-restart, pre-built binary support, and use clang linker on Linux |
| 2026-03-20 | ibalajiarun | [types] Fix replay_protection_nonce for encrypted transactions (#19149) |
| 2026-03-20 | banool | [localnet] Add --use-internal-fullnode-data-interface (#19147) |
| 2026-03-20 | vgao1996 | [vm] MonoMove runtime prototype: interpreter, GC, and benchmarks (#18711) |
| 2026-03-19 | wqfish | [storage] Persist WriteSet hotness in ledger DB behind config flag |
| 2026-03-19 | ibalajiarun | [consensus] Add per-BatchKind txn limits in proposal pull |
| 2026-03-19 | ibalajiarun | [consensus] Add per-kind batch size control for encrypted txns |
| 2026-03-19 | ibalajiarun | [consensus] Add ciphertext verification in QS batch verify |
| 2026-03-19 | ibalajiarun | [forge] adhoc: fix etna image name (#19140) |
| 2026-03-19 | waamm | Fiat-Shamir fix in DeKART (#19135) |
| 2026-03-19 | zi0Black | [ci] Sanitize workflow branch output (#19133) |
| 2026-03-19 | rahxephon89 | [CLI][Move] support public structs/enums as txn args in CLI (#18591) |
| 2026-03-19 | rahxephon89 | support struct api for move prover (#19087) |
| 2026-03-19 | rahxephon89 | [decompiler] Support public structs in decompiler (#19086) |
| 2026-03-19 | rex1fernando | Fix typos (#19092) |
| 2026-03-18 | ibalajiarun | [consensus] Add batch_version labels to quorum store metrics for V1/V2 observability (#19107) |
| 2026-03-18 | ibalajiarun | Decryption pipeline perf and batch limit handling (#19102) |
| 2026-03-18 | vineethk | Update move formatter version (#19121) |
| 2026-03-18 | georgemitenkov | [mono-move] Interning for identifiers and module IDs (#19059) |
| 2026-03-18 | georgemitenkov | [mono-move] Global arena implementation (#19054) |
| 2026-03-17 | ibalajiarun | [consensus] Fix consensus observer encrypted transaction support (#19063) |
| 2026-03-17 | calintat | [vm] Fix extract_abort_info for compiler-generated abort codes (#19090) |
| 2026-03-17 | vineethk | [compiler-v2] Add support for extracting nested literals in patterns into equality guards (#19078) |
| 2026-03-17 | calintat | [vm] Enforce abort message size limit for native function aborts (#19091) |
| 2026-03-17 | waamm | Chunky verifier fix (#19106) |

_… and 10 more._

### Week of 2026-03-09  (56 commits)

Active subsystems: **other** (28), **storage** (7), **consensus** (6), **forge** (4), **compiler-v2** (3), **ci** (3), **release** (2), **execution** (2)

| Date | Author | Title |
|------|--------|-------|
| 2026-03-14 | junxzm1990 | [move compiler v2] add linter rules for unused checks (#18953) |
| 2026-03-14 | aptos-bot | [forge] bump deployer version |
| 2026-03-13 | vineethk | [compiler-v2] Allow mixed tuple discriminators to be any valid expression (#19066) |
| 2026-03-13 | aptos-bot | [forge] bump deployer version |
| 2026-03-13 | georgemitenkov | [vm] Fix several correctness issues in Move VM runtime (#19052) |
| 2026-03-13 | georgemitenkov | [mono-move] Global context template (#19053) |
| 2026-03-10 | JoshLind | [Smoke Tests] Ignore some unneccessary tests. |
| 2026-03-12 | wqfish | [storage] Use HashValue as DashMap key in hot state |
| 2026-03-12 | sionescu | Update Node, PNPM, Terraform, Kubectl and Helm versions |
| 2026-03-12 | ibalajiarun | Fix PipelinedBlock BCS serialization for consensus observer (#19042) |
| 2026-03-12 | wqfish | [storage] Remove dead StaleStateValueIndexSchema |
| 2026-03-12 | rex1fernando | [encrypted mempool] Change ID to be hash of both VK and AD (#19055) |
| 2026-03-12 | lightmark | [stake] fix actual voting power (#18975) |
| 2026-03-11 | vineethk | [compiler-v2] Implement match over primitives (#18784) |
| 2026-03-11 | wqfish | [storage] Fix state KV truncation leaking first-time key creations |
| 2026-03-11 | wqfish | [storage] Move test_truncation out of db_debugger into regular test path |
| 2026-03-11 | wqfish | [test] Fix flaky test_db_restore smoke test |
| 2026-03-11 | rahxephon89 | fix (#18754) |
| 2026-03-11 | ibalajiarun | [consensus] Keep info! for signed ledger info in pipeline_builder |
| 2026-03-11 | ibalajiarun | [consensus] Fix nightly fmt in proposal_generator |
| 2026-03-11 | ibalajiarun | [consensus] Reduce log volume from additional high-frequency sites (round 2) |
| 2026-03-11 | ibalajiarun | [consensus] Reduce log volume from high-frequency info/warn sites |
| 2026-03-11 | danielxiangzl | [QS] Add per-author batch inclusion metrics (#19021) |
| 2026-03-11 | vineethk | [compiler-v2] Fix type inference to allow unifying struct constraints and receiver function constrai |
| 2026-03-11 | banool | [keyless] Add support for auth headers to pepper service (#19022) |
| 2026-03-11 | JoshLind | [Forge] Disable fullnode checks in forge land blocking. |
| 2026-03-10 | wqfish | [ci] Bump nextest to latest version |
| 2026-03-11 | vineethk | Fix NaN coverage output (#18934) |
| 2026-03-10 | wqfish | [ci] Add smoke-test feature to CI pre-build |
| 2026-03-11 | vineethk | Allow receivers on fully closed types (#18977) |

_… and 26 more._

### Week of 2026-03-02  (55 commits)

Active subsystems: **other** (18), **forge** (8), **vm** (6), **release** (4), **consensus** (4), **framework** (4), **storage** (3), **network** (2)

| Date | Author | Title |
|------|--------|-------|
| 2026-03-06 | JoshLind | [Network] Add validators to upstream peers. |
| 2026-03-03 | JoshLind | [Config] Add config optimizer for validator public network. |
| 2026-03-02 | JoshLind | [Network] Add support for validator-PFN connections. |
| 2026-03-08 | junxzm1990 | [move flow] add new tests for plugin validation (#18948) |
| 2026-03-08 | aptos-bot | [forge] bump deployer version |
| 2026-03-07 | rahxephon89 | update golden files (#18980) |
| 2026-03-07 | igor-aptos | cleanup rolled out features (#18954) |
| 2026-03-07 | aptos-bot | [forge] bump deployer version (#18974) |
| 2026-03-07 | danielxiangzl | [consensus] Enforce sender-author binding for rand share messages (#18970) |
| 2026-03-06 | calintat | [gas] Apply 10x multiplier to gas costs and storage fees (#18880) |
| 2026-03-06 | ibalajiarun | Consolidate quorum store batch bootstrap (#18960) |
| 2026-03-06 | wqfish | [storage] Raise L0 write stall triggers on sequential-key ledger CFs |
| 2026-03-06 | banool | Upgrade indexer processor SDK to v2.2.1 and processors to v2.4.0 (#18919) |
| 2026-03-06 | ibalajiarun | [framework] Update cached packages and docs for governance change |
| 2026-03-06 | ibalajiarun | [framework] Fix reconfigure() to start chunky DKG when enabled |
| 2026-03-05 | ibalajiarun | [forge] Add Forge test for encrypted transactions with chunky DKG |
| 2026-03-06 | aptos-bot | [forge] bump deployer version (#18910) |
| 2026-03-06 | ibalajiarun | [consensus] Add instance name to ReliableBroadcast for log distinguishability (#18931) |
| 2026-03-05 | wqfish | [crypto] Optimize CryptoHash for Merkle tree nodes with single-permutation SHA3-256 |
| 2026-03-05 | ibalajiarun | Add comprehensive tests for chunky DKG module (#18941) |
| 2026-03-05 | ibalajiarun | [smoke-test] Remove unused import in enable_feature test |
| 2026-03-05 | ibalajiarun | [consensus][framework] Fix chunky DKG enable-feature: on_new_epoch + pipeline deadlock |
| 2026-03-04 | ibalajiarun | [smoke-test] Add chunky DKG enable-feature test |
| 2026-03-04 | ibalajiarun | [smoke-test] Add chunky DKG smoke tests |
| 2026-03-05 | rustielin | [telemetry] Add extra_labels config for custom contracts (#18947) |
| 2026-03-05 | vgao1996 | [vm] mono-move: instruction set definition (#18907) |
| 2026-03-05 | waamm | Shplonked rewrite, BSGS speedup, aptos-dkg refactoring (#18897) |
| 2026-03-05 | ibalajiarun | [ci] Add FORGE_RUNNER_IMAGE_NAME input and fix image existence check (#18733) |
| 2026-03-05 | banool | Allow Unicode-3.0 license (#18921) |
| 2026-03-04 | vineethk | Port coverage functionality to new disasm, remove old disasm and decompiler support (#18911) |

_… and 25 more._

### Week of 2026-02-23  (43 commits)

Active subsystems: **other** (11), **storage** (10), **execution** (6), **vm** (3), **consensus** (3), **state-sync** (2), **network** (2), **forge** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-03-01 | JoshLind | [Peer Monitoring Service] Update distance logic. |
| 2026-02-26 | JoshLind | [State Sync] Add request rate limiting. |
| 2026-02-26 | Zekun Li | [execution] Return CommitResult from start_commit to avoid spinning on blocked validation |
| 2026-02-25 | gelash | [execution] Simplify cold validation pending requirements to single entry |
| 2026-03-01 | wqfish | [storage] Add missing RocksDB ticker stats to Prometheus reporter |
| 2026-02-26 | wqfish | [storage] Set fill_cache(false) on backup handler RocksDB reads |
| 2026-02-26 | JoshLind | [State Sync] Account for validator-PFN connections. |
| 2026-02-28 | banool | Add private view functions to the ABI (#18871) |
| 2026-02-28 | wqfish | [storage] Report RocksDB ticker statistics via Prometheus |
| 2026-02-28 | wqfish | [storage] Replace pruner worker polling with channel-based wake |
| 2026-02-28 | wrwg | [vm] Fixing issues with bounds and recursion (#18887) |
| 2026-02-28 | rustielin | [forge] Add Prometheus metrics for cluster spin-up and txn emitter (#18735) |
| 2026-02-27 | georgemitenkov | [execution] Fix cache flush (#18884) |
| 2026-02-27 | rahxephon89 | fix arbitrary (#18419) |
| 2026-02-27 | igor-aptos | trivial aptos-trading change to get it to aptos-framework repo (#18875) |
| 2026-02-24 | JoshLind | [Network] Add simple token bucket rate limiter implementation. |
| 2026-02-26 | wrwg | [prover] Add test for behavioral predicates on opaque functions (TODO #18762) (#18836) |
| 2026-02-26 | banool | [faucet] Use auth headers in all cases (#18863) |
| 2026-02-26 | wrwg | [move-flow] Add move-flow crate with plugin generator and MCP stdio server (#18823) |
| 2026-02-26 | wqfish | [Storage] Add hot state cache age metrics |
| 2026-02-25 | wqfish | [storage] Distinguish hot vs cold metrics in StateMerkleDb and StateKvDb |
| 2026-02-26 | junxzm1990 | [compiler v2] enable warnings on unused private funcs, structs, and constants (#18661) |
| 2026-02-25 | jtang17 | Configurable settings for grpc heartbeat and staleness (#18854) |
| 2026-02-25 | gregnazario | fix(testsuite): update Python dependencies to resolve security vulnerabilities (#18844) |
| 2026-02-25 | wrwg | [vm] Extract aptos-framework-natives and aptos-release-bundle to break rebuild chains (#18788) |
| 2026-02-25 | danielxiangzl | [consensus] Defer randomness aggregation for non-rand blocks (#18699) |
| 2026-02-25 | wqfish | [node] Name all unnamed threads on the aptos-node path |
| 2026-02-24 | Zekun Li | [execution] Fetch and store persisted auxiliary info in replay-benchmark download |
| 2026-02-24 | wqfish | [storage] Refactor StateKvDb to follow StateMerkleDb pattern |
| 2026-02-24 | wqfish | [storage] Update hot state deferred merge metrics more frequently |

_… and 13 more._

### Week of 2026-02-16  (34 commits)

Active subsystems: **other** (18), **storage** (6), **network** (2), **ci** (1), **execution** (1), **gas** (1), **compiler-v2** (1), **crypto** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-02-19 | cursoragent | [Peer Monitoring Service] Add disconnect logic for peers with too many ping failures |
| 2026-02-19 | JoshLind | [Network] Remove subscription logic from PeersAndMetadata. |
| 2026-02-22 | waamm | Add Shplonked PCS, PCS tests and aptos-dkg refactoring (#18755) |
| 2026-02-21 | banool | Delete node-checker code (#18816) |
| 2026-02-21 | banool | [#13806] Include enums in the ABI returned by the node API (#18813) |
| 2026-02-20 | gregnazario | Rosetta fee payer tracking (#18799) |
| 2026-02-20 | vgao1996 | [gas profiler] major UI overhaul (#18690) |
| 2026-02-20 | wqfish | [Storage] Fix HotState crash on stale merged_state |
| 2026-02-20 | wqfish | [ci] Skip clang install in dev_setup.sh when already present |
| 2026-02-19 | wqfish | [execution] Fix executor benchmark: derive timestamps from DB state |
| 2026-02-20 | rex1fernando | Fix typo (#18800) |
| 2026-02-20 | rex1fernando | [encrypted mempool] Misc. cleanup of `aptos-batch-encryption` crate (#18796) |
| 2026-02-19 | wqfish | [storage] Set fill_cache(false) on pruner RocksDB reads |
| 2026-02-19 | JoshLind | [Gas] Bump Gas Version to v1.43 (#18794) |
| 2026-02-18 | wqfish | [node] Reduce default thread counts for backup and index-db runtimes |
| 2026-02-19 | wqfish | Rust 1.92 |
| 2026-02-19 | ibalajiarun | [test] Add encrypted transaction decryption smoke test (#18760) |
| 2026-02-18 | JoshLind | [Network] Remove old netbench code. |
| 2026-02-19 | vineethk | Signed integer support in transactional test arguments (#18783) |
| 2026-02-19 | vineethk | [compiler-v2] Fix parsing of signed int returns (#18780) |
| 2026-02-19 | ibalajiarun | [crypto] bump slh_dsa version and fix trait issues (#18787) |
| 2026-02-18 | ibalajiarun | fixup! [api][sdk] Add encryption key header, encrypted transaction builder, and emitter support |
| 2026-02-18 | vgao1996 | [TSS] add gas profiler support and bump CLI version (#18778) |
| 2026-02-18 | rex1fernando | Make prepare and decrypt work on individual cts (#18786) |
| 2026-02-18 | wqfish | [state-sync] Combine 4 state-sync tokio runtimes into one shared runtime |
| 2026-02-18 | ibalajiarun | [gha][docker] upgrade buildx cli version (#18785) |
| 2026-02-18 | wqfish | [jemalloc] Revamp jemalloc metrics and add HPA stats |
| 2026-02-18 | wqfish | [storage] Fix HotState race condition via RCU / deferred merge |
| 2026-02-17 | vgao1996 | [TSS] implement new_block and advance_epoch (#18691) |
| 2026-02-17 | zjma | crypto native cleanup (#18713) |

_… and 4 more._

### Week of 2026-02-09  (74 commits)

Active subsystems: **other** (38), **vm** (8), **consensus** (5), **compiler** (4), **storage** (4), **framework** (3), **types** (3), **api** (2)

| Date | Author | Title |
|------|--------|-------|
| 2026-02-14 | ibalajiarun | [vm][execution] Support encrypted transaction execution |
| 2026-02-14 | ibalajiarun | [api][sdk] Add encryption key header, encrypted transaction builder, and emitter support |
| 2026-02-14 | ibalajiarun | [consensus] Propagate SecretSharedKey to consensus observer via PipelinedBlock |
| 2026-02-14 | ibalajiarun | [consensus] Add decryption pipeline and secret share management |
| 2026-02-15 | ibalajiarun | [vm][genesis][api] Wire encryption key through execution and genesis |
| 2026-02-15 | ibalajiarun | [framework] Add PerEpochEncryptionKey to decryption module |
| 2026-02-15 | ibalajiarun | [dkg] Derive encryption key from DKG transcript |
| 2026-02-15 | ibalajiarun | [types] Add encrypted transaction types |
| 2026-02-15 | ibalajiarun | [types] Refactor DKG output types and add encryption key resource |
| 2026-02-14 | wrwg | [prover] Remove dead CLI options and flags (#18743) |
| 2026-02-14 | georgemitenkov | [vm] Use async type checks as default (#18752) |
| 2026-02-14 | wrwg | [compiler] Remove move-errmapgen crate (#18740) |
| 2026-02-13 | wqfish | [storage] Make is_descendant_of check strict by walking the parent chain |
| 2026-02-14 | georgemitenkov | [vm] Improve type depth tracking and async runtime checks (#18728) |
| 2026-02-14 | waamm | Redesign PVSS traits (#18718) |
| 2026-02-13 | wrwg | [abigen] Move move-abigen out of move-prover into move/tools (#18742) |
| 2026-02-13 | rex1fernando | [encrypted mempool] Update HKDF in `aptos-batch-encryption` to be consistent with RFC-5869 (#18716) |
| 2026-02-13 | wrwg | [tools][cleanup] Move move-docgen out of move-prover into move/tools (#18741) |
| 2026-02-13 | lightmark | [stake] Prevent from empty validator set (#18280) |
| 2026-02-13 | georgemitenkov | [fix] cherry pick missed feature activation times (#18745) |
| 2026-02-13 | wrwg | [compiler] Remove move-cli crate, relocate shared modules to move-unit-test and move-prover (#18736) |
| 2026-02-13 | ibalajiarun | [framework][vm] Add chunky DKG reconfiguration and VM support (#18541) |
| 2026-02-13 | banool | Pruned version stream unavailable (#18581) |
| 2026-02-12 | rex1fernando | [encrypted mempool] Switch hash-to-curve implementation in `aptos-batch-encryption` to the ones in ` |
| 2026-02-12 | wqfish | Tune jemalloc config to reduce memory fragmentation |
| 2026-02-12 | vineethk | Remove the use of mvir files in various places, instead, using masm (#18685) |
| 2026-02-12 | igor-aptos | remove validations from aptos-trading (#18727) |
| 2026-02-10 | JoshLind | [State Sync] Reduce max client transaction and output request sizes. |
| 2026-02-10 | JoshLind | [State Sync] Set default syncing mode to output syncing, and bump |
| 2026-02-12 | wrwg | [model] Improve sourcifier spec output formatting (#18579) |

_… and 44 more._

### Week of 2026-02-02  (23 commits)

Active subsystems: **other** (11), **docker** (3), **framework** (2), **dkg** (2), **cli** (1), **forge** (1), **release** (1), **telemetry** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-02-06 | ibalajiarun | [docker] Migrate from Debian Bullseye to Trixie (#18621) |
| 2026-02-06 | wqfish | Tune jemalloc configuration for better perf |
| 2026-02-06 | zjma | stake.move maintenance (#18641) |
| 2026-02-06 | vineethk | [cli] Fix some issues in the CLI with move tooling (#18616) |
| 2026-02-06 | wqfish | Reduce number of threads for peer monitoring service |
| 2026-02-06 | wqfish | Reduce number of threads for telemetry service |
| 2026-02-06 | wqfish | Reduce worker threads for admin service and inspection service |
| 2026-02-05 | ibalajiarun | [gha][docker] upgrade buildx version (#18617) |
| 2026-02-05 | ibalajiarun | [gha][docker] use runs-on snapshots for caching (#18606) |
| 2026-02-05 | waamm | Fix imports |
| 2026-02-05 | waamm | Introduce Aggregated type for PVSS aggregation in aptos-dkg (#18514) |
| 2026-02-05 | calintat | [framework] Add abort messages to some native functions (#18534) |
| 2026-02-05 | aptos-bot | [forge] bump deployer version |
| 2026-02-05 | wqfish | Rust 1.91 |
| 2026-02-05 | ibalajiarun | [dkg] Integrate ChunkyDKGManager with epoch manager (#18545) |
| 2026-02-05 | ibalajiarun | [framework] Add chunky DKG Move modules (#18540) |
| 2026-02-05 | ibalajiarun | [dkg] Add ChunkyDKGManager and missing transcript fetcher (#18544) |
| 2026-02-04 | rustielin | [telemetry] allow untrusted telemetry only on some paths (#18518) |
| 2026-02-04 | rahxephon89 | remove boogie (#18593) |
| 2026-02-04 | igor-aptos | adding aptos-trading (#18488) |
| 2026-02-04 | ibalajiarun | [consensus] Add ValidatorTransaction::ChunkyDKGResult and consensus hooks (#18539) |
| 2026-02-04 | ibalajiarun | Add BlockMetadataExt V2 with Decryption Key Support (#18444) |
| 2026-02-03 | calintat | [vm] Tidy up abort tests (#18513) |

### Week of 2026-01-26  (42 commits)

Active subsystems: **other** (20), **vm** (4), **network** (3), **framework** (3), **types** (3), **dkg** (2), **storage** (2), **execution** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-01-29 | JoshLind | [Network] Add priority peer list support |
| 2026-01-29 | cursoragent | [Peer Monitoring] Support metadata sanitization. |
| 2026-01-29 | ibalajiarun | [dkg] Add chunky DKG producers |
| 2026-02-01 | wqfish | [Storage] Fix for panics in state update code |
| 2026-01-29 | ibalajiarun | [dkg] Add chunky DKG types and module structure |
| 2026-01-31 | vgao1996 | [TSS] add support for randomness in local mode (#18573) |
| 2026-01-30 | Zekun Li | [framework] Use marker file for compiler change detection |
| 2026-01-30 | Zekun Li | [framework] Add hash-based caching for Move framework builds |
| 2026-01-30 | wqfish | [Storage] Improve error message in assertions |
| 2026-01-30 | ibalajiarun | [types] Add Chunky DKG types and on-chain config (#18538) |
| 2026-01-28 | JoshLind | [CI/CD] Add batch encryption test job. |
| 2026-01-28 | JoshLind | [Encrypted Txn] Add TypeScript tests for encrypted transactions |
| 2026-01-30 | banool | Remove Pontem from example documentation (#18561) |
| 2026-01-30 | wqfish | [Types] Use Self whenever possible in onchain config code |
| 2026-01-29 | ibalajiarun | [types] Extract randomness DKG types into separate module |
| 2026-01-30 | wqfish | [Execution] Implement Copy for a few onchain config types |
| 2026-01-29 | ibalajiarun | [crypto] Rename SecretSharingConfig trait to TSecretSharingConfig |
| 2026-01-29 | wqfish | Verify Cargo.lock and other files are not changed after running lints |
| 2026-01-29 | wqfish | Update Cargo.lock |
| 2026-01-29 | Zekun Li | [jwk] rename .pem to .txt |
| 2026-01-29 | ibalajiarun | [replay-verify] bump disk to 20Ti |
| 2026-01-29 | JoshLind | [REST API] Add `chain_id` and `node_type` to the `/info` endpoint (#18525) |
| 2026-01-29 | rex1fernando | [encrypted mempool] Add `verify_decryption_key` method to `BatchThresholdEncryption` trait (#18500) |
| 2026-01-29 | sitalkedia | [Orderbook] Return ClearinghouseStoppedMatching cancellation reason when matching stops (#18530) |
| 2026-01-29 | jtang17 | Signed integer test transaction format (#18546) |
| 2026-01-29 | georgemitenkov | [vm] Fix async code state replay (#18479) |
| 2026-01-29 | sitalkedia | [Orderbook] Bulk order callback to support order margin. (#18512) |
| 2026-01-29 | jtang17 | Add test transaction with signed int (#18527) |
| 2026-01-29 | zekun000 | Enhance log entry serialization by converting structured log values to strings using TruncatedLogStr |
| 2026-01-29 | vgao1996 | [mono move] add design of memory management and value representation (#18519) |

_… and 12 more._

### Week of 2026-01-19  (19 commits)

Active subsystems: **other** (8), **prover** (3), **state-sync** (2), **network** (1), **framework** (1), **compiler-v2** (1), **compiler** (1), **cli** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-01-21 | ibalajiarun | [qs] Handle BatchV2 network messages |
| 2026-01-24 | JoshLind | [Network] Add simple allow and blocklist. |
| 2026-01-25 | mkurnikov | [framework] use vector index expr whenever possible (#18457) |
| 2026-01-24 | mkurnikov | framework: use compound arithm expr (#18458) |
| 2026-01-24 | wrwg | [prover] Support tuple results in spec functions (#18450) |
| 2026-01-24 | wrwg | [prover] Add developer documentation for function values verification (#18493) |
| 2026-01-23 | vineethk | [compiler-v2] Make semicolon optional after block expressions (#18497) |
| 2026-01-23 | rex1fernando | [encrypted mempool] Return error when trying to initialize digest key with batch size not a power of |
| 2026-01-23 | calintat | [compiler] Allow using wildcard to match tuple (#18434) |
| 2026-01-23 | wrwg | [prover] Support tuple results in spec functions (#18484) |
| 2026-01-22 | wrwg | [cli] Fix MOVE_VM_STEP/MOVE_VM_TRACE for aptos move replay (#18486) |
| 2026-01-21 | sitalkedia | Bulk order rejection event and address various security feedback (#18477) |
| 2026-01-21 | georgemitenkov | [vm] Stack size checks for native calls (#18475) |
| 2026-01-20 | ibalajiarun | [qs] support pulling OptQuorumStorePayload::V2 (#18453) |
| 2026-01-20 | ibalajiarun | [qs] Populate BatchKind for BatchV2 (#18452) |
| 2026-01-20 | calintat | [move-unit-test] More information for unexpected aborts (#18432) |
| 2026-01-19 | JoshLind | [State Sync] Enable time-and-size aware storage reads. |
| 2026-01-19 | JoshLind | [State Sync] Increase state-sync network frame size. |
| 2026-01-19 | igor-aptos | separating out types (#18364) |

### Week of 2026-01-12  (26 commits)

Active subsystems: **other** (17), **forge** (3), **release** (3), **cli** (2), **api** (1), **compiler** (1), **storage** (1), **telemetry** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-01-17 | waamm | Wicher/more dkg edits (#18384) |
| 2026-01-16 | rex1fernando | Remove refs to unweighted chunky from aptos-batch-encryption (#18466) |
| 2026-01-16 | wrwg | [move-prover] Adding behavioral predicates to the type checker (#18429) |
| 2026-01-16 | mkurnikov | specs: properly desugar receiver style functions in let statements (#18438) |
| 2026-01-15 | ibalajiarun | [api] add validations for batch txn submission |
| 2026-01-15 | alinush | add support for SLH-DSA-SHA2-128s TXN authenticators (#18300) |
| 2026-01-15 | rex1fernando | Add conversion fns from blst consensus keys to chunky encryption keys (#18454) |
| 2026-01-15 | aptos-bot | [forge] bump deployer version (#18446) |
| 2026-01-14 | wrwg | [move-prover] Adding behavioral predicates to the parser (#18428) |
| 2026-01-14 | ibalajiarun | [qs] fix flaky batch store test |
| 2026-01-14 | wqfish | [Hot State] Include HotVacant slots in root hash |
| 2026-01-14 | wqfish | Calibrate execution performance benchmark |
| 2026-01-14 | junxzm1990 | [compiler] fix issue 18335 (#18411) |
| 2026-01-14 | vgao1996 | [transaction simulation] fix bug in fund_apt_fungible_store (#18448) |
| 2026-01-14 | wqfish | [Hot State] Compute root hash for hot state |
| 2026-01-14 | wqfish | [Storage] Move log out of loop in StateSnapshotCommitter |
| 2026-01-14 | rex1fernando | [encrypted mempool] Switch curve to BLS (#18442) |
| 2026-01-14 | rex1fernando | Add succinct-ciphertext version of batch encryption (#18439) |
| 2026-01-14 | wqfish | [Layered Map] Expose inner layers |
| 2026-01-14 | wrwg | [ai] Basic setup for Cursor/Claude agents.md (#18413) |
| 2026-01-13 | vgao1996 | [cli] bump version to 7.14 (#18440) |
| 2026-01-13 | aptos-bot | [forge] bump deployer version (#18435) |
| 2026-01-13 | vgao1996 | [cli][txn sim sessions] support code object and chunked publishing (#18329) |
| 2026-01-12 | igor-aptos | Fix test_only timestamp::fast_forward_seconds for extra microseconds (#18415) |
| 2026-01-12 | aptos-bot | [forge] bump deployer version (#17266) |
| 2026-01-12 | rustielin | [telemetry] support prometheus sink (#18336) |

### Week of 2026-01-05  (18 commits)

Active subsystems: **other** (13), **compiler** (1), **vm** (1), **framework** (1), **consensus** (1), **storage** (1)

| Date | Author | Title |
|------|--------|-------|
| 2026-01-10 | vusirikala | Set reserve bit in monotonically increasing counters (#18418) |
| 2026-01-09 | calintat | [compiler] Overload Move abort to support messages (#18403) |
| 2026-01-09 | calintat | [vm] New bytecode for aborting with message (#18347) |
| 2026-01-09 | sitalkedia | [Orderbook] Cleanup client order id mapping when taking ready time based order (#18417) |
| 2026-01-08 | 0xmaayan | sui daa security audit fixes (#18398) |
| 2026-01-08 | wqfish | [Hot State] Add a separate StateMerkleDb for hot state |
| 2026-01-08 | wqfish | [Storage Config] Make db path override related fields private |
| 2026-01-08 | calintat | [framework] Add `String::into_bytes` function (#18395) |
| 2026-01-08 | ibalajiarun | [consensus] support secret sharing manager in execution client (#18313) |
| 2026-01-07 | wqfish | Enable memory profiling by default |
| 2026-01-07 | wqfish | Update jemalloc to latest version |
| 2026-01-07 | wqfish | [Storage] Fix error message formatting in config |
| 2026-01-07 | wqfish | [Hot State] Use config to replace hard-coded parameters |
| 2026-01-07 | igor-aptos | orderbook events (#18277) |
| 2026-01-07 | ibalajiarun | [encrypted-mempool] use FTXWeighted instead of FTX (#18409) |
| 2026-01-07 | wqfish | [Hot State] Delete unused code |
| 2026-01-06 | igor-aptos | [AIP-105] Make mem::swap and mem::replace public (#18330) |
| 2026-01-06 | junxzm1990 | [aptos cli] update cli 7.13.0 to mark lang version 2.3 and bytecode version 9 as default (#18400) |

### Week of 2025-12-29  (6 commits)

Active subsystems: **other** (3), **vm** (2), **cli** (1)

| Date | Author | Title |
|------|--------|-------|
| 2025-12-30 | banool | [GEO-328] Add signed integers to protos and indexer type conversion code (#18394) |
| 2025-12-30 | vineethk | [cli] Update CLI to use latest formatter and mutation testing tool (#18373) |
| 2025-12-30 | wrwg | [VM] Add code coverage support for e2e tests (#18337) |
| 2025-12-29 | junxzm1990 | [aptos cli] set language version 2.3 as stable and release cli 7.13.0 (#18391) |
| 2025-12-29 | calintat | [vm] New VM instruction for aborting with message (#18316) |
| 2025-12-29 | junxzm1990 | [move linter] revise a linter name (#18387) |

### Week of 2025-12-22  (4 commits)

Active subsystems: **other** (3), **vm** (1)

| Date | Author | Title |
|------|--------|-------|
| 2025-12-26 | ibalajiarun | [batch-encryption] remove happy path in trait and impls |
| 2025-12-28 | github-actions[bot] | Update Docker images (#17328) |
| 2025-12-27 | vineethk | [move-vm] Native function modeling for runtime reference safety checker (#18346) |
| 2025-12-27 | zi0Black | IndexedRef Runtime TAG (#18142) |

