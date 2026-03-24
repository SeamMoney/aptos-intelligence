# Consensus Subsystem

Source files:
- `consensus/src/round_manager.rs`
- `consensus/src/quorum_store/types.rs`
- `consensus/src/quorum_store/proof_manager.rs`
- `consensus/src/quorum_store/batch_coordinator.rs`

---

## RoundManager (`consensus/src/round_manager.rs`)

The central coordinator for consensus rounds. Processes proposals, votes, timeouts, and order votes.

```rust
pub enum UnverifiedEvent {
    ProposalMsg(Box<ProposalMsg>),
    VoteMsg(Box<VoteMsg>),
    RoundTimeoutMsg(Box<RoundTimeoutMsg>),
    OrderVoteMsg(Box<OrderVoteMsg>),
    SyncInfo(Box<SyncInfo>),
    BatchMsg(Box<BatchMsg<BatchInfo>>),
    BatchMsgV2(Box<BatchMsg<BatchInfoExt>>),
    SignedBatchInfo(Box<SignedBatchInfoMsg<BatchInfo>>),
    SignedBatchInfoMsgV2(Box<SignedBatchInfoMsg<BatchInfoExt>>),
    ProofOfStoreMsg(Box<ProofOfStoreMsg<BatchInfo>>),
    ProofOfStoreMsgV2(Box<ProofOfStoreMsg<BatchInfoExt>>),
    OptProposalMsg(Box<OptProposalMsg>),
}

pub enum VerifiedEvent {
    ProposalMsg(Box<ProposalMsg>),
    VoteMsg(Box<VoteMsg>),
    RoundTimeoutMsg(Box<RoundTimeoutMsg>),
    OrderVoteMsg(Box<OrderVoteMsg>),
    UnverifiedSyncInfo(Box<SyncInfo>),
    BatchMsg(Box<BatchMsg<BatchInfo>>),
    BatchMsgV2(Box<BatchMsg<BatchInfoExt>>),
    SignedBatchInfo(Box<SignedBatchInfoMsg<BatchInfo>>),
    SignedBatchInfoMsgV2(Box<SignedBatchInfoMsg<BatchInfoExt>>),
    ProofOfStoreMsg(Box<ProofOfStoreMsg<BatchInfo>>),
    ProofOfStoreMsgV2(Box<ProofOfStoreMsg<BatchInfoExt>>),
    OptProposalMsg(Box<OptProposalMsg>),
}

pub const BACK_PRESSURE_POLLING_INTERVAL_MS: u64 = 10;

pub struct RoundManager {
    epoch_state: Arc<EpochState>,
    block_store: Arc<BlockStore>,
    round_state: RoundState,
    proposer_election: Arc<UnequivocalProposerElection>,
    proposal_generator: Arc<ProposalGenerator>,
    safety_rules: Arc<Mutex<MetricsSafetyRules>>,
    network: Arc<NetworkSender>,
    storage: Arc<dyn PersistentLivenessStorage>,
    onchain_config: OnChainConsensusConfig,
    vtxn_config: ValidatorTxnConfig,
    buffered_proposal_tx: aptos_channel::Sender<Author, VerifiedEvent>,
    block_txn_filter_config: BlockTransactionFilterConfig,
    local_config: ConsensusConfig,
    randomness_config: OnChainRandomnessConfig,
    jwk_consensus_config: OnChainJWKConsensusConfig,
    chunky_dkg_config: OnChainChunkyDKGConfig,
    pending_order_votes: PendingOrderVotes,
    futures: FuturesUnordered<Pin<Box<dyn Future<Output = (anyhow::Result<()>, Block, Instant)> + Send>>>,
    proposal_status_tracker: Arc<dyn TPastProposalStatusTracker>,
    pending_opt_proposals: BTreeMap<Round, OptBlockData>,
    opt_proposal_loopback_tx: aptos_channels::UnboundedSender<OptBlockData>,
}
```

### Key method signatures:

```rust
impl RoundManager {
    pub fn new(
        epoch_state: Arc<EpochState>,
        block_store: Arc<BlockStore>,
        round_state: RoundState,
        proposer_election: Arc<dyn ProposerElection + Send + Sync>,
        proposal_generator: ProposalGenerator,
        safety_rules: Arc<Mutex<MetricsSafetyRules>>,
        network: Arc<NetworkSender>,
        storage: Arc<dyn PersistentLivenessStorage>,
        onchain_config: OnChainConsensusConfig,
        buffered_proposal_tx: aptos_channel::Sender<Author, VerifiedEvent>,
        block_txn_filter_config: BlockTransactionFilterConfig,
        local_config: ConsensusConfig,
        randomness_config: OnChainRandomnessConfig,
        jwk_consensus_config: OnChainJWKConsensusConfig,
        chunky_dkg_config: OnChainChunkyDKGConfig,
        proposal_status_tracker: Arc<dyn TPastProposalStatusTracker>,
        opt_proposal_loopback_tx: aptos_channels::UnboundedSender<OptBlockData>,
    ) -> Self;

    pub async fn process_proposal_msg(&mut self, proposal_msg: ProposalMsg) -> anyhow::Result<()>;
    pub async fn process_delayed_proposal_msg(&mut self, proposal: Block) -> anyhow::Result<()>;
    pub async fn process_opt_proposal_msg(&mut self, ...) -> anyhow::Result<()>;
    pub async fn ensure_round_and_sync_up(&mut self, ...) -> anyhow::Result<()>;
    pub async fn process_sync_info_msg(&mut self, ...) -> anyhow::Result<()>;
    pub async fn process_local_timeout(&mut self, round: Round) -> anyhow::Result<()>;
    pub async fn process_verified_proposal(&mut self, proposal: Block) -> anyhow::Result<()>;
    pub async fn process_vote_msg(&mut self, vote_msg: VoteMsg) -> anyhow::Result<()>;
    pub async fn process_round_timeout_msg(&mut self, ...) -> anyhow::Result<()>;
    pub async fn init(&mut self, last_vote_sent: Option<Vote>);
    pub async fn start(mut self, ...);
}
```

