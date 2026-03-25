# Report Quality Audit

**Date:** 2026-03-25
**Source:** `web/public/data/reports.json`
**Knowledge base:** `knowledge-base/subsystems/INDEX.md` + 8 subsystem files

---

## Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Total reports | 615 | 100% |
| GOOD (>1500 chars, specific code refs, substantive tech context) | 6 | 0% |
| OKAY (>800 chars, some technical content but lacks depth) | 358 | 58% |
| BAD (<800 chars, template filler, or no real content) | 251 | 40% |

### Scoring Criteria

- **GOOD**: >=1500 chars in `advanced` field, >=3 meaningful `<code>` references to structs/functions/files (excluding commit SHAs, URLs, and pipeline boilerplate), and a substantive "Technical Context" or "How It Works" section (>200 chars of non-boilerplate text).
- **OKAY**: >=800 chars, has some technical content but is missing specific code references, has a generic/thin technical context section, or is under 1500 chars.
- **BAD**: <800 chars (too short to be useful), OR contains the template filler string "General improvements to the Aptos blockchain core infrastructure" as its primary technical content with no real analysis.

---

## BAD Reports (251 total)

These reports need re-generation. They are either stubs, template filler, or too short to provide value.

### By Category

| Category | Count |
|----------|-------|
| Infrastructure | 224 |
| Framework | 9 |
| Other | 5 |
| Feature Progress | 3 |
| Move/Compiler | 2 |
| Crypto | 2 |
| VM | 2 |
| Indexer | 1 |
| State Sync | 1 |
| API | 1 |
| Execution | 1 |

### Full List

