# Subsystem: consensus

> Auto-generated on 2026-03-24

## Activity summary

| Window | Commits |
|--------|--------:|
| Last 30 days | 19 |
| Last 60 days | 25 |
| Last 90 days | 26 |
| All fetched   | 28 |

## Most active contributors

| Author | Commits |
|--------|--------:|
| ibalajiarun | 20 |
| danielxiangzl | 6 |
| wqfish | 1 |
| Zekun Li | 1 |

## Recent commits

| Date | Author | Title |
|------|--------|-------|
| 2026-03-19 | ibalajiarun | [consensus] Add per-BatchKind txn limits in proposal pull |
| 2026-03-19 | ibalajiarun | [consensus] Add per-kind batch size control for encrypted txns |
| 2026-03-19 | ibalajiarun | [consensus] Add ciphertext verification in QS batch verify |
| 2026-03-18 | ibalajiarun | [consensus] Add batch_version labels to quorum store metrics for V1/V2 observability (#19107) |
| 2026-03-17 | ibalajiarun | [consensus] Fix consensus observer encrypted transaction support (#19063) |
| 2026-03-16 | wqfish | [consensus] Clear module cache on pipeline teardown to prevent hot-state deadlock |
| 2026-03-11 | ibalajiarun | [consensus] Keep info! for signed ledger info in pipeline_builder |
| 2026-03-11 | ibalajiarun | [consensus] Fix nightly fmt in proposal_generator |
| 2026-03-11 | ibalajiarun | [consensus] Reduce log volume from additional high-frequency sites (round 2) |
| 2026-03-11 | ibalajiarun | [consensus] Reduce log volume from high-frequency info/warn sites |
| 2026-03-10 | danielxiangzl | [consensus] Remove randomness fast path code (#18870) |
| 2026-03-10 | danielxiangzl | [consensus] Update consensus, pipeline, and quorum store READMEs (#18956) |
| 2026-03-07 | danielxiangzl | [consensus] Enforce sender-author binding for rand share messages (#18970) |
| 2026-03-06 | ibalajiarun | [consensus] Add instance name to ReliableBroadcast for log distinguishability (#18931) |
| 2026-03-05 | ibalajiarun | [consensus][framework] Fix chunky DKG enable-feature: on_new_epoch + pipeline deadlock |
| 2026-03-04 | ibalajiarun | [consensus] Add tests for secret_sharing module and improve QueueItem API (#18928) |
| 2026-02-25 | danielxiangzl | [consensus] Defer randomness aggregation for non-rand blocks (#18699) |
| 2026-02-24 | ibalajiarun | [consensus] Deprecate old Payload enum variants and streamline proof_manager (#18578) |
| 2026-02-24 | danielxiangzl | [consensus] Fix WVUF batch verification off-by-one and log errors (#18834) |
| 2026-02-14 | ibalajiarun | [consensus] Propagate SecretSharedKey to consensus observer via PipelinedBlock |
| 2026-02-14 | ibalajiarun | [consensus] Add decryption pipeline and secret share management |
| 2026-02-12 | ibalajiarun | [consensus] Use OptQuorumStore payload exclusively in proof_manager (#18653) |
| 2026-02-11 | Zekun Li | [consensus] Use spawn_blocking for CPU-intensive verification tasks |
| 2026-02-12 | danielxiangzl | [consensus] Add optimistic randomness share verification (#18646) |
| 2026-02-04 | ibalajiarun | [consensus] Add ValidatorTransaction::ChunkyDKGResult and consensus hooks (#18539) |
| 2026-01-08 | ibalajiarun | [consensus] support secret sharing manager in execution client (#18313) |
| 2025-12-17 | ibalajiarun | [consensus] secret sharing infra (#18223) |
| 2025-12-03 | ibalajiarun | [consensus] Introduce OptQS::V2 Payload (#18087) |
