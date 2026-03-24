# Move VM Subsystem

Source files:
- `third_party/move/move-vm/runtime/src/move_vm.rs`
- `aptos-move/aptos-vm/src/aptos_vm.rs`

---

## MoveVM (`third_party/move/move-vm/runtime/src/move_vm.rs`)

The core Move Virtual Machine. Completely stateless -- used to execute a single loaded function with fully instantiated type arguments.

```rust
/// Return values from function execution.
#[derive(Debug)]
pub struct SerializedReturnValues {
    /// Values of mutably borrowed arguments after execution.
    pub mutable_reference_outputs: Vec<(LocalIndex, Vec<u8>, MoveTypeLayout)>,
    /// Return values from the function.
    pub return_values: Vec<(Vec<u8>, MoveTypeLayout)>,
}

/// Move VM is completely stateless.
pub struct MoveVM;

impl MoveVM {
    pub fn execute_loaded_function(
        function: LoadedFunction,
        serialized_args: Vec<impl Borrow<[u8]>>,
        data_cache: &mut impl MoveVmDataCache,
        gas_meter: &mut impl GasMeter,
        traversal_context: &mut TraversalContext,
        extensions: &mut NativeContextExtensions,
        loader: &impl Loader,
    ) -> VMResult<SerializedReturnValues>;

    pub fn execute_loaded_function_with_tracing(
        function: LoadedFunction,
        serialized_args: Vec<impl Borrow<[u8]>>,
        data_cache: &mut impl MoveVmDataCache,
        gas_meter: &mut impl GasMeter,
        traversal_context: &mut TraversalContext,
        extensions: &mut NativeContextExtensions,
        loader: &impl Loader,
        trace_recorder: &mut impl TraceRecorder,
    ) -> VMResult<SerializedReturnValues>;
}
```

### Execution flow:
1. Instantiate type parameters via `ty_builder.create_ty_with_subst`
2. Deserialize arguments into Move values
3. Call `Interpreter::entrypoint(function, args, data_cache, ...)`
4. Serialize return values
5. Collect mutable reference outputs
6. Return `SerializedReturnValues`

---

## AptosVM (`aptos-move/aptos-vm/src/aptos_vm.rs`)

The Aptos-specific VM wrapper around MoveVM. Handles transaction validation, gas metering, prologue/epilogue execution, and the Aptos-specific transaction lifecycle.

```rust
pub struct AptosVM {
    is_simulation: bool,
    move_vm: MoveVmExt,
    /// If true, user payloads may skip extra runtime checks during execution.
    /// Block-STM replays the trace and performs these checks at post-commit time.
    async_runtime_checks_enabled: bool,
}
```

### Key methods:

```rust
impl AptosVM {
    pub fn new(env: &AptosEnvironment) -> Self;

    /// Creates the VM for Block-STM workers to use.
    pub fn new_for_block_executor(
        env: &AptosEnvironment,
        async_runtime_checks_enabled: bool,
    ) -> Self;

    pub fn new_session<'r, R: AptosMoveResolver>(
        &self,
        resolver: &'r R,
        session_id: SessionId,
        user_transaction_context_opt: Option<UserTransactionContext>,
    ) -> SessionExt<'r, R>;

    pub fn runtime_environment(&self) -> &RuntimeEnvironment;
    pub fn environment(&self) -> AptosEnvironment;

    // --- Static configuration ---
    pub fn set_concurrency_level_once(mut concurrency_level: usize);
    pub fn get_concurrency_level() -> usize;
    pub fn set_blockstm_v2_enabled_once(blockstm_v2_enabled: bool);
    pub fn get_blockstm_v2_enabled() -> bool;
    pub fn set_num_shards_once(mut num_shards: usize);
    pub fn get_num_shards() -> usize;

    // --- Resolver creation ---
    pub fn as_move_resolver<'r, R: ExecutorView>(
        &self,
        executor_view: &'r R,
    ) -> StorageAdapter<'r, R>;

    // --- Transaction execution ---
    pub fn execute_user_transaction(
        &self,
        resolver: &impl AptosMoveResolver,
        code_storage: &(impl AptosCodeStorage + BlockSynchronizationKillSwitch),
        txn: &SignedTransaction,
        log_context: &AdapterLogSchema,
        auxiliary_info: &AuxiliaryInfo,
    ) -> (VMStatus, VMOutput);

    pub fn execute_user_transaction_with_custom_gas_meter<'a, C, G, F>(
        &self, resolver: ..., code_storage: ..., txn: ..., log_context: ...,
        gas_meter_factory: F, auxiliary_info: ...,
    ) -> Result<(VMStatus, VMOutput, G), VMStatus>;

    pub fn execute_view_function(
        state_view: &impl StateView,
        module_id: ModuleId,
        func_name: Identifier,
        type_args: Vec<TypeTag>,
        arguments: Vec<Vec<u8>>,
        gas_budget: u64,
    ) -> ViewFunctionOutput;

    pub fn execute_single_transaction(
        &self, txn: &SignatureVerifiedTransaction, resolver: ...,
        code_storage: ..., log_context: ..., auxiliary_info: ...,
    ) -> (VMStatus, VMOutput);

    pub fn should_restart_execution(events: &[(ContractEvent, Option<MoveTypeLayout>)]) -> bool;
}
```

---

## AptosVMBlockExecutor (`aptos-move/aptos-vm/src/aptos_vm.rs`)

The block-level executor that integrates AptosVM with Block-STM.

```rust
/// Executing conflicts: in the input order, via BlockSTM,
/// State: BlockSTM-provided MVHashMap-based view with caching
pub struct AptosVMBlockExecutor {
    /// Manages module cache and execution environment of this block executor.
    module_cache_manager: AptosModuleCacheManager,
}

impl AptosVMBlockExecutor {
    pub fn execute_block_with_config(
        &self,
        txn_provider: &DefaultTxnProvider<SignatureVerifiedTransaction, AuxiliaryInfo>,
        state_view: &(impl StateView + Sync),
        config: BlockExecutorConfig,
        transaction_slice_metadata: TransactionSliceMetadata,
    ) -> Result<BlockOutput<SignatureVerifiedTransaction, TransactionOutput>, VMStatus>;
}

pub struct AptosSimulationVM;
impl AptosSimulationVM {
    pub fn create_vm_and_simulate_signed_transaction(
        txn: &SignedTransaction,
        state_view: &impl StateView,
    ) -> (VMStatus, TransactionOutput);
}
```
