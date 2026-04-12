# Aptos On-Chain Randomness — Complete Deep Dive

## Overview

Aptos provides **native on-chain randomness** — cryptographically secure, unbiasable random values generated directly by the validator set and available synchronously within Move smart contracts. This is defined by **AIP-41** (API design) and **AIP-79** (cryptographic/system-level implementation).

The randomness is:
1. **Unpredictable** — no one can predict the randomness before it is revealed
2. **Unbiasable** — no validator, developer, or user can influence the output
3. **Instant** — available in the same transaction, no extra rounds or oracle calls

Security holds under the same proof-of-stake assumption that secures the Aptos network itself.

## Architecture

### Three-Layer System

```
Layer 1: Distributed Key Generation (DKG)
  - Runs once per epoch (~2 hours)
  - Validators collectively generate a shared secret via weighted PVSS
  - Output: secret key shares distributed to validators

Layer 2: Randomness Generation (per block)
  - Validators produce weighted VUF shares for each block
  - Shares are aggregated into a single 32-byte seed
  - Seed is injected into block_prologue_ext()

Layer 3: Move API (per transaction)
  - aptos_framework::randomness module
  - Derives per-transaction randomness via SHA3-256(DST || seed || tx_hash || counter)
  - Counter increments per call within a transaction
```

### Cryptographic Scheme: Pinkas Weighted VUF

Aptos uses the **Pinkas Weighted Verifiable Unpredictable Function (WVUF)** — a novel construction built on BLS12-381 pairings. This is NOT a standard threshold BLS signature or a simple VRF.

Key types from `types/src/randomness.rs`:
```rust
pub type WVUF = weighted_vuf::pinkas::PinkasWUF;
pub type PK = <WVUF as WeightedVUF>::PubKey;        // G2 dealt public key
pub type SKShare = <WVUF as WeightedVUF>::SecretKeyShare;  // G1 dealt secret key shares
pub type ProofShare = <WVUF as WeightedVUF>::ProofShare;   // G2Projective
pub type Evaluation = <WVUF as WeightedVUF>::Evaluation;   // Gt (target group)
```

The Pinkas WVUF works as follows:
1. **Key augmentation**: Each validator randomizes their DKG-dealt key shares with a random scalar `r`, producing `RandomizedPKs { pi: g^r, rks: [g^(r*sk_i)] }`
2. **Share creation**: For each block, validators compute `H(metadata)^(1/r)` where H is a hash-to-curve function
3. **Share verification**: Uses bilinear pairings: `e(pi, proof) == e(g, H(msg))`
4. **Aggregation**: Shares are aggregated using weighted Lagrange coefficients
5. **Evaluation derivation**: `WVUF::derive_eval()` produces a `Gt` element, which is hashed via SHA3-256 to produce the final 32-byte randomness seed

From `crates/aptos-dkg/src/weighted_vuf/pinkas/mod.rs`:
```rust
pub const PINKAS_WVUF_DST: &[u8; 21] = b"APTOS_PINKAS_WVUF_DST";

fn create_share(ask: &Self::AugmentedSecretKeyShare, msg: &[u8]) -> Self::ProofShare {
    let (r_inv, _) = ask;
    let hash = Self::hash_to_curve(msg);
    hash.mul(r_inv)
}
```

### Distributed Key Generation (DKG)

The DKG runs once per epoch during reconfiguration. From `dkg.move`:

```move
struct DKGSessionMetadata has copy, drop, store {
    dealer_epoch: u64,
    randomness_config: RandomnessConfig,
    dealer_validator_set: vector<ValidatorConsensusInfo>,
    target_validator_set: vector<ValidatorConsensusInfo>,
}
```

The DKG uses **weighted PVSS (Publicly Verifiable Secret Sharing)** based on the DAS (Distributed Aggregation with Summation) scheme. Implementation is in `crates/aptos-dkg/src/pvss/`.

Key parameters from `randomness_config.move`:
- `secrecy_threshold`: Maximum stake fraction that cannot reconstruct randomness (typically ~1/2)
- `reconstruction_threshold`: Minimum stake fraction guaranteed to reconstruct randomness (typically ~2/3)

### Per-Block Randomness Seed

From `randomness.move`:
```move
struct PerBlockRandomness has drop, key {
    epoch: u64,
    round: u64,
    seed: Option<vector<u8>>  // 32-byte seed from WVUF
}
```

