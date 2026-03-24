# Types Subsystem

Source files:
- `types/src/transaction/mod.rs`
- `types/src/transaction/authenticator.rs`
- `types/src/transaction/encrypted_payload.rs`

---

## Core Transaction Types (`types/src/transaction/mod.rs`)

### Version

```rust
pub type Version = u64; // Height - also used for MVCC in StateDB
pub type AtomicVersion = AtomicU64;
```

### ReplayProtector

```rust
#[derive(Debug, Copy, Clone, Eq, PartialEq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum ReplayProtector {
    Nonce(u64),           // For orderless transactions
    SequenceNumber(u64),  // Traditional sequence-number-based ordering
}
```

### RawTransaction

```rust
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize, CryptoHasher, BCSCryptoHash)]
pub struct RawTransaction {
    sender: AccountAddress,
    sequence_number: u64,
    payload: TransactionPayload,
    max_gas_amount: u64,
    gas_unit_price: u64,
    expiration_timestamp_secs: u64,
    chain_id: ChainId,
}
```

### TransactionPayload

```rust
pub enum TransactionPayload {
    Script(Script),
    ModuleBundle(DeprecatedPayload),           // Deprecated
    EntryFunction(EntryFunction),
    Multisig(Multisig),
    Payload(TransactionPayloadInner),          // New versioned format
    EncryptedPayload(EncryptedPayload),        // Encrypted transaction payload
}

pub enum TransactionPayloadInner {
    V1 {
        executable: TransactionExecutable,
        extra_config: TransactionExtraConfig,
    },
}

pub enum TransactionExecutable {
    Script(Script),
    EntryFunction(EntryFunction),
    Empty,
    Encrypted,       // Placeholder for encrypted-but-not-yet-decrypted payload
}

pub enum TransactionExtraConfig {
    V1 {
        multisig_address: Option<AccountAddress>,
        replay_protection_nonce: Option<u64>,   // None for regular, Some(nonce) for orderless
    },
}
```

### SignedTransaction

```rust
pub struct SignedTransaction {
    raw_txn: RawTransaction,
    authenticator: TransactionAuthenticator,
    #[serde(skip)] raw_txn_size: OnceCell<usize>,
    #[serde(skip)] authenticator_size: OnceCell<usize>,
    #[serde(skip)] committed_hash: OnceCell<HashValue>,
}

/// A transaction with a verified signature.
pub struct SignatureCheckedTransaction(SignedTransaction);
```

### Transaction (top-level enum)

```rust
pub enum Transaction {
    UserTransaction(SignedTransaction),
    GenesisTransaction(WriteSetPayload),
    BlockMetadata(BlockMetadata),
    StateCheckpoint(HashValue),
    ValidatorTransaction(ValidatorTransaction),
    BlockMetadataExt(BlockMetadataExt),
    BlockEpilogue(BlockEpiloguePayload),
}
```

### TransactionOutput

```rust
pub struct TransactionOutput {
    write_set: WriteSet,
    events: Vec<ContractEvent>,
    gas_used: u64,
    status: TransactionStatus,
}
```

### TransactionStatus and ExecutionStatus

```rust
pub enum ExecutionStatus {
    Success,
    OutOfGas,
    MoveAbort { location: AbortLocation, code: u64, info: Option<AbortInfo> },
    ExecutionFailure { location: AbortLocation, function: u16, code_offset: u16 },
    MiscellaneousError(Option<StatusCode>),
}

pub enum TransactionStatus {
    Discard(DiscardedVMStatus),
    Keep(ExecutionStatus),
    Retry,
}
```

### TransactionInfo

```rust
pub enum TransactionInfo {
    V0(TransactionInfoV0),
}

pub struct TransactionInfoV0 {
    gas_used: u64,
    status: ExecutionStatus,
    transaction_hash: HashValue,
    event_root_hash: HashValue,
    state_change_hash: HashValue,
    state_checkpoint_hash: Option<HashValue>,
    state_cemetery_hash: Option<HashValue>,
}
```

### Other important types:

```rust
pub struct TransactionToCommit {
    pub transaction: Transaction,
    pub transaction_info: TransactionInfo,
    pub write_set: WriteSet,
    pub events: Vec<ContractEvent>,
    pub is_reconfig: bool,
    pub transaction_auxiliary_data: TransactionAuxiliaryData,
}

pub struct TransactionWithProof {
    pub version: Version,
    pub transaction: Transaction,
    pub events: Option<Vec<ContractEvent>>,
    pub proof: TransactionInfoWithProof,
}

pub struct ViewFunctionOutput {
    pub values: Result<Vec<Vec<u8>>, ViewFunctionError>,
    pub gas_used: u64,
}

pub struct AuxiliaryInfo {
    persisted_info: PersistedAuxiliaryInfo,
    ephemeral_info: Option<EphemeralAuxiliaryInfo>,
}

pub enum PersistedAuxiliaryInfo {
    None,
    V1 { original_txn_idx: u32 },
}
```

---

## TransactionAuthenticator (`types/src/transaction/authenticator.rs`)

```rust
pub const MAX_NUM_OF_SIGS: usize = 32;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AuthenticationProof {
    Key(Vec<u8>),
    Abstract {
        function_info: FunctionInfo,
        auth_data: AbstractAuthenticationData,
    },
    None,
}

#[derive(Clone, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub enum TransactionAuthenticator {
    Ed25519 {
        public_key: Ed25519PublicKey,
        signature: Ed25519Signature,
    },
    MultiEd25519 {
        public_key: MultiEd25519PublicKey,
        signature: MultiEd25519Signature,
    },
    MultiAgent {
        sender: AccountAuthenticator,
        secondary_signer_addresses: Vec<AccountAddress>,
        secondary_signers: Vec<AccountAuthenticator>,
    },
    FeePayer {
        sender: AccountAuthenticator,
        secondary_signer_addresses: Vec<AccountAddress>,
        secondary_signers: Vec<AccountAuthenticator>,
        fee_payer_address: AccountAddress,
        fee_payer_signer: AccountAuthenticator,
    },
    SingleSender {
        sender: AccountAuthenticator,
    },
}
```

### Key method:

```rust
impl TransactionAuthenticator {
    pub fn verify(&self, raw_txn: &RawTransaction) -> Result<()>;
    // For encrypted transactions: only Ed25519 authenticator is supported.
    // Signs over the encrypted variant of the raw transaction.
}
```

### Note on encrypted transaction verification:
```rust
// From authenticator.rs verify():
if raw_txn.payload.is_encrypted_variant() && !matches!(self, Self::Ed25519 { .. }) {
    return Err(Error::new(AuthenticationError::EncryptedTxnUnsupportedAuthenticator));
}
// For Ed25519 + encrypted: signature is verified over raw_txn.into_encrypted_variant()
```
