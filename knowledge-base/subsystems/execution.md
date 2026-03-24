# Execution Subsystem (Block-STM)

Source files:
- `aptos-move/block-executor/src/executor.rs`
- `aptos-move/block-executor/src/scheduler.rs`
- `aptos-move/block-executor/src/task.rs`

---

## BlockExecutor (`aptos-move/block-executor/src/executor.rs`)

The main parallel block executor using Block-STM (Software Transactional Memory). Coordinates speculative parallel execution with optimistic concurrency control.

```rust
pub struct BlockExecutor<T, E, S, L, TP, A> {
    // Number of active concurrent tasks, corresponding to the maximum number of rayon
    // threads that may be concurrently participating in parallel execution.
    config: BlockExecutorConfig,
    executor_thread_pool: Arc<rayon::ThreadPool>,
    transaction_commit_hook: Option<L>,
    phantom: PhantomData<fn() -> (T, E, S, L, TP, A)>,
}
```

### Type constraints:

```rust
impl<T, E, S, L, TP, A> BlockExecutor<T, E, S, L, TP, A>
where
    T: BlockExecutableTransaction,
    E: ExecutorTask<Txn = T, AuxiliaryInfo = A>,
    S: TStateView<Key = T::Key> + Sync,
    L: TransactionCommitHook,
    TP: TxnProvider<T, A> + Sync,
    A: AuxiliaryInfoTrait,
```

### Key method signatures:

```rust
impl BlockExecutor {
    pub fn new(
        config: BlockExecutorConfig,
        executor_thread_pool: Arc<ThreadPool>,
        transaction_commit_hook: Option<L>,
    ) -> Self;

    pub fn execute_block(
        &self,
        signature_verified_block: &TP,
        base_view: &S,
        transaction_slice_metadata: &TransactionSliceMetadata,
        module_cache_manager_guard: &mut AptosModuleCacheManagerGuard,
    ) -> BlockExecutionResult<BlockOutput<T, E::Output>, E::Error>;
    // Dispatches to either:
    //   execute_transactions_parallel (Block-STM v1)
    //   execute_transactions_parallel_v2 (Block-STM v2)
    // based on config.local.blockstm_v2
}
```

### Internal shared state for parallel execution:

```rust
struct SharedSyncParams<'a, T, E, S> {
    base_view: &'a S,
    versioned_cache: &'a MVHashMap<T::Key, T::Tag, T::Value, DelayedFieldID>,
    global_module_cache: &'a GlobalModuleCache<ModuleId, CompiledModule, Module, AptosModuleExtension>,
    last_input_output: &'a TxnLastInputOutput<T, E::Output>,
    start_shared_counter: u32,
    delayed_field_id_counter: &'a AtomicU32,
    block_limit_processor: &'a ExplicitSyncWrapper<BlockGasLimitProcessor<T>>,
    final_results: &'a ExplicitSyncWrapper<Vec<E::Output>>,
    maybe_block_epilogue_txn_idx: &'a ExplicitSyncWrapper<Option<TxnIndex>>,
}
```

---

## Scheduler (`aptos-move/block-executor/src/scheduler.rs`)

Coordinates task assignment (execution and validation) across worker threads. Implements Block-STM's optimistic concurrency control protocol.

```rust
pub type Wave = u32;

#[derive(Debug)]
pub enum DependencyStatus {
    Unresolved,
    Resolved,
    ExecutionHalted,
}

#[derive(Debug)]
pub enum DependencyResult {
    Dependency(DependencyCondvar),
    Resolved,
    ExecutionHalted,
}

#[derive(Debug, Clone)]
pub enum ExecutionTaskType {
    Execution,
    Wakeup(DependencyCondvar),
}

/// Task type that the parallel execution workers get from the scheduler.
#[derive(Debug)]
pub enum SchedulerTask {
    /// Execution task with transaction index, incarnation, and type
    ExecutionTask(TxnIndex, Incarnation, ExecutionTaskType),
    /// Validation task with transaction index, incarnation, and wave
    ValidationTask(TxnIndex, Incarnation, Wave),
    /// No task available, retry
    Retry,
    /// All tasks complete
    Done,
}

pub trait TWaitForDependency {
    fn wait_for_dependency(
        &self,
        txn_idx: TxnIndex,
        dep_txn_idx: TxnIndex,
    ) -> Result<DependencyResult, PanicError>;
}

pub struct Scheduler {
    num_txns: TxnIndex,
    txn_dependency: Vec<CachePadded<Mutex<Vec<TxnIndex>>>>,
    txn_status: Vec<CachePadded<(RwLock<ExecutionStatus>, RwLock<ValidationStatus>)>>,
    commit_state: CachePadded<ExplicitSyncWrapper<(TxnIndex, Wave)>>,
    execution_idx: AtomicU32,
    validation_idx: AtomicU64,
    done_marker: CachePadded<AtomicBool>,
    has_halted: CachePadded<AtomicBool>,
    queueing_commits_lock: CachePadded<ArmedLock>,
    commit_queue: ConcurrentQueue<u32>,
}
```