The seed is set during the block prologue via `block_prologue_ext()`:
```move
randomness::on_new_block(&vm, epoch, round, randomness_seed);
```

### Per-Transaction Derivation

From `randomness.move`:
```move
const DST: vector<u8> = b"APTOS_RANDOMNESS";

fun next_32_bytes(): vector<u8> acquires PerBlockRandomness {
    assert!(is_unbiasable(), E_API_USE_IS_BIASIBLE);
    let input = DST;
    let seed = *randomness.seed.borrow();
    input.append(seed);
    input.append(transaction_context::get_transaction_hash());
    input.append(fetch_and_increment_txn_counter());
    hash::sha3_256(input)
}
```

Each call to `next_32_bytes()` uses:
- Domain separation tag `"APTOS_RANDOMNESS"`
- The 32-byte block seed (from WVUF)
- The transaction hash (unique per tx)
- A monotonically incrementing counter (unique per call within tx)

## Move API

### Available Functions

```move
// Raw integer generation
public fun u8_integer(): u8
public fun u16_integer(): u16
public fun u32_integer(): u32
public fun u64_integer(): u64
public fun u128_integer(): u128
public fun u256_integer(): u256

// Range generation [min_incl, max_excl)
public fun u8_range(min_incl: u8, max_excl: u8): u8
public fun u16_range(min_incl: u16, max_excl: u16): u16
public fun u32_range(min_incl: u32, max_excl: u32): u32
public fun u64_range(min_incl: u64, max_excl: u64): u64
public fun u128_range(min_incl: u128, max_excl: u128): u128
public fun u256_range(min_incl: u256, max_excl: u256): u256

// Byte generation
public fun bytes(n: u64): vector<u8>

// Permutation generation (Fisher-Yates shuffle)
public fun permutation(n: u64): vector<u64>
```

### Required Annotation

Randomness calls MUST originate from a private entry function with `#[randomness]`:

```move
#[randomness]
entry fun roll_dice(): u8 {
    randomness::u8_range(1, 7)  // Returns 1-6
}
```

This is enforced at runtime by the `is_unbiasable()` native function which checks:
1. The outermost entry function is private (not public)
2. It has the `#[randomness]` annotation

### Gas

Gas is charged via `RANDOMNESS_FETCH_AND_INC_COUNTER` (from `gas_schedule.rs`). The gas cost is for the native function call overhead — the SHA3-256 computation itself is lightweight. There is also a `RequiredGasDeposit` config that pre-charges maximum gas to prevent undergassing attacks.

## Security Model

### Threshold Security

The security of Aptos randomness is **identical to the security of the network itself**: it requires >2/3 of stake to be honest.

- **Secrecy**: No coalition with <= `secrecy_threshold` (typically 1/2) of total stake can predict randomness before it is revealed
- **Reconstruction**: Any coalition with > `reconstruction_threshold` (typically 2/3) of total stake can reconstruct the randomness
- **Unbiasability**: No party can influence the randomness output (it is a deterministic function of the WVUF evaluation)

### Anti-Bias Protections

1. **`#[randomness]` annotation requirement**: Prevents "test-and-abort" attacks where users call a function, check the result, and abort if unfavorable
2. **Private entry function requirement**: Prevents users from wrapping randomness calls in their own logic that could abort
3. **Gas deposit pre-charging**: The `randomness_api_v0_config` module allows requiring upfront gas deposits to prevent undergassing attacks

### Known Limitation: Undergasing

The documentation explicitly states: "randomness API currently does not prevent undergasing attacks." An attacker can set a gas limit that is sufficient only for favorable outcomes. Mitigation: design entry functions so gas cost is independent of the randomness outcome.

## Comparison to Other Chains