| SHA / ID | Title | Category | Length | Reason |
|----------|-------|----------|--------|--------|
| `3417442230` | [forge] bump deployer version | Other | 68 | too short (68 chars) |
| `3409577692` | [aptos-release-v1.41] Bump version to 1.41.9 | Other | 83 | too short (83 chars) |
| `3424787125` | [localnet] Add --use-internal-fullnode-data-interface | Other | 92 | too short (92 chars) |
| `3426034965` | Fix replay_protection_nonce for encrypted transactions | Other | 93 | too short (93 chars) |
| `3426107757` | [forge] Add auto-restart, pre-built binary support, and use clang... | Other | 120 | too short (120 chars) |
| `337b951` | Retry PR | Infrastructure | 885 | template filler with generic content |
| `72b6f26` | lints | Infrastructure | 889 | template filler with generic content |
| `efdad23` | Fix imports | Infrastructure | 891 | template filler with generic content |
| `6adb768` | Rust 1.91 | Infrastructure | 891 | template filler with generic content |
| `acfb3d2` | Rust 1.92 | Infrastructure | 892 | template filler with generic content |
| `095b361` | [cached-packages] Update head.mrb (#18702) | Infrastructure | 897 | template filler with generic content |
| `50ea8f0` | a few renames | Infrastructure | 897 | template filler with generic content |
| `ad217ee` | fix (#18292) | Infrastructure | 898 | template filler with generic content |
| `000645a` | fix (#18275) | Infrastructure | 898 | template filler with generic content |
| `edd4d77` | Initial attempt (#18714) | Infrastructure | 899 | template filler with generic content |
| `bcf0d65` | Update Cargo.lock | Infrastructure | 899 | template filler with generic content |
| `5fff9a9` | [framework] Add support for reflection (#17892) | Framework | 899 | template filler with generic content |
| `ae06823` | fix (#18191) | Infrastructure | 899 | template filler with generic content |
| `c7cd8ed` | Delay testnet a few hours | Infrastructure | 900 | template filler with generic content |
| `218295f` | added benchmarks | Infrastructure | 900 | template filler with generic content |
| `e33e3c1` | [executor] optimize ledger update | Execution | 900 | template filler with generic content |
| `ecb203d` | [Layered Map] Expose inner layers | Infrastructure | 901 | template filler with generic content |
| `78e3721` | fix arbitrary bug | Infrastructure | 901 | template filler with generic content |
| `54418cb` | update license | Infrastructure | 901 | template filler with generic content |
| `217839e` | Update ver.rs (#19020) | Infrastructure | 902 | template filler with generic content |
| `90d13e2` | Add SerializeForTranscript | Infrastructure | 903 | template filler with generic content |
| `9dd5044` | crypto native cleanup (#18713) | Infrastructure | 903 | template filler with generic content |
| `d8e7be6` | Bump CLI to 8.0.0 (#18692) | Infrastructure | 903 | template filler with generic content |
| `99e479c` | stake.move maintenance (#18641) | Infrastructure | 903 | template filler with generic content |
| `516c64a` | Redesign PVSS traits (#18718) | Infrastructure | 904 | template filler with generic content |
| `9ad8d18` | refactor (#15522) | Infrastructure | 904 | template filler with generic content |
| `94ce8a4` | fix SK serialization | Infrastructure | 904 | template filler with generic content |
| `1702f89` | Various optimizations | Infrastructure | 904 | template filler with generic content |
| `00dc14c` | fix warnings in natives (#18829) | Infrastructure | 905 | template filler with generic content |
| `6ab5a72` | [jwk] rename .pem to .txt | Infrastructure | 905 | template filler with generic content |
| `370e842` | Fix typo (#18800) | Infrastructure | 906 | template filler with generic content |
| `971a021` | PVSS trait refactoring (#18303) | Infrastructure | 906 | template filler with generic content |
| `82d9619` | [txn-emitter] fix logging (#18251) | Infrastructure | 906 | template filler with generic content |
| `5e6f48f` | Allow Unicode-3.0 license (#18921) | Infrastructure | 907 | template filler with generic content |
| `a14f4d3` | test PK deserialization | Infrastructure | 907 | template filler with generic content |
| `ba4e638` | remove boogie (#18593) | Infrastructure | 908 | template filler with generic content |
| `3dc513f` | orderbook events (#18277) | Infrastructure | 908 | template filler with generic content |
| `fe393e0` | clean up slh_dsa_sigs.rs | Infrastructure | 908 | template filler with generic content |
| `c2f7af0` | fix arbitrary (#18419) | Infrastructure | 909 | template filler with generic content |
| `d5eb55c` | [trivial] Remove unused module (#18663) | Infrastructure | 909 | template filler with generic content |
| `1543a9c` | [replay-verify] bump disk to 20Ti | Infrastructure | 909 | template filler with generic content |
| `3d9bcda` | some cleanups (#18377) | Infrastructure | 909 | template filler with generic content |
| `30f051b` | address joshboss comme nt | Infrastructure | 909 | template filler with generic content |
| `f719bce` | remove old TODOs (#18971) | Infrastructure | 910 | template filler with generic content |
| `66e7080` | [framework] cleanup module events if clause (#18889) | Framework | 910 | template filler with generic content |
| `b0c5e40` | Delete node-checker code (#18816) | Infrastructure | 910 | template filler with generic content |
| `db04383` | [Batch Encryption] Remove sha2-asm feature. | Infrastructure | 910 | template filler with generic content |
| `bf2f2d8` | release 7.11.1 (#18179) | Infrastructure | 910 | template filler with generic content |
| `436952b` | update golden files (#18980) | Infrastructure | 911 | template filler with generic content |
| `75b20fa` | [toolchain] Upgrade Rust toolchain to 1.93.1 | Infrastructure | 911 | template filler with generic content |
| `c0fb41f` | self in framework (#18326) | Infrastructure | 911 | template filler with generic content |
| `c119c06` | Edits around new field PVSS (#18172) | Infrastructure | 911 | template filler with generic content |
| `8a38adc` | [framework] Add `String::into_bytes` function (#18395) | Framework | 912 | template filler with generic content |
| `7716055` | IndexedRef Runtime TAG (#18142) | Infrastructure | 912 | template filler with generic content |
| `813481a` | separating move harness (#18981) | Infrastructure | 913 | template filler with generic content |
| `d9f84d8` | Improve chunky verifier speed (#18700) | Infrastructure | 913 | template filler with generic content |
| `ca20b4c` | adding aptos-trading (#18488) | Infrastructure | 913 | template filler with generic content |
| `b0102f4` | separating out types (#18364) | Infrastructure | 913 | template filler with generic content |
| `f6ecc2e` | test signing is deterministic | Infrastructure | 913 | template filler with generic content |
| `b6de7f7` | [log] change a few info to debug | Infrastructure | 913 | template filler with generic content |
| `eb6ae12` | Expand PVSS benchmarking tables (#18511) | Infrastructure | 914 | template filler with generic content |
| `fd0d96e` | [telemetry] support prometheus sink (#18336) | Infrastructure | 914 | template filler with generic content |
| `7787942` | Update jemalloc to latest version | Infrastructure | 914 | template filler with generic content |
| `2f99b2f` | [move linter] revise a linter name (#18387) | Infrastructure | 914 | template filler with generic content |
| `9360ec2` | test signature deserialization | Infrastructure | 914 | template filler with generic content |
| `767119a` | [License] Update license header in sdk | Infrastructure | 914 | template filler with generic content |
| `797f47b` | [indexer test transactions] Add test transaction for FA (#18240) | Infrastructure | 914 | template filler with generic content |
| `7e4af9d` | [License] Update license header in api | Infrastructure | 914 | template filler with generic content |
| `8e61d6d` | [gha] monitor gha rate limit (#18193) | Infrastructure | 914 | template filler with generic content |
| `e528be4` | [CI/CD] Add batch encryption test job. | Infrastructure | 915 | template filler with generic content |
| `c5ff83e` | Enable memory profiling by default | Infrastructure | 915 | template filler with generic content |
| `4796a42` | [move] Remove enabled features (#18290) | Move/Compiler | 915 | template filler with generic content |
| `180bb81` | Add otel tracing to grpc v2 stack (#18835) | Infrastructure | 916 | template filler with generic content |
| `0a82aea` | [move] Support signer receiver functions (#18925) | Move/Compiler | 916 | template filler with generic content |
| `5755d5e` | sui daa security audit fixes (#18398) | Infrastructure | 916 | template filler with generic content |
| `5454f95` | file format code gen (#18083) | Infrastructure | 916 | template filler with generic content |
| `36b4ed5` | [telemetry] support custom contracts (#18248) | Infrastructure | 916 | template filler with generic content |
| `3c75010` | [Pre-Commit] Remove old UTF8 license header. | Infrastructure | 916 | template filler with generic content |
| `7ed775e` | [License] Update license header in types | Infrastructure | 916 | template filler with generic content |
| `10271db` | [License] Update license header in tools | Infrastructure | 916 | template filler with generic content |
| `639cc08` | cleanup rolled out features (#18954) | Infrastructure | 917 | template filler with generic content |
| `e181420` | Update Hasura metadata for localnet | Infrastructure | 917 | template filler with generic content |
| `65f281d` | [voting] fix voting boundary issue (#18680) | Infrastructure | 917 | template filler with generic content |
| `869e427` | [License] Update license header in secure | Infrastructure | 917 | template filler with generic content |
| `c9cc0c1` | [License] Update license header in protos | Infrastructure | 917 | template filler with generic content |
| `b661f8e` | [License] Update license header in crates | Infrastructure | 917 | template filler with generic content |
| `34e7fae` | [License] Update license header in config | Infrastructure | 917 | template filler with generic content |
| `195056b` | [framework] Eliminate build.rs from aptos-cached-packages (#18625... | Framework | 918 | template filler with generic content |
| `dfe8add` | [telemetry-service] cache vm/prom backend paths (#18455) | Infrastructure | 918 | template filler with generic content |
| `fcbb4a7` | [License] Update license header in mempool | Infrastructure | 918 | template filler with generic content |
| `9136907` | [License] Update license header in keyless | Infrastructure | 918 | template filler with generic content |
| `d8b4266` | Pruned version stream unavailable (#18581) | Infrastructure | 919 | template filler with generic content |
| `70927c0` | [Pre-Commit] Remove shared UTF8 license header. | Infrastructure | 919 | template filler with generic content |
| `178b6d0` | [License] Update shared UTF8 license header | Infrastructure | 919 | template filler with generic content |
| `7afceff` | [License] Update license header in devtools | Infrastructure | 919 | template filler with generic content |
| `4d15777` | Delete legacy in-node indexer code (#18817) | Infrastructure | 920 | template filler with generic content |
| `8d48624` | [ai] Basic setup for Cursor/Claude agents.md (#18413) | Infrastructure | 920 | template filler with generic content |
| `840c041` | [License] Update license header in testsuite | Infrastructure | 920 | template filler with generic content |
| `a662082` | [License] Update license header in execution | Infrastructure | 920 | template filler with generic content |
| `97dca1c` | [License] Update license header in ecosystem | Infrastructure | 920 | template filler with generic content |
| `c1c0f39` | [framework] use vector index expr whenever possible (#18457) | Framework | 921 | template filler with generic content |
| `1e5bd51` | fix feature flag override (#18308) | Infrastructure | 921 | template filler with generic content |
| `c0aab97` | [License] Update license header in state-sync | Infrastructure | 921 | template filler with generic content |
| `33a21a1` | [License] Update license header in aptos-node | Infrastructure | 921 | template filler with generic content |
| `2867413` | [aptos fuzz] add fuzzing target for u256 (#18081) | Infrastructure | 921 | template filler with generic content |
| `214bb53` | Rosetta fee payer tracking (#18799) | Infrastructure | 922 | template filler with generic content |
| `479e258` | [blockstm] pre-write timestamp in mvhashmap (#18125) | Infrastructure | 922 | template filler with generic content |
| `120b417` | [License] Update license header for aptos-move | Infrastructure | 922 | template filler with generic content |
| `b099f92` | Add private view functions to the ABI (#18871) | Infrastructure | 923 | template filler with generic content |
| `0a04a63` | [model] Improve sourcifier spec output formatting (#18579) | Infrastructure | 923 | template filler with generic content |
| `6868648` | Update serde-reflection to fixed version | Infrastructure | 923 | template filler with generic content |
| `dce70c7` | [framework] Add abort messages to some native functions (#18534) | Framework | 923 | template filler with generic content |
| `b26c038` | Add test transaction with signed int (#18527) | Infrastructure | 923 | template filler with generic content |
| `c83c8f2` | Calibrate execution performance benchmark | Infrastructure | 923 | template filler with generic content |
| `8dbb447` | [transaction simulation] fix bug in fund_apt_fungible_store (#184... | Infrastructure | 923 | template filler with generic content |
| `ab7b6c9` | initial SLH DSA sha-128s implementation | Infrastructure | 923 | template filler with generic content |
| `e5a737c` | [License] Update original license header in api | Infrastructure | 923 | template filler with generic content |
| `ff3d47b` | [License] Update license header in experimental | Infrastructure | 923 | template filler with generic content |
| `957be7c` | update KeylessConfiguration comments (#18221) | Infrastructure | 923 | template filler with generic content |
| `58343ee` | Allow receivers on fully closed types (#18977) | Infrastructure | 924 | template filler with generic content |
| `4b5b553` | [jemalloc] Revamp jemalloc metrics and add HPA stats | Infrastructure | 924 | template filler with generic content |
| `ffcb5a7` | Last aptos-trading cleanup pass (#18665) | Infrastructure | 924 | template filler with generic content |
| `89de680` | [Priority Fee] Add a public function to set limit. (#18236) | Infrastructure | 924 | template filler with generic content |
| `0482484` | Tune jemalloc configuration for better perf | Infrastructure | 925 | template filler with generic content |
| `069136d` | [framework] Add hash-based caching for Move framework builds | Framework | 925 | template filler with generic content |
| `cc0556b` | Remove Pontem from example documentation (#18561) | Infrastructure | 925 | template filler with generic content |
| `beb39c0` | Signed integer test transaction format (#18546) | Infrastructure | 925 | template filler with generic content |
| `24841f8` | [License] Change license attribute in Cargo.toml | Infrastructure | 925 | template filler with generic content |
| `7830451` | [License] Update original license header in types | Infrastructure | 925 | template filler with generic content |
| `1a3d156` | Fix typescript tests flaking (#18696) | Infrastructure | 926 | template filler with generic content |
| `1e04020` | [Orderbook] Address security review feedback  (#18495) | Infrastructure | 926 | template filler with generic content |
| `20ae0d2` | framework: use compound arithm expr (#18458) | Infrastructure | 926 | template filler with generic content |
| `e3086a4` | Update crates/aptos-batch-encryption/Cargo.toml | Infrastructure | 926 | template filler with generic content |
| `3684dce` | Update crates/aptos-batch-encryption/Cargo.toml | Infrastructure | 926 | template filler with generic content |
| `650d4ab` | Add weighted batch encryption (#18267) | Infrastructure | 926 | template filler with generic content |
| `aeda017` | [License] Update original license header in protos | Infrastructure | 926 | template filler with generic content |
| `b6085ea` | [License] Update original license header in crates | Infrastructure | 926 | template filler with generic content |
| `831c41e` | [TSS] implement new_block and advance_epoch (#18691) | Infrastructure | 927 | template filler with generic content |
| `ff38b1d` | [move-unit-test] More information for unexpected aborts (#18432) | Infrastructure | 927 | template filler with generic content |
| `b747fba` | [License] Update original license header in mempool | Infrastructure | 927 | template filler with generic content |
| `a57c75d` | [License] Update original license header in keyless | Infrastructure | 927 | template filler with generic content |
| `e501527` | [crypto] bump slh_dsa version and fix trait issues (#18787) | Crypto | 928 | template filler with generic content |
| `4df7575` | Reduce number of threads for telemetry service | Infrastructure | 928 | template filler with generic content |
| `4e3b3ac` | Address Security review feedback 2 (#18279) | Infrastructure | 928 | template filler with generic content |
| `ca3072c` | [TSS] add support for randomness in local mode (#18573) | Infrastructure | 929 | template filler with generic content |
| `def1598` | [batch-encryption] remove happy path in trait and impls | Infrastructure | 929 | template filler with generic content |
| `d7d560c` | Update macOS runner version for CLI release (#18342) | Infrastructure | 929 | template filler with generic content |
| `d703654` | [License] Update original license header in testsuite | Infrastructure | 929 | template filler with generic content |
| `19f3179` | [License] Update original license header in execution | Infrastructure | 929 | template filler with generic content |
| `99a942b` | [License] Update original license header in ecosystem | Infrastructure | 929 | template filler with generic content |
| `2a50409` | [Pre-Commit] Add innovation license header to lint-rules. | Infrastructure | 929 | template filler with generic content |
| `d19b6b2` | Add key_prefix config to Redis ratelimit checker (#18997) | Infrastructure | 930 | template filler with generic content |
| `bf5780d` | [node] Name all unnamed threads on the aptos-node path | Infrastructure | 930 | template filler with generic content |
| `b8a58e8` | [AIP-105] Make mem::swap and mem::replace public (#18330) | Infrastructure | 930 | template filler with generic content |
| `1932b4d` | Switch small workflows to GH-hosted runners | Infrastructure | 930 | template filler with generic content |
| `74c45cf` | [License] Update original license header in aptos-move | Infrastructure | 930 | template filler with generic content |
| `41d77fb` | remove validations from aptos-trading (#18727) | Infrastructure | 931 | template filler with generic content |
| `7748a7a` | Sigma protocol for inhomogeneous tuple morphism (#18302) | Infrastructure | 931 | template filler with generic content |
| `d907240` | Add `aptos-batch-encryption` crate (#18217) | Infrastructure | 931 | template filler with generic content |
| `1cd5855` | inlining optimization for framework (#18175) | Infrastructure | 931 | template filler with generic content |
| `ecae5f6` | [smoke-test] Remove unused import in enable_feature test | Infrastructure | 932 | template filler with generic content |
| `b9a51b9` | [telemetry] Add extra_labels config for custom contracts (#18947) | Infrastructure | 932 | template filler with generic content |
| `68be9f7` | [move-flow] Spec inference tool, shared templates, and agent spli... | Infrastructure | 932 | template filler with generic content |
| `5ebd78c` | txn emitter: add latency for orderless (#18647) | Infrastructure | 932 | template filler with generic content |
| `6d4ebf8` | [License] Update original license header in experimental | Infrastructure | 932 | template filler with generic content |
| `7a288b6` | [framework] Update cached packages and docs for governance change | Framework | 933 | template filler with generic content |
| `1fa8dca` | [indexer] Fix potential overflow in ending version calculation (#... | Indexer | 933 | template filler with generic content |
| `70f4ff6` | [state-sync] Combine 4 state-sync tokio runtimes into one shared ... | State Sync | 933 | template filler with generic content |
| `2e14690` | Improve speed of chunky dealing and serialization (#18611) | Infrastructure | 933 | template filler with generic content |
| `073772e` | [Pre-Commit] Remove shared license from pre-commit allowlist. | Infrastructure | 933 | template filler with generic content |
| `1dda3c6` | Integrate pvss with batch encryption (#18252) | Infrastructure | 933 | template filler with generic content |
| `b24bd96` | Tune jemalloc config to reduce memory fragmentation | Infrastructure | 934 | template filler with generic content |
| `ffbc743` | [REST API] Add `chain_id` and `node_type` to the `/info` endpoint... | API | 934 | template filler with generic content |
| `391f1ac` | Linter fix bug in boolean expression equality (#18286) | Infrastructure | 934 | template filler with generic content |
| `acdc999` | [License] Remove original license header from source files | Infrastructure | 934 | template filler with generic content |
| `c643cbd` | [#13806] Include enums in the ABI returned by the node API (#1881... | Infrastructure | 935 | template filler with generic content |
| `c2dd9d2` | [telemetry] allow untrusted telemetry only on some paths (#18518) | Infrastructure | 935 | template filler with generic content |
| `58e85f3` | cleanups and test SK cloning and keypair generation | Infrastructure | 935 | template filler with generic content |
| `1a97948` | [framework] replace with receiver-style call expr in non-spec cod... | Framework | 936 | template filler with generic content |
| `3a7d0e6` | Support gRPC live mode for fullnodes (#18359) | Infrastructure | 936 | template filler with generic content |
| `2ae1ec6` | Weighted field PVSS and generic signing PVSS protocol (#18254) | Infrastructure | 936 | template filler with generic content |
| `379d47a` | [Orderbook] Bulk order callback to support order margin. (#18512) | Infrastructure | 937 | template filler with generic content |
| `08c4b71` | backfill staker passively for staking contract (#18276) | Infrastructure | 937 | template filler with generic content |
| `0136305` | Increase num orderless txns per user to 5000 (#18769) | Infrastructure | 938 | template filler with generic content |
| `ca448ec` | [Indexer gRPC] Add billing metrics to v2 data services (#18227) | Infrastructure | 938 | template filler with generic content |
| `aa70f3c` | [aptos-vm] Cache keyless configs in environment (#18180) | Infrastructure | 938 | template filler with generic content |
| `2b5e487` | Disable randomness fast path by default (#18644) | Infrastructure | 939 | template filler with generic content |
| `1c8726e` | [hotfix] Fix closure depth and unwrap in crypto natives (#371) (#... | Infrastructure | 939 | template filler with generic content |
| `2dbcb05` | [crypto] Rename SecretSharingConfig trait to TSecretSharingConfig | Crypto | 939 | template filler with generic content |
| `be9ff3e` | add support for SLH-DSA-SHA2-128s TXN authenticators (#18300) | Infrastructure | 939 | template filler with generic content |
| `0357d77` | Add object_code_deployment::get_code_object_signer (#19162) | Infrastructure | 941 | template filler with generic content |
| `816f71d` | [staking_contract] accurate staker and operator pending attributi... | Infrastructure | 941 | template filler with generic content |
| `3ee9148` | Configurable settings for grpc heartbeat and staleness (#18854) | Infrastructure | 942 | template filler with generic content |
| `3ee1cb1` | [move-vm] Native function modeling for runtime reference safety c... | VM | 942 | template filler with generic content |
| `78a3dba` | [move-flow] Add move-flow crate with plugin generator and MCP std... | Infrastructure | 944 | template filler with generic content |
| `9d8653e` | [node] Reduce default thread counts for backup and index-db runti... | Infrastructure | 944 | template filler with generic content |
| `7c796cc` | Signed integer support in transactional test arguments (#18783) | Infrastructure | 944 | template filler with generic content |
| `6102e4b` | Reduce worker threads for admin service and inspection service | Infrastructure | 944 | template filler with generic content |
| `ac16a37` | Set reserve bit in monotonically increasing counters (#18418) | Infrastructure | 944 | template filler with generic content |
| `e3fbb8b` | [move-flow] make mcp server resilient and add claude plugin readm... | Infrastructure | 945 | template filler with generic content |
| `3f17615` | Make prepare and decrypt work on individual cts (#18786) | Infrastructure | 945 | template filler with generic content |
| `e535ddb` | [fix] cherry pick missed feature activation times (#18745) | Infrastructure | 945 | template filler with generic content |
| `9e2cc98` | [mono move] add design of memory management and value representat... | Infrastructure | 945 | template filler with generic content |
| `adfb708` | Upgrade cc crate to 1.2.50 and stop setting LTO flags manually | Infrastructure | 945 | template filler with generic content |
| `38e5371` | Upgrade indexer processor SDK to v2.2.1 and processors to v2.4.0 ... | Infrastructure | 946 | template filler with generic content |
| `537d9bf` | Add orderless transactions in a MoveHarness function (#18338) | Infrastructure | 946 | template filler with generic content |
| `586fba8` | Remove thread pools from `aptos-batch-encryption` (#18232) | Infrastructure | 946 | template filler with generic content |
| `a98bd8c` | [Orderbook] Implement dead man's switch support for the orderbook... | Infrastructure | 947 | template filler with generic content |
| `0cf2d47` | Change arkworks dependencies to use custom version (#18231) | Infrastructure | 947 | template filler with generic content |
| `d181eb3` | [GEO-328] Add signed integers to protos and indexer type conversi... | Infrastructure | 948 | template filler with generic content |
| `30b2707` | fungible_asset::amount use self, duplicate metadata accessor (#19... | Infrastructure | 951 | template filler with generic content |
| `4238f36` | BigOrderedMap::remove_or_none fix and iter_remove improvement (#1... | Infrastructure | 951 | template filler with generic content |
| `dd86244` | Verify Cargo.lock and other files are not changed after running l... | Infrastructure | 951 | template filler with generic content |
| `2bc647f` | release builder - add framework release only some packages (#1867... | Infrastructure | 952 | template filler with generic content |
| `30b0d79` | Add support for txn filtering when streaming directly from the no... | Infrastructure | 952 | template filler with generic content |
| `eb53c9e` | [jemalloc] Add background thread for periodic jemalloc stats as P... | Infrastructure | 953 | template filler with generic content |
| `d4167d9` | remove unnecessary properties in ordered_map and big_ordered_map ... | Infrastructure | 955 | template filler with generic content |
| `09fc041` | trivial aptos-trading change to get it to aptos-framework repo (#... | Infrastructure | 956 | template filler with generic content |
| `b77a2a2` | Fix dlog algorithm issue and update batch encryption tests (#1829... | Infrastructure | 956 | template filler with generic content |
| `8f5ffca` | Increase expiration time requirement for orderless transactions (... | Infrastructure | 956 | template filler with generic content |
| `1cf4d5a` | Harden secret sharing: fix panics, resolve TODOs, clean dead code... | Infrastructure | 957 | template filler with generic content |
| `87ba2f5` | Remove the use of mvir files in various places, instead, using ma... | Infrastructure | 957 | template filler with generic content |
| `45e93a3` | Bulk order rejection event and address various security feedback ... | Infrastructure | 957 | template filler with generic content |
| `3307e04` | Remove refs to unweighted chunky from aptos-batch-encryption (#18... | Infrastructure | 957 | template filler with generic content |
| `1a40fb3` | specs: properly desugar receiver style functions in let statement... | Infrastructure | 957 | template filler with generic content |
| `089352a` | [masm] Add native function support for assembler-disassembler rou... | Infrastructure | 958 | template filler with generic content |
| `a1d2a25` | [tests][vm] Additional tests to increase code coverage of runtime... | VM | 958 | template filler with generic content |
| `99d5c8d` | [Orderbook] Cleanup client order id mapping when taking ready tim... | Infrastructure | 958 | template filler with generic content |
| `bb48aa3` | Fix license header following semantic merge issue with txn filter... | Infrastructure | 958 | template filler with generic content |
| `d66c28f` | Add support for configuring node txn stream worker count and chan... | Infrastructure | 958 | template filler with generic content |
| `402af26` | Move cancel_at_price_level from bulk_order_types to bulk_order_ut... | Infrastructure | 961 | template filler with generic content |
| `fb8f96f` | Fix test_only timestamp::fast_forward_seconds for extra microseco... | Infrastructure | 961 | template filler with generic content |
| `915b4c6` | Add fill id to bulk order fill event and cancellation reason to A... | Infrastructure | 961 | template filler with generic content |
| `0a91206` | Revert "Revert "Add support for configuring node txn stream worke... | Infrastructure | 964 | template filler with generic content |
| `73b1959` | Revert "Add support for configuring node txn stream worker count ... | Infrastructure | 965 | template filler with generic content |
| `2cd764e` | [security] Upgrade rustls 0.21.10 to 0.21.12 to fix complete_io i... | Infrastructure | 966 | template filler with generic content |
| `0d988b2` | [Orderbook] Return ClearinghouseStoppedMatching cancellation reas... | Infrastructure | 968 | template filler with generic content |
| `c383967` | Gate `0x1::crypto_algebra::multi_scalar_mul` by feature flag `CRY... | Infrastructure | 970 | template filler with generic content |
| `3b523ad` | fix(testsuite): update Python dependencies to resolve security vu... | Infrastructure | 974 | template filler with generic content |
| `0889259` | Update comments in fk_algorithm.rs to better explain circulant ma... | Infrastructure | 978 | template filler with generic content |
| `fa8b0cc` | [Indexer gRPC v2] Fix gap between batches when querying historica... | Infrastructure | 985 | template filler with generic content |
| `e837943` | Removed duplicate verify_with_challenge() | Feature Progress | 997 | template filler with generic content |
| `98a5312` | Add  fn to batch threshold encryption scheme, to allow validators... | Infrastructure | 1019 | template filler with generic content |
| `ba53803` | Add README.md for `aptos-batch-encryption` crate (#18969) | Feature Progress | 1021 | template filler with generic content |
| `ee13a1d` | Add num_rounds() fn to Digest, and rename capacity() to max_batch... | Feature Progress | 1046 | template filler with generic content |
| `ef82cf1` | Enhance log entry serialization by converting structured log valu... | Infrastructure | 1073 | template filler with generic content |

---

## OKAY Reports That Could Be Improved (358 total)

These reports have some content but lack the depth expected for a technical intelligence report. They could be improved by adding specific code references, deeper technical context, or more detailed explanations.

### By Category

| Category | Count |
|----------|-------|
| Infrastructure | 119 |
| Feature Progress | 37 |
| VM | 33 |
| Storage | 29 |
| Release | 23 |
| Consensus | 16 |
| Security | 15 |
| Move/Compiler | 12 |
| Testing | 11 |
| Networking | 9 |
| CLI | 9 |
| Performance | 8 |
| Execution | 8 |
| Prover | 8 |
| State Sync | 5 |
| API | 5 |
| Framework | 4 |
| Gas | 3 |
| CI/CD | 2 |
| Crypto | 1 |
| Keyless | 1 |

### Reports Closest to GOOD (could be upgraded with minor improvements)

| SHA / ID | Title | Category | Length | Code Refs | Issues |
|----------|-------|----------|--------|-----------|--------|
| `297966303` | [Mainnet] Aptos Node Release v1.41.9 | Release | 3232 | 2 | only 2 code refs |
| `297720165` | Aptos CLI Release v9.0.0 | Release | 1850 | 0 | only 0 code refs |
| `295329811` | [Testnet] Aptos Node Release v1.42.1-rc-hotfix | Release | 1645 | 0 | only 0 code refs |
| `42d83a9` | [consensus] Fix consensus observer encrypted transactio... | Feature Progress | 1503 | 0 | only 0 code refs |
| `b0f06a3` | [consensus] Add per-kind batch size control for encrypt... | Feature Progress | 1498 | 0 | only 0 code refs; moderate length (1498 chars) |
| `56e7bbc` | [consensus] Add ciphertext verification in QS batch ver... | Feature Progress | 1494 | 0 | only 0 code refs; moderate length (1494 chars) |
| `7752b62` | [consensus] Reduce log volume from additional high-freq... | Feature Progress | 1488 | 0 | only 0 code refs; moderate length (1488 chars) |
| `cf20544` | Fix PipelinedBlock BCS serialization for consensus obse... | Feature Progress | 1486 | 0 | only 0 code refs; moderate length (1486 chars) |
| `f064f03` | [consensus] Clear module cache on pipeline teardown to ... | Feature Progress | 1483 | 0 | only 0 code refs; moderate length (1483 chars) |
| `bd0f981` | [consensus] Update consensus, pipeline, and quorum stor... | Feature Progress | 1483 | 0 | only 0 code refs; moderate length (1483 chars) |
| `70724e1` | [consensus] Keep info! for signed ledger info in pipeli... | Feature Progress | 1477 | 0 | only 0 code refs; moderate length (1477 chars) |
| `d417d43` | [consensus] Reduce log volume from high-frequency info/... | Feature Progress | 1477 | 0 | only 0 code refs; moderate length (1477 chars) |
| `c02d7de` | [consensus] Add per-BatchKind txn limits in proposal pu... | Feature Progress | 1469 | 0 | only 0 code refs; moderate length (1469 chars) |
| `777f708` | [consensus] Remove randomness fast path code (#18870) | Feature Progress | 1463 | 0 | only 0 code refs; moderate length (1463 chars) |
| `026aac2` | [consensus] Fix nightly fmt in proposal_generator | Feature Progress | 1461 | 0 | only 0 code refs; moderate length (1461 chars) |
| `295824310` | [Mainnet] Aptos Node Release v1.41.9-hotfix | Release | 1447 | 0 | only 0 code refs; moderate length (1447 chars) |
| `e98ee0d` | Decryption pipeline perf and batch limit handling (#191... | Feature Progress | 1437 | 0 | only 0 code refs; moderate length (1437 chars) |
| `167e961` | [consensus] Add batch_version labels to quorum store me... | Release | 1432 | 0 | only 0 code refs; moderate length (1432 chars) |
| `04480bd` | [encrypted mempool] Change ID to be hash of both VK and... | Feature Progress | 1428 | 0 | only 0 code refs; moderate length (1428 chars) |
| `30ef782` | [encrypted mempool] Switch hash-to-curve implementation... | Infrastructure | 1408 | 0 | only 0 code refs; moderate length (1408 chars) |
| `11f6f5d` | Add conversion fns from blst consensus keys to chunky e... | Infrastructure | 1399 | 0 | only 0 code refs; moderate length (1399 chars) |
| `0c2ddd5` | [execution] Add hidden encrypted flag to txn emitter CL... | Feature Progress | 1395 | 0 | only 0 code refs; moderate length (1395 chars) |
| `f4f33f4` | [consensus] Add decryption pipeline and secret share ma... | Consensus | 1392 | 0 | only 0 code refs; moderate length (1392 chars) |
| `599deba` | [QS] Add per-author batch inclusion metrics (#19021) | Feature Progress | 1389 | 0 | only 0 code refs; moderate length (1389 chars) |
| `a072461` | [Consensus Observer] Downgrade root ledger info log to ... | Feature Progress | 1389 | 0 | only 0 code refs; moderate length (1389 chars) |
| `bf1e24a` | [consensus] Deprecate old Payload enum variants and str... | Consensus | 1384 | 0 | only 0 code refs; moderate length (1384 chars) |
| `ef31b30` | [consensus] Propagate SecretSharedKey to consensus obse... | Consensus | 1383 | 0 | only 0 code refs; moderate length (1383 chars) |
| `d1ada1f` | [Consensus Observer] Downgrade forwarding log to info. | Feature Progress | 1382 | 0 | only 0 code refs; moderate length (1382 chars) |
| `7a09118` | [encrypted mempool] Return error when trying to initial... | Infrastructure | 1382 | 0 | only 0 code refs; moderate length (1382 chars) |
| `668268d` | [consensus] Add instance name to ReliableBroadcast for ... | Consensus | 1381 | 0 | only 0 code refs; moderate length (1381 chars) |

### Reports Furthest from GOOD (need significant improvement)

| SHA / ID | Title | Category | Length | Code Refs | Issues |
|----------|-------|----------|--------|-----------|--------|
| `d32f05d` | Update Docker images | Infrastructure | 921 | 0 | only 0 code refs; content quality: thin; moderate length (921 chars) |
| `ca6ca88` | [prover] Global memory support for behavioral predicate... | Prover | 935 | 0 | only 0 code refs; content quality: thin; moderate length (935 chars) |
| `6aad346` | Update move formatter version (#19121) | Release | 938 | 0 | only 0 code refs; content quality: thin; moderate length (938 chars) |
| `03360ea` | [Smoke Tests] Ignore some unneccessary tests. | Infrastructure | 947 | 0 | only 0 code refs; content quality: thin; moderate length (947 chars) |
| `514405f` | [docker] disable push to ECR (#18595) | Infrastructure | 950 | 0 | only 0 code refs; content quality: thin; moderate length (950 chars) |
| `d4c2872` | [Peer Monitoring Service] Add disconnect logic for peer... | Infrastructure | 950 | 0 | only 0 code refs; content quality: thin; moderate length (950 chars) |
| `cb86dd1` | Use orderless tx on faucet (#18676) | Infrastructure | 957 | 0 | only 0 code refs; content quality: thin; moderate length (957 chars) |
| `a818326` | [faucet] Use auth headers in all cases (#18863) | Infrastructure | 958 | 0 | only 0 code refs; content quality: thin; moderate length (958 chars) |
| `cf49b54` | [gha][docker] upgrade buildx version (#18617) | Infrastructure | 960 | 0 | only 0 code refs; content quality: thin; moderate length (960 chars) |
| `a818a43` | [stake] Prevent from empty validator set (#18280) | Infrastructure | 962 | 0 | only 0 code refs; content quality: thin; moderate length (962 chars) |
| `3ab0c8b` | [gha][docker] upgrade buildx cli version (#18785) | Infrastructure | 965 | 0 | only 0 code refs; content quality: thin; moderate length (965 chars) |
| `ee24bde` | [localnet] Add --use-internal-fullnode-data-interface (... | Infrastructure | 965 | 0 | only 0 code refs; content quality: thin; moderate length (965 chars) |
| `2b2ae12` | [docker] remove ECR ref in release artifacts flow (#189... | Infrastructure | 971 | 0 | only 0 code refs; content quality: thin; moderate length (971 chars) |
| `4dd6f78` | [gha][docker] use runs-on snapshots for caching (#18606... | Infrastructure | 971 | 0 | only 0 code refs; content quality: thin; moderate length (971 chars) |
| `5869e16` | [execution] Fix executor benchmark: derive timestamps f... | Execution | 971 | 0 | only 0 code refs; content quality: thin; moderate length (971 chars) |
| `94be7dc` | Make faucet mint limits configurable per asset (#19172) | Infrastructure | 972 | 0 | only 0 code refs; content quality: thin; moderate length (972 chars) |
| `d24dbd5` | Update Docker images (#17328) | Infrastructure | 975 | 0 | only 0 code refs; content quality: thin; moderate length (975 chars) |
| `3eee552` | [docker] Migrate from Debian Bullseye to Trixie (#18621... | Infrastructure | 976 | 0 | only 0 code refs; content quality: thin; moderate length (976 chars) |
| `6b94793` | [Faucet] Add Multi Asset support to the Aptos faucet (#... | Infrastructure | 976 | 0 | only 0 code refs; content quality: thin; moderate length (976 chars) |
| `f7a776d` | [cli] bump version to 7.14 (#18440) | CLI | 978 | 0 | only 0 code refs; content quality: thin; moderate length (978 chars) |
| `b9a9e62` | [docker] Split build scripts into 4 parallel builders (... | Infrastructure | 982 | 0 | only 0 code refs; content quality: thin; moderate length (982 chars) |
| `0d82cb3` | Use the new runners for Docker Rust builds and checks | Infrastructure | 983 | 0 | only 0 code refs; content quality: thin; moderate length (983 chars) |
| `bab75db` | Revert "Use the new runners for Docker Rust builds and ... | Infrastructure | 992 | 0 | only 0 code refs; content quality: thin; moderate length (992 chars) |
| `8d6a964` | [forge] bump deployer version | Release | 995 | 0 | only 0 code refs; content quality: thin; moderate length (995 chars) |
| `ead601e` | [forge] bump deployer version | Release | 995 | 0 | only 0 code refs; content quality: thin; moderate length (995 chars) |
| `1180d8a` | Deploy multiple PFNs via helm releases (#19009) | Release | 996 | 0 | only 0 code refs; content quality: thin; moderate length (996 chars) |
| `f806a24` | [forge] bump deployer version | Release | 996 | 0 | only 0 code refs; content quality: thin; moderate length (996 chars) |
| `5383ed7` | [forge] bump deployer version | Release | 996 | 0 | only 0 code refs; content quality: thin; moderate length (996 chars) |
| `b937aad` | [forge] bump deployer version | Release | 996 | 0 | only 0 code refs; content quality: thin; moderate length (996 chars) |
| `2197ed3` | [forge] bump deployer version | Release | 996 | 0 | only 0 code refs; content quality: thin; moderate length (996 chars) |

---

## GOOD Reports (6 total)

These reports meet all quality criteria: sufficient length, specific code references, and substantive technical analysis.

| SHA / ID | Title | Category | Length | Code Refs |
|----------|-------|----------|--------|-----------|
| `297982933` | [Testnet] Aptos Node Release v1.42.1-rc | Release | 2933 | 3 |
| `3365897531` | Confidential assets v1.1 | Feature Progress | 2471 | 6 |
| `3431560849` | [forge] bump deployer version | Infrastructure | 2074 | 6 |
| `3368033534` | [storage] Persist hot state KV insertions/evictions to DB | Feature Progress | 3106 | 27 |
| `3366941053` | [prover] Global memory support for behavioral predicates | Feature Progress | 3364 | 9 |
| `3145594331` | Update Docker images | Infrastructure | 2617 | 6 |

---

## Pattern Analysis

### Subsystems With the Worst Reports

**Infrastructure** is overwhelmingly the worst category:
- 224 BAD reports out of 345 total Infrastructure reports (64% are BAD)
- Most Infrastructure BAD reports follow the same template: a single sentence with the PR title, the boilerplate pipeline diagram, and "General improvements to the Aptos blockchain core infrastructure" as the technical context.

### BAD Rate by Category

| Category | Total | BAD | BAD Rate |
|----------|-------|-----|----------|
| Infrastructure | 345 | 224 | 64% |
| Feature Progress | 43 | 3 | 6% |
| VM | 35 | 2 | 5% |
| Storage | 29 | 0 | 0% |
| Release | 24 | 0 | 0% |
| Consensus | 16 | 0 | 0% |
| Security | 15 | 0 | 0% |
| Move/Compiler | 14 | 2 | 14% |
| Framework | 13 | 9 | 69% |
| Testing | 11 | 0 | 0% |
| Networking | 9 | 0 | 0% |
| Execution | 9 | 1 | 11% |
| CLI | 9 | 0 | 0% |
| Performance | 8 | 0 | 0% |
| Prover | 8 | 0 | 0% |
| State Sync | 6 | 1 | 16% |
| API | 6 | 1 | 16% |
| Other | 5 | 5 | 100% |
| Gas | 3 | 0 | 0% |
| Crypto | 3 | 2 | 66% |
| CI/CD | 2 | 0 | 0% |
| Indexer | 1 | 1 | 100% |
| Keyless | 1 | 0 | 0% |

### Key Observations

1. **Template filler is the dominant quality problem.** 246 of 251 BAD reports (98%) use the exact same boilerplate: "General improvements to the Aptos blockchain core infrastructure." These reports add no analytical value.
2. **Only 6 of 615 reports (1%) meet the GOOD quality bar.** The vast majority of reports lack specific code references to structs, functions, or file paths.
3. **Infrastructure category is most affected** because these commits (CI, tooling, version bumps) received the least analytical effort during generation.
4. **The OKAY reports (358) have meaningful content** but typically lack the specific `<code>` references to Aptos types like `RoundManager`, `BlockExecutor`, `JellyfishMerkleTree`, `AptosDB`, etc. that would tie them to the knowledge base.
5. **Two distinct report templates exist**: commits use a "Technical Context" section, while PRs/releases use "How It Works (Step by Step)" + "Architectural Connections". The PR template tends to produce higher quality reports.
6. **Categories with 0% BAD rate**: Release, Consensus, Security, Networking, CLI, Performance, Prover, Testing, Gas, CI/CD, Keyless -- these subsystem-specific categories consistently produce at least OKAY content.
