# Mempool Subsystem

Source files:
- `mempool/src/core_mempool/mempool.rs`
- `mempool/src/core_mempool/transaction.rs`
- `mempool/src/shared_mempool/types.rs`
- `mempool/src/shared_mempool/coordinator.rs`

---

## CoreMempool (`mempool/src/core_mempool/mempool.rs`)

The core in-memory transaction pool. Tracks submitted but not-yet-committed transactions.

```rust
pub struct Mempool {
    // Stores the metadata of all transactions in mempool (of all states).
    pub(crate) transactions: TransactionStore,
    pub system_transaction_timeout: Duration,
}
```

### Key methods:

```rust
impl Mempool {
    pub fn new(config: &NodeConfig) -> Self;

    /// Add a transaction to the Mempool. Performs basic validation (sequence number check).
    pub(crate) fn add_txn(
        &mut self,
        txn: SignedTransaction,
        ranking_score: u64,
        // None for orderless transactions; Some(u64) for sequence number transactions
        account_sequence_number: Option<u64>,
        timeline_state: TimelineState,
        client_submitted: bool,
        ready_time_at_sender: Option<u64>,
        priority: Option<BroadcastPeerPriority>,
    ) -> MempoolStatus;

    pub(crate) fn commit_transaction(
        &mut self,
        sender: &AccountAddress,
        replay_protector: ReplayProtector,
    );

    pub(crate) fn reject_transaction(
        &mut self,
        sender: &AccountAddress,
        replay_protector: ReplayProtector,
        hash: &HashValue,
        reason: &DiscardedVMStatus,
    );

    /// Fetches next block of transactions for consensus.
    /// `return_non_full` - if false, only return when max_txns or max_bytes is reached
    /// `exclude_transactions` - transactions already sent to Consensus but not committed
    pub(crate) fn get_batch(
        &self,
        max_txns: u64,
        max_bytes: u64,
        return_non_full: bool,
        exclude_transactions: BTreeMap<TransactionSummary, TransactionInProgress>,
    ) -> Vec<SignedTransaction>;

    /// Periodic garbage collection - removes expired transactions
    pub(crate) fn gc(&mut self);
    pub(crate) fn gc_by_expiration_time(&mut self, block_time: Duration);

    /// Returns transactions and new timeline IDs for broadcast
    pub(crate) fn read_timeline(
        &self,
        sender_bucket: MempoolSenderBucket,
        timeline_id: &MultiBucketTimelineIndexIds,
        count: usize,
        before: Option<Instant>,
        priority_of_receiver: BroadcastPeerPriority,
    ) -> (Vec<(SignedTransaction, u64)>, MultiBucketTimelineIndexIds);

    pub(crate) fn get_by_hash(&self, hash: HashValue) -> Option<SignedTransaction>;
    pub fn gen_snapshot(&self) -> TxnsLog;
}
```

### Transaction ordering in `get_batch`:
- Iterates priority index (by gas price descending)
- For sequence-number transactions: ensures ordering (txn N must come before txn N+1)
- For nonce-based (orderless) transactions: directly included
- Uses `skipped` set for transactions whose predecessors haven't been included yet
- Respects `max_txns` and `max_bytes` limits

---

## MempoolTransaction (`mempool/src/core_mempool/transaction.rs`)

```rust
#[derive(Clone, Debug)]
pub struct MempoolTransaction {
    pub txn: SignedTransaction,
    pub expiration_time: Duration,
    pub ranking_score: u64,
    pub timeline_state: TimelineState,
    pub insertion_info: InsertionInfo,
    pub was_parked: bool,
    pub priority_of_sender: Option<BroadcastPeerPriority>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Deserialize, Hash, Serialize)]
pub enum TimelineState {
    Ready(u64),      // Ready for broadcast, with position in timeline
    NotReady,        // Not yet ready (e.g., future sequence number)
    NonQualified,    // Never broadcast (originated from other peers)
}

#[derive(Debug, Copy, Clone, Eq, PartialEq, Hash)]
pub enum SubmittedBy {
    Client,          // Received from client REST API
    Downstream,      // Received from downstream peer (VFN)
    PeerValidator,   // Received from another validator
}

#[derive(Debug, Clone)]
pub struct InsertionInfo {
    pub insertion_time: SystemTime,
    pub ready_time: SystemTime,
    pub park_time: Option<SystemTime>,
    pub submitted_by: SubmittedBy,
    pub consensus_pulled_counter: Arc<AtomicUsize>,
}
```

---

## SharedMempool (`mempool/src/shared_mempool/types.rs`)

Owns all dependencies for shared mempool routines (networking, validation, storage).

```rust
pub type MempoolSenderBucket = u8;
pub type TimelineIndexIdentifier = u8;

#[derive(Clone)]
pub(crate) struct SharedMempool<NetworkClient, TransactionValidator> {
    pub mempool: Arc<Mutex<CoreMempool>>,
    pub config: MempoolConfig,
    pub network_interface: MempoolNetworkInterface<NetworkClient>,
    pub db: Arc<dyn DbReader>,
    pub validator: Arc<RwLock<TransactionValidator>>,
    pub subscribers: Vec<UnboundedSender<SharedMempoolNotification>>,
    pub broadcast_within_validator_network: Arc<RwLock<bool>>,
    pub use_case_history: Arc<Mutex<UseCaseHistory>>,
    pub transaction_filter_config: TransactionFilterConfig,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum SharedMempoolNotification {
    PeerStateChange,
    NewTransactions,
    ACK,
    Broadcast,
}

/// Message sent from QuorumStore to Mempool.
pub enum QuorumStoreRequest {
    GetBatchRequest(
        u64,  // max batch size
        u64,  // max byte size
        bool, // return non full
        BTreeMap<TransactionSummary, TransactionInProgress>,  // exclude
        oneshot::Sender<Result<QuorumStoreResponse>>,         // callback
    ),
    RejectNotification(
        Vec<RejectedTransactionSummary>,
        oneshot::Sender<Result<QuorumStoreResponse>>,
    ),
}
```

---

## Coordinator (`mempool/src/shared_mempool/coordinator.rs`)

The main event loop that handles inbound network events and outbound transaction broadcasts.

```rust
/// Coordinator that handles inbound network events and outbound txn broadcasts.
pub(crate) async fn coordinator<NetworkClient, TransactionValidator, ConfigProvider>(
    mut smp: SharedMempool<NetworkClient, TransactionValidator>,
    executor: Handle,
    network_service_events: NetworkServiceEvents<MempoolSyncMsg>,
    mut client_events: MempoolEventsReceiver,
    mut quorum_store_requests: mpsc::Receiver<QuorumStoreRequest>,
    mempool_listener: MempoolNotificationListener,
    mut mempool_reconfig_events: ReconfigNotificationListener<ConfigProvider>,
    peer_update_interval_ms: u64,
    peers_and_metadata: Arc<PeersAndMetadata>,
) where
    NetworkClient: NetworkClientInterface<MempoolSyncMsg> + 'static,
    TransactionValidator: TransactionValidation + 'static,
    ConfigProvider: OnChainConfigProvider;
```

The coordinator uses `tokio::select!` to multiplex:
- Network events (incoming transactions from peers)
- Client events (transactions submitted via API)
- QuorumStore requests (batch pulling)
- Commit notifications from state sync
- Reconfig notifications
- Scheduled broadcasts (periodic peer broadcasts)
