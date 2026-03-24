# State Sync Subsystem

Source files:
- `state-sync/state-sync-driver/src/driver.rs`
- `state-sync/state-sync-driver/src/driver_factory.rs`
- `state-sync/state-sync-driver/src/bootstrapper.rs`
- `state-sync/state-sync-driver/src/storage_synchronizer.rs`

---

## DriverConfiguration (`state-sync/state-sync-driver/src/driver.rs`)

```rust
#[derive(Clone)]
pub struct DriverConfiguration {
    pub config: StateSyncDriverConfig,
    pub consensus_observer_config: ConsensusObserverConfig,
    pub role: RoleType,
    pub waypoint: Waypoint,
}

impl DriverConfiguration {
    pub fn new(
        config: StateSyncDriverConfig,
        consensus_observer_config: ConsensusObserverConfig,
        role: RoleType,
        waypoint: Waypoint,
    ) -> Self;
}
```

---

## StateSyncDriver (`state-sync/state-sync-driver/src/driver.rs`)

The core state sync driver that drives synchronization progress. Uses a bootstrapper for initial sync and continuous syncer for ongoing sync.

```rust
pub struct StateSyncDriver<
    DataClient,
    MempoolNotifier,
    MetadataStorage,
    StorageServiceNotifier,
    StorageSyncer,
    StreamingClient,
> {
    // Initial bootstrapping of the node
    bootstrapper: Bootstrapper<MetadataStorage, StorageSyncer, StreamingClient>,

    // Listener for client notifications
    client_notification_listener: ClientNotificationListener,

    // Listener for commit notifications
    commit_notification_listener: CommitNotificationListener,

    // Handler for notifications from consensus or consensus observer
    consensus_notification_handler: ConsensusNotificationHandler,

    // Manages continuous syncing after bootstrapping
    continuous_syncer: ContinuousSyncer<StorageSyncer, StreamingClient>,

    // Client for checking global data summary of peers
    aptos_data_client: DataClient,

    // Driver configuration
    driver_configuration: DriverConfiguration,

    // Listener for errors from storage synchronizer
    error_notification_listener: ErrorNotificationListener,

    // Event subscription service for on-chain event notifications
    event_subscription_service: Arc<Mutex<EventSubscriptionService>>,

    // Handler for mempool notifications
    mempool_notification_handler: MempoolNotificationHandler<MempoolNotifier>,

    // Timestamp when driver started executing
    start_time: Option<Instant>,

    // Interface to read from storage
    storage: Arc<dyn DbReader>,

    // Handler for storage service notifications
    storage_service_notification_handler: StorageServiceNotificationHandler<StorageServiceNotifier>,

    // Storage synchronizer for updating local storage
    storage_synchronizer: StorageSyncer,

    // Time service
    time_service: TimeService,
}
```

### Key methods:

```rust
impl StateSyncDriver<...> {
    pub fn new(
        client_notification_listener: ClientNotificationListener,
        commit_notification_listener: CommitNotificationListener,
        consensus_notification_handler: ConsensusNotificationHandler,
        driver_configuration: DriverConfiguration,
        error_notification_listener: ErrorNotificationListener,
        event_subscription_service: Arc<Mutex<EventSubscriptionService>>,
        mempool_notification_handler: MempoolNotificationHandler<MempoolNotifier>,
        metadata_storage: MetadataStorage,
        aptos_data_client: DataClient,
        storage_service_notification_handler: StorageServiceNotificationHandler<StorageServiceNotifier>,
        storage_synchronizer: StorageSyncer,
        streaming_client: StreamingClient,
        storage: Arc<dyn DbReader>,
        time_service: TimeService,
    ) -> Self;

    /// Main driver loop
    pub async fn start_driver(mut self);
}
```

---

## DriverFactory (`state-sync/state-sync-driver/src/driver_factory.rs`)

Factory for creating and spawning the state sync driver.

```rust
pub struct DriverFactory {
    client_notification_sender: mpsc::UnboundedSender<DriverNotification>,
}

impl DriverFactory {
    /// Creates and spawns a new state sync driver and returns the factory.
    pub fn create_and_spawn_driver<
        ChunkExecutor: ChunkExecutorTrait + 'static,
        MempoolNotifier: MempoolNotificationSender + 'static,
        MetadataStorage: MetadataStorageInterface + Clone + Send + Sync + 'static,
        StorageServiceNotifier: StorageServiceNotificationSender + 'static,
    >(
        runtime: Option<Handle>,
        node_config: &NodeConfig,
        waypoint: Waypoint,
        storage: DbReaderWriter,
        chunk_executor: Arc<ChunkExecutor>,
        mempool_notification_sender: MempoolNotifier,
        storage_service_notification_sender: StorageServiceNotifier,
        metadata_storage: MetadataStorage,
        consensus_listener: ConsensusNotificationListener,
        event_subscription_service: EventSubscriptionService,
        aptos_data_client: AptosDataClient,
        streaming_service_client: StreamingServiceClient,
        time_service: TimeService,
    ) -> Self;
}
```

### Initialization sequence:
1. Notifies subscribers of initial on-chain config values
2. Creates notification handlers (client, commit, consensus, error, mempool, storage service)
3. Creates `StorageSynchronizer` with chunk executor
4. Creates `StateSyncDriver` with all components
5. Spawns driver on provided runtime or current tokio runtime

---

## Notification Types

```rust
// From notification_handlers.rs (referenced by driver)
pub struct CommitNotification { ... }
pub struct CommittedTransactions { ... }
pub struct ErrorNotification { ... }

// Consensus notification types:
// - ConsensusCommitNotification: committed blocks from consensus
// - ConsensusSyncTargetNotification: target to sync to
// - ConsensusSyncDurationNotification: sync duration info
```

---

## Architecture Overview

The state sync system follows a layered architecture:

1. **DriverFactory** - Creates and wires all components together
2. **StateSyncDriver** - Main event loop coordinating bootstrapping and continuous sync
3. **Bootstrapper** - Handles initial node sync (getting to latest state)
4. **ContinuousSyncer** - Handles ongoing sync after bootstrapping
5. **StorageSynchronizer** - Applies chunks/transactions to local storage
6. **Data Streaming Client** - Streams data from peers via aptos-data-client

### Key interactions:
- **Consensus -> Driver**: Commit notifications and sync targets
- **Driver -> Mempool**: Notifications about committed transactions
- **Driver -> Storage Service**: Notifications about new data
- **Driver -> Event Subscription Service**: On-chain config change notifications
- **Driver -> Storage**: Reads current sync state; writes via StorageSynchronizer

### Constants:
```rust
const DRIVER_INFO_LOG_FREQ_SECS: u64 = 2;
const DRIVER_ERROR_LOG_FREQ_SECS: u64 = 3;
```
