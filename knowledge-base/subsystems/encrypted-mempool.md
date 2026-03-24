# Encrypted Mempool / Encrypted Transactions Subsystem

Source files:
- `types/src/transaction/encrypted_payload.rs`
- `crates/aptos-batch-encryption/src/shared/ciphertext/bibe.rs`
- `crates/aptos-batch-encryption/src/shared/ciphertext/mod.rs`
- `consensus/src/quorum_store/types.rs` (BatchKind::Encrypted handling)
- `types/src/transaction/authenticator.rs` (encrypted txn signature verification)

---

## EncryptedPayload (`types/src/transaction/encrypted_payload.rs`)

Three-state enum representing the lifecycle of an encrypted transaction payload: encrypted, failed decryption, or successfully decrypted.

```rust
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct DecryptedPayload {
    executable: TransactionExecutable,
    decryption_nonce: u64,
}

impl Plaintext for DecryptedPayload {}

#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct PayloadAssociatedData {
    sender: AccountAddress,
}

impl AssociatedData for PayloadAssociatedData {}

#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum DecryptionFailureReason {
    /// Cryptographic decryption failed (e.g., invalid ciphertext, key mismatch).
    CryptoFailure,
    /// Transaction exceeded the per-block encrypted transaction batch limit.
    /// Should be retried in a subsequent block.
    BatchLimitReached,
    /// The decryption key is not available.
    ConfigUnavailable,
    /// The decryption key is not available.
    DecryptionKeyUnavailable,
}

#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum EncryptedPayload {
    Encrypted {
        ciphertext: Ciphertext,
        extra_config: TransactionExtraConfig,
        payload_hash: HashValue,
    },
    FailedDecryption {
        ciphertext: Ciphertext,
        extra_config: TransactionExtraConfig,
        payload_hash: HashValue,
        eval_proof: Option<EvalProof>,
        reason: DecryptionFailureReason,
    },
    Decrypted {
        ciphertext: Ciphertext,
        extra_config: TransactionExtraConfig,
        payload_hash: HashValue,
        eval_proof: EvalProof,
        executable: TransactionExecutable,
        decryption_nonce: u64,
    },
}
```

### Key methods:

```rust
impl EncryptedPayload {
    pub fn ciphertext(&self) -> &Ciphertext;
    pub fn executable(&self) -> Result<TransactionExecutable>;
    pub fn executable_ref(&self) -> Result<TransactionExecutableRef<'_>>;
    pub fn decryption_failure_reason(&self) -> Option<&DecryptionFailureReason>;
    pub fn extra_config(&self) -> &TransactionExtraConfig;
    pub fn is_encrypted(&self) -> bool;

    /// Transition from Encrypted to Decrypted state
    pub fn into_decrypted(
        &mut self,
        eval_proof: EvalProof,
        executable: TransactionExecutable,
        nonce: u64,
    ) -> anyhow::Result<()>;

    /// Transition from Encrypted to FailedDecryption state
    pub fn into_failed_decryption_with_reason(
        &mut self,
        eval_proof: Option<EvalProof>,
        reason: DecryptionFailureReason,
    ) -> anyhow::Result<()>;

    /// Verify ciphertext authenticity using sender address as associated data
    pub fn verify(&self, sender: AccountAddress) -> anyhow::Result<()>;
}
```

---

## BIBE Ciphertext (`crates/aptos-batch-encryption/src/shared/ciphertext/bibe.rs`)

Broadcast Identity-Based Encryption (BIBE) implementation for encrypted transactions.

```rust
pub trait InnerCiphertext: Sized + Clone + Serialize + DeserializeOwned + Eq + PartialEq + Hash {
    type EncryptionKey: BIBECTEncrypt<CT = Self>;

    fn id(&self) -> Id;
    fn prepare_individual(&self, digest: &Digest, eval_proof: &EvalProof) -> PreparedBIBECiphertext;
    fn prepare(&self, digest: &Digest, eval_proofs: &EvalProofs)
        -> Result<PreparedBIBECiphertext, MissingEvalProofError>;
}

#[derive(Clone, Serialize, Deserialize, Debug, Hash, Eq, PartialEq)]
pub struct BIBECiphertext {
    pub id: Id,
    ct_g2: [G2Affine; 3],           // Elliptic curve elements
    padded_key: OneTimePaddedKey,
    symmetric_ciphertext: SymmetricCiphertext,
}

#[derive(Clone, Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct PreparedBIBECiphertext {
    pub id: Id,
    pub(crate) pairing_output: PairingOutput,
    pub(crate) ct_g2: G2Prepared,
    pub(crate) padded_key: OneTimePaddedKey,
    pub(crate) symmetric_ciphertext: SymmetricCiphertext,
}

pub trait BIBECTEncrypt {
    type CT: InnerCiphertext;
    fn for_testing() -> Self;
    fn bibe_encrypt<R: RngCore + CryptoRng>(
        &self,
        rng: &mut R,
        msg: &impl Plaintext,
        id: Id,
    ) -> Result<Self::CT>;
}

pub trait BIBECTDecrypt<P: Plaintext> {
    fn bibe_decrypt(&self, ct: &PreparedBIBECiphertext) -> Result<P>;
}
```

---

## Integration Points

### In TransactionPayload (types/src/transaction/mod.rs):
```rust
pub enum TransactionPayload {
    // ... other variants ...
    EncryptedPayload(EncryptedPayload),  // Encrypted transaction payload variant
}
```

### In Quorum Store Batch Verification (consensus/src/quorum_store/types.rs):
```rust
// V2 batches validate that BatchKind matches transaction types:
match batch_kind {
    BatchKind::Encrypted => {
        // All txns must be encrypted
        // Ciphertext verification: ~40us per txn (ED25519 sig check)
        // Parallel verification with rayon
        txns.par_iter().try_for_each(|txn| {
            ensure!(txn.is_encrypted_txn(), "Encrypted batch contains non-encrypted transaction");
            txn.payload().as_encrypted_payload().verify(txn.sender())
        })?;
    },
    BatchKind::Normal => {
        // No encrypted txns allowed
        for txn in self.payload.txns() {
            ensure!(!txn.is_encrypted_txn(), "Normal batch contains encrypted transaction");
        }
    },
}
```

### In Transaction Authenticator (types/src/transaction/authenticator.rs):
- Only `Ed25519` authenticator is supported for encrypted transactions
- Signature is computed over `raw_txn.into_encrypted_variant()` (not the full raw txn)

### In AptosVM (aptos-move/aptos-vm/src/aptos_vm.rs):
- References `BlockTxnDecryptionKey` for block-level decryption
- Handles `DecryptionFailureReason` during execution
