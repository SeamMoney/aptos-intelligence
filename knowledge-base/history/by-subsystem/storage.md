# Subsystem: storage

> Auto-generated on 2026-03-24

## Activity summary

| Window | Commits |
|--------|--------:|
| Last 30 days | 22 |
| Last 60 days | 34 |
| Last 90 days | 36 |
| All fetched   | 37 |

## Most active contributors

| Author | Commits |
|--------|--------:|
| wqfish | 33 |
| grao1991 | 4 |

## Recent commits

| Date | Author | Title |
|------|--------|-------|
| 2026-03-23 | wqfish | [storage] Persist hot state KV insertions/evictions to DB |
| 2026-03-19 | wqfish | [storage] Persist WriteSet hotness in ledger DB behind config flag |
| 2026-03-12 | wqfish | [storage] Use HashValue as DashMap key in hot state |
| 2026-03-12 | wqfish | [storage] Remove dead StaleStateValueIndexSchema |
| 2026-03-11 | wqfish | [storage] Fix state KV truncation leaking first-time key creations |
| 2026-03-11 | wqfish | [storage] Move test_truncation out of db_debugger into regular test path |
| 2026-03-10 | wqfish | [storage] Remove dead StateValueSchema and legacy monolithic ledger DB support |
| 2026-03-10 | wqfish | [storage] Clean up all #[allow(dead_code)] under storage/ |
| 2026-03-09 | wqfish | [storage] Skip BLS signing in ledger_metadata_db tests |
| 2026-03-06 | wqfish | [storage] Raise L0 write stall triggers on sequential-key ledger CFs |
| 2026-03-03 | wqfish | [storage] Document commit_no_progress in StateMerkleDb |
| 2026-03-01 | wqfish | [storage] Add missing RocksDB ticker stats to Prometheus reporter |
| 2026-03-02 | grao1991 | [Storage] Remove the old indexer (#18860) |
| 2026-02-26 | wqfish | [storage] Set fill_cache(false) on backup handler RocksDB reads |
| 2026-02-28 | wqfish | [storage] Report RocksDB ticker statistics via Prometheus |
| 2026-02-28 | wqfish | [storage] Replace pruner worker polling with channel-based wake |
| 2026-02-26 | wqfish | [Storage] Add hot state cache age metrics |
| 2026-02-25 | wqfish | [storage] Distinguish hot vs cold metrics in StateMerkleDb and StateKvDb |
| 2026-02-24 | wqfish | [storage] Refactor StateKvDb to follow StateMerkleDb pattern |
| 2026-02-24 | wqfish | [storage] Update hot state deferred merge metrics more frequently |
| 2026-02-24 | wqfish | [Storage] Reduce RocksDB property reporter overhead |
| 2026-02-23 | grao1991 | [Storage] Remove non-sharding and other dead code. (#18818) |
| 2026-02-20 | wqfish | [Storage] Fix HotState crash on stale merged_state |
| 2026-02-19 | wqfish | [storage] Set fill_cache(false) on pruner RocksDB reads |
| 2026-02-18 | wqfish | [storage] Fix HotState race condition via RCU / deferred merge |
| 2026-02-16 | wqfish | [storage] Disable compaction-based write stalling for append-only ledger sub-DBs |
| 2026-02-16 | wqfish | [Storage] Bump default number of low priority threads to 4 |
| 2026-02-16 | wqfish | [Storage] Fix max background job setting |
| 2026-02-13 | wqfish | [storage] Make is_descendant_of check strict by walking the parent chain |
| 2026-02-11 | wqfish | [storage] Fix incorrect assertion in LedgerState::new |
| 2026-02-11 | grao1991 | [Storage] Start a thread to cleanup some stale JMT nodes. (#18688) |
| 2026-02-10 | grao1991 | [Storage] Add a tool to check stale nodes that should be pruned but haven't. (#18681) |
| 2026-02-01 | wqfish | [Storage] Fix for panics in state update code |
| 2026-01-30 | wqfish | [Storage] Improve error message in assertions |
| 2026-01-14 | wqfish | [Storage] Move log out of loop in StateSnapshotCommitter |
| 2026-01-07 | wqfish | [Storage] Fix error message formatting in config |
| 2025-11-19 | wqfish | [Storage] Enable filters for state kv |
