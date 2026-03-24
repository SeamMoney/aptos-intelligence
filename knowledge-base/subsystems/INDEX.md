# Aptos Core Subsystem Knowledge Base Index

Extracted from `aptos-labs/aptos-core` (HEAD as of 2026-03-24).

---

## Subsystems

### 1. [consensus.md](./consensus.md)
**Quorum Store and Round Management**

Source files:
- `consensus/src/round_manager.rs` -- Central consensus round coordinator (RoundManager)
- `consensus/src/quorum_store/types.rs` -- Batch, PersistedValue, BatchMsg, BatchRequest, BatchResponse
- `consensus/src/quorum_store/proof_manager.rs` -- ProofManager, ProofManagerCommand
- `consensus/src/quorum_store/batch_coordinator.rs` -- BatchCoordinator, BatchCoordinatorCommand

Key types: `RoundManager`, `UnverifiedEvent`, `VerifiedEvent`, `Batch<T>`, `PersistedValue<T>`, `ProofManager`, `BatchCoordinator`, `BatchKind`

---

### 2. [execution.md](./execution.md)
**Block-STM Parallel Execution Engine**

Source files:
- `aptos-move/block-executor/src/executor.rs` -- BlockExecutor, parallel execution orchestration
- `aptos-move/block-executor/src/scheduler.rs` -- Scheduler, task assignment, dependency tracking
- `aptos-move/block-executor/src/task.rs` -- ExecutorTask trait, ExecutionStatus, TransactionOutput traits

Key types: `BlockExecutor`, `Scheduler`, `SchedulerTask`, `ExecutionTaskType`, `DependencyStatus`, `ExecutorTask`, `ExecutionStatus`, `TransactionOutput`, `BeforeMaterializationOutput`

---

### 3. [storage.md](./storage.md)
**AptosDB and Jellyfish Merkle Tree**

Source files:
- `storage/aptosdb/src/db/mod.rs` -- AptosDB struct, open/create methods
- `storage/aptosdb/src/lib.rs` -- Module re-exports
- `storage/jellyfish-merkle/src/lib.rs` -- JellyfishMerkleTree, TreeReader, TreeWriter, TreeUpdateBatch
- `storage/jellyfish-merkle/src/node_type/mod.rs` -- NodeKey, InternalNode, LeafNode, Child, Children, NodeType

Key types: `AptosDB`, `JellyfishMerkleTree`, `TreeReader`, `TreeWriter`, `NodeKey`, `InternalNode`, `LeafNode`, `TreeUpdateBatch`, `StaleNodeIndex`

---

### 4. [mempool.md](./mempool.md)
**Transaction Pool (Mempool)**

Source files:
- `mempool/src/core_mempool/mempool.rs` -- Mempool (CoreMempool), add_txn, get_batch
- `mempool/src/core_mempool/transaction.rs` -- MempoolTransaction, TimelineState, InsertionInfo, SubmittedBy
- `mempool/src/shared_mempool/types.rs` -- SharedMempool, QuorumStoreRequest, SharedMempoolNotification
- `mempool/src/shared_mempool/coordinator.rs` -- coordinator() main event loop

Key types: `Mempool`, `MempoolTransaction`, `TimelineState`, `SharedMempool`, `QuorumStoreRequest`, `SubmittedBy`

---

### 5. [move-vm.md](./move-vm.md)
**Move Virtual Machine and Aptos VM**

Source files:
- `third_party/move/move-vm/runtime/src/move_vm.rs` -- MoveVM (stateless), execute_loaded_function
- `aptos-move/aptos-vm/src/aptos_vm.rs` -- AptosVM, AptosVMBlockExecutor, AptosSimulationVM

Key types: `MoveVM`, `SerializedReturnValues`, `AptosVM`, `AptosVMBlockExecutor`, `AptosSimulationVM`

---

### 6. [types.md](./types.md)
**Core Transaction and Authentication Types**

Source files:
- `types/src/transaction/mod.rs` -- Transaction, SignedTransaction, RawTransaction, TransactionPayload, TransactionOutput, ExecutionStatus, TransactionStatus
- `types/src/transaction/authenticator.rs` -- TransactionAuthenticator, AccountAuthenticator, AuthenticationProof

Key types: `Transaction`, `SignedTransaction`, `RawTransaction`, `TransactionPayload`, `TransactionPayloadInner`, `TransactionExecutable`, `TransactionExtraConfig`, `ReplayProtector`, `TransactionAuthenticator`, `TransactionOutput`, `TransactionInfo`, `TransactionToCommit`, `ExecutionStatus`, `TransactionStatus`

---

### 7. [encrypted-mempool.md](./encrypted-mempool.md)
**Encrypted Transactions (BIBE)**

Source files:
- `types/src/transaction/encrypted_payload.rs` -- EncryptedPayload, DecryptedPayload, DecryptionFailureReason
- `crates/aptos-batch-encryption/src/shared/ciphertext/bibe.rs` -- BIBECiphertext, PreparedBIBECiphertext, BIBECTEncrypt, BIBECTDecrypt
- `consensus/src/quorum_store/types.rs` -- BatchKind::Encrypted verification
- `types/src/transaction/authenticator.rs` -- Encrypted txn signature rules

Key types: `EncryptedPayload`, `DecryptedPayload`, `DecryptionFailureReason`, `PayloadAssociatedData`, `BIBECiphertext`, `PreparedBIBECiphertext`, `BatchKind`

---

### 8. [state-sync.md](./state-sync.md)
**State Synchronization**

Source files:
- `state-sync/state-sync-driver/src/driver.rs` -- StateSyncDriver, DriverConfiguration
- `state-sync/state-sync-driver/src/driver_factory.rs` -- DriverFactory
- `state-sync/state-sync-driver/src/bootstrapper.rs` -- Bootstrapper
- `state-sync/state-sync-driver/src/storage_synchronizer.rs` -- StorageSynchronizer

Key types: `StateSyncDriver`, `DriverConfiguration`, `DriverFactory`, `Bootstrapper`, `ContinuousSyncer`, `StorageSynchronizer`, `CommitNotification`, `ConsensusNotificationHandler`

---

## Cross-Cutting Relationships

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

### Encrypted Transaction Flow:
1. User encrypts payload with BIBE (`BIBECTEncrypt::bibe_encrypt`)
2. Signs with Ed25519 over encrypted variant of RawTransaction
3. Submitted as `TransactionPayload::EncryptedPayload`
4. Quorum Store: batched as `BatchKind::Encrypted`, ciphertext verified in parallel
5. Block execution: decrypted with `BlockTxnDecryptionKey`
6. `EncryptedPayload::into_decrypted()` transitions state
7. If decryption fails: `EncryptedPayload::into_failed_decryption_with_reason()`