### Key methods:

```rust
impl Scheduler {
    pub fn new(num_txns: TxnIndex) -> Self;
    pub fn add_to_commit_queue(&self, txn_idx: u32);
    pub fn pop_from_commit_queue(&self) -> Result<u32, PopError>;
    pub fn try_commit(&self) -> Option<(TxnIndex, Incarnation)>;
    pub fn commit_state(&self) -> (TxnIndex, u32);
    pub fn try_abort(&self, txn_idx: TxnIndex, incarnation: Incarnation) -> bool;
    pub fn next_task(&self) -> SchedulerTask;
    pub fn finish_validation(&self, txn_idx: TxnIndex, wave: Wave);
    pub fn finish_execution(&self, txn_idx: TxnIndex, incarnation: Incarnation, ...) -> SchedulerTask;
    pub fn wake_dependencies_and_decrease_validation_idx(&self, ...);
    pub fn finish_abort(&self, ...);
}
```

---

## ExecutorTask Trait (`aptos-move/block-executor/src/task.rs`)

Defines the interface for single-threaded transaction execution within Block-STM.

```rust
/// The execution result of a transaction
#[derive(Debug)]
pub enum ExecutionStatus<O, E> {
    Success(O),
    Abort(E),
    SkipRest(O),
    SpeculativeExecutionAbortError(String),
    DelayedFieldsCodeInvariantError(String),
}

pub struct Accesses<K> {
    pub keys_read: Vec<K>,
    pub keys_written: Vec<K>,
}

/// Trait for single threaded transaction executor.
pub trait ExecutorTask {
    type Txn: Transaction;
    type AuxiliaryInfo: AuxiliaryInfoTrait;
    type Output: TransactionOutput<Txn = Self::Txn> + 'static;
    type Error: Debug + Clone + Send + Sync + Eq + 'static;

    fn init(
        environment: &AptosEnvironment,
        state_view: &impl TStateView<Key = <Self::Txn as Transaction>::Key>,
        async_runtime_checks_enabled: bool,
    ) -> Self;

    fn execute_transaction(
        &self,
        view: &(impl TExecutorView<...> + TResourceGroupView<...> + AptosCodeStorage + BlockSynchronizationKillSwitch),
        txn: &Self::Txn,
        auxiliary_info: &Self::AuxiliaryInfo,
        txn_idx: TxnIndex,
    ) -> ExecutionStatus<Self::Output, Self::Error>;

    fn is_transaction_dynamic_change_set_capable(txn: &Self::Txn) -> bool;
}

/// Traits for execution result of a single transaction.
pub trait BeforeMaterializationOutput<Txn: Transaction> {
    fn resource_write_set(&self) -> HashMap<Txn::Key, (TriompheArc<Txn::Value>, Option<TriompheArc<MoveTypeLayout>>)>;
    fn module_write_set(&self) -> &BTreeMap<Txn::Key, ModuleWrite<Txn::Value>>;
    fn aggregator_v1_write_set(&self) -> BTreeMap<Txn::Key, Txn::Value>;
    fn aggregator_v1_delta_set(&self) -> BTreeMap<Txn::Key, DeltaOp>;
    fn delayed_field_change_set(&self) -> BTreeMap<DelayedFieldID, DelayedChange<DelayedFieldID>>;
    fn get_events(&self) -> Vec<(Txn::Event, Option<MoveTypeLayout>)>;
    fn resource_group_write_set(&self) -> HashMap<...>;
    fn fee_statement(&self) -> FeeStatement;
    fn has_new_epoch_event(&self) -> bool;
    fn output_approx_size(&self) -> u64;
    fn get_write_summary(&self) -> HashSet<InputOutputKey<Txn::Key, Txn::Tag>>;
}

pub trait AfterMaterializationOutput<Txn: Transaction> {
    fn fee_statement(&self) -> FeeStatement;
    fn has_new_epoch_event(&self) -> bool;
}

pub trait TransactionOutput: Send + Debug {
    type Txn: Transaction;
    type BeforeMaterializationGuard<'a>: BeforeMaterializationOutput<Self::Txn> + 'a;
    type AfterMaterializationGuard<'a>: AfterMaterializationOutput<Self::Txn> + 'a;

    fn committed_output(&self) -> &OnceCell<TypesTransactionOutput>;
    fn skip_output() -> Self;
    fn discard_output(discard_code: StatusCode) -> Self;
    fn before_materialization<'a>(&'a self) -> Result<Self::BeforeMaterializationGuard<'a>, PanicError>;
    fn after_materialization<'a>(&'a self) -> Result<Self::AfterMaterializationGuard<'a>, PanicError>;
    fn is_materialized_and_success(&self) -> bool;
    fn check_materialization(&self) -> Result<bool, PanicError>;
    fn incorporate_materialized_txn_output(&mut self, ...) -> Result<Trace, PanicError>;
    fn set_txn_output_for_non_dynamic_change_set(&mut self);
}
```