### Chainlink VRF (Ethereum/Multi-chain)
- **Mechanism**: Standalone VRF with commit-reveal pattern
- **Latency**: 2+ blocks (~24 seconds on Ethereum L1)
- **Cost**: ~$10+ per request on Ethereum L1
- **Security**: Trust in Chainlink node operators (not the chain's validators)
- **API**: Asynchronous — request in tx 1, receive callback in tx 2
- **Aptos advantage**: Synchronous (same-tx), no external oracle dependency, no extra cost beyond gas, security tied to chain security

### Solana (SlotHashes / recent_blockhash)
- **Mechanism**: Hash of recent slot data
- **Security**: Validators CAN manipulate by choosing to skip slots (last-revealer bias)
- **No true VRF**: Just hash-based pseudo-randomness
- **Verifiability**: Not verifiable — just trust the leader
- **Aptos advantage**: Cryptographically unbiasable, no single validator can influence output

### Sui (drand-based)
- **Mechanism**: Uses external drand beacon (League of Entropy)
- **Latency**: Depends on drand round interval (typically 3 seconds)
- **Security**: Trust in drand committee (separate from Sui validators)
- **Integration**: Not native — requires waiting for drand round
- **Aptos advantage**: Native to the chain, no external dependency, validators themselves generate randomness

### RANDAO (Ethereum Beacon Chain)
- **Mechanism**: XOR of validator RANDAO reveals during block proposals
- **Security**: Last-revealer bias attack — the last validator to reveal can choose to withhold their reveal to bias the output (costs them their block reward)
- **Cost**: Free (built into block production)
- **Aptos advantage**: Provably unbiasable — no last-revealer attack possible due to WVUF construction

### Summary Comparison Table

| Property | Aptos | Chainlink VRF | Solana | Sui (drand) | RANDAO |
|---|---|---|---|---|---|
| Native to chain | Yes | No (oracle) | Yes | No (external) | Yes |
| Latency | Same-tx (~200ms) | 2+ blocks (~24s) | Same-tx | 1+ round (~3s) | Same-block |
| Cost | Gas only | ~$10+ | Gas only | Gas only | Free |
| Unbiasable | Yes (weighted VUF) | Yes (VRF) | No | Yes (threshold BLS) | No (last-revealer) |
| Unpredictable | Yes | Yes | No | Yes | Partially |
| Security model | PoS validators | Oracle operators | Leader trust | drand committee | PoS validators |
| Synchronous API | Yes | No (callback) | Yes | No | N/A |
| Verifiable | Yes (WVUF proof) | Yes (VRF proof) | No | Yes (BLS sig) | Yes (reveals) |

## Web2 Comparison

### Intel RDRAND (Hardware RNG)
- Uses CPU thermal noise as entropy source
- Extremely fast (~100ns per 64-bit value)
- Not verifiable by third parties
- Trust Intel's implementation

### /dev/urandom (OS-level)
- Mixes hardware entropy with CSPRNG (ChaCha20)
- Fast and secure for local use
- Not verifiable, not shared across machines

### Random.org (Atmospheric Noise)
- Uses radio atmospheric noise
- Verifiable via signed timestamps
- Centralized trust (trust Random.org)
- Not suitable for adversarial environments

### Fundamental Difference
On-chain verifiable randomness is a fundamentally different category. It requires:
1. **Distributed generation**: No single party knows the output in advance
2. **Public verifiability**: Anyone can verify the randomness was generated correctly
3. **Determinism**: Given the same inputs, the same output is produced (for consensus)
4. **Adversarial security**: Must be secure even when some participants are malicious

Hardware RNG and OS-level sources are designed for a single trusted machine. On-chain randomness must work across an adversarial distributed network — a strictly harder problem.

## Key Contributors

From git history analysis:
- **Daniel Xiang (zhuolun-xiang)**: Primary randomness contributor (consensus integration)
- **Balaji Arun (ibalajiarun)**: DKG and rand manager infrastructure
- **Alin Tomescu (alinush)**: aptos-dkg crate, Pinkas WVUF implementation, cryptographic primitives

## Key Source Files

- `aptos-move/framework/aptos-framework/sources/randomness.move` — Move API
- `aptos-move/framework/aptos-framework/sources/dkg.move` — DKG on-chain state
- `aptos-move/framework/aptos-framework/sources/configs/randomness_config.move` — Configuration
- `aptos-move/framework/aptos-framework/sources/configs/randomness_api_v0_config.move` — Gas deposit config
- `aptos-move/framework/natives/src/randomness.rs` — Native function implementations
- `consensus/src/rand/rand_gen/rand_manager.rs` — Randomness generation manager
- `consensus/src/rand/rand_gen/types.rs` — Share/aggregation types
- `crates/aptos-dkg/src/weighted_vuf/pinkas/mod.rs` — Pinkas WVUF implementation
- `crates/aptos-dkg/src/weighted_vuf/traits.rs` — WeightedVUF trait definition
- `types/src/randomness.rs` — Core type definitions and aliases
- `types/src/dkg/real_dkg/mod.rs` — DKG PVSS configuration