---

## Quorum Store Types (`consensus/src/quorum_store/types.rs`)

Core data structures for quorum store's batch management.

```rust
#[derive(Clone, Eq, Deserialize, Serialize, PartialEq, Debug)]
pub struct PersistedValue<T> {
    info: T,
    maybe_payload: Option<Vec<SignedTransaction>>,
}

pub(crate) enum StorageMode {
    PersistedOnly,
    MemoryAndPersisted,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Batch<T: TBatchInfo> {
    batch_info: T,
    payload: BatchPayload,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct BatchRequest {
    epoch: u64,
    source: PeerId,
    digest: HashValue,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum BatchResponse {
    Batch(Batch<BatchInfo>),
    NotFound(LedgerInfoWithSignatures),
    BatchV2(Batch<BatchInfoExt>),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BatchMsg<T: TBatchInfo> {
    batches: Vec<Batch<T>>,
}
```

### Batch verification (supports encrypted transactions via BatchKind):

```rust
impl<T: TBatchInfo> Batch<T> {
    pub fn verify(&self) -> anyhow::Result<()>;
    // For V2 batches, validates BatchKind matches transaction types:
    //   BatchKind::Encrypted => all txns must be encrypted, ciphertext verified
    //   BatchKind::Normal => no encrypted txns allowed
    // V1 batches do not support encrypted transactions

    pub fn verify_with_digest(&self, requested_digest: HashValue) -> anyhow::Result<()>;
    pub fn into_transactions(self) -> Vec<SignedTransaction>;
    pub fn txns(&self) -> &[SignedTransaction];
    pub fn batch_info(&self) -> &T;
}
```

---

## ProofManager (`consensus/src/quorum_store/proof_manager.rs`)

Manages proofs of store for the quorum store. Handles proposal requests from consensus by pulling proofs and batches.

```rust
#[derive(Debug)]
pub enum ProofManagerCommand {
    ReceiveProofs(ProofOfStoreMsg<BatchInfoExt>),
    ReceiveBatches(Vec<(BatchInfoExt, Vec<TxnSummaryWithExpiration>)>),
    CommitNotification(u64, Vec<BatchInfoExt>),
    Shutdown(tokio::sync::oneshot::Sender<()>),
}

pub struct ProofManager {
    batch_proof_queue: BatchProofQueue,
    back_pressure_total_txn_limit: u64,
    remaining_total_txn_num: u64,
    back_pressure_total_proof_limit: u64,
    remaining_total_proof_num: u64,
    allow_batches_without_pos_in_proposal: bool,
}

impl ProofManager {
    pub fn new(
        my_peer_id: PeerId,
        back_pressure_total_txn_limit: u64,
        back_pressure_total_proof_limit: u64,
        batch_store: Arc<BatchStore>,
        allow_batches_without_pos_in_proposal: bool,
        batch_expiry_gap_when_init_usecs: u64,
    ) -> Self;

    pub(crate) fn receive_proofs(&mut self, proofs: Vec<ProofOfStore<BatchInfoExt>>);
    pub(crate) fn receive_batches(&mut self, batch_summaries: Vec<(BatchInfoExt, Vec<TxnSummaryWithExpiration>)>);
    pub(crate) fn handle_commit_notification(&mut self, block_timestamp: u64, batches: Vec<BatchInfoExt>);
    pub(crate) fn handle_proposal_request(&mut self, msg: GetPayloadCommand);
    pub(crate) fn qs_back_pressure(&self) -> BackPressure;

    pub async fn start(
        mut self,
        back_pressure_tx: tokio::sync::mpsc::Sender<BackPressure>,
        mut proposal_rx: Receiver<GetPayloadCommand>,
        mut proof_rx: tokio::sync::mpsc::Receiver<ProofManagerCommand>,
    );
}
```

---

## BatchCoordinator (`consensus/src/quorum_store/batch_coordinator.rs`)

Coordinates receipt and persistence of batches from the network.

```rust
#[derive(Debug)]
pub enum BatchCoordinatorCommand {
    Shutdown(oneshot::Sender<()>),
    NewBatches(PeerId, Vec<Batch<BatchInfoExt>>),
}

pub struct BatchCoordinator {
    my_peer_id: PeerId,
    network_sender: Arc<NetworkSender>,
    sender_to_proof_manager: Arc<Sender<ProofManagerCommand>>,
    sender_to_batch_generator: Arc<Sender<BatchGeneratorCommand>>,
    batch_store: Arc<BatchStore>,
    max_batch_txns: u64,
    max_batch_bytes: u64,
    max_total_txns: u64,
    max_total_bytes: u64,
    batch_expiry_gap_when_init_usecs: u64,
    transaction_filter_config: BatchTransactionFilterConfig,
}

impl BatchCoordinator {
    pub(crate) fn new(...) -> Self;
    pub(crate) async fn handle_batches_msg(&mut self, author: PeerId, batches: Vec<Batch<BatchInfoExt>>);
    pub(crate) async fn start(mut self, mut command_rx: Receiver<BatchCoordinatorCommand>);
}
```
