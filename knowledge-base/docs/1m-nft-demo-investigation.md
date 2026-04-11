# 1M NFT Minting Demo Investigation

## Summary

In November 2023, Aptos Labs ran a **Previewnet** (Oct 30 - Nov 21, 2023) with 125 validator nodes across 26 countries. During this test, they minted **1 million limited-collection NFTs in ~90 seconds** and **5 million NFTs in ~8 minutes**, sustaining ~10k NFTs/second. This was a **10x improvement** over sequential (non-Aggregator) execution.

---

## The Exact Contract: Ambassador Token

The benchmark used the **`ambassador_token`** Move module located at:

```
aptos-core/aptos-move/move-examples/token_objects/ambassador/sources/ambassador.move
```

- **Module**: `ambassador::ambassador`
- **Package name**: `ambassador_token`
- **Address**: `0xCAFE` (test deployment address)

### What the Module Does

The ambassador token is a **soulbound (non-transferable) Token Object (v2)** with these characteristics:

- Uses `aptos_token_objects::collection` and `aptos_token_objects::token` (the Token Objects / Digital Asset Standard)
- Creates an **unlimited collection** (no max supply cap on the collection itself, uses `create_unlimited_collection`)
- Each token stores:
  - `AmbassadorToken` resource: `mutator_ref`, `burn_ref`, `property_mutator_ref`, `base_uri`
  - `AmbassadorLevel` resource: `ambassador_level: u64` (starts at 0)
  - A `property_map` with one property: `"Rank"` (Bronze/Silver/Gold based on level)
- Tokens are **soulbound**: `disable_ungated_transfer` is called after minting

### The Benchmark Entry Point

The forge test framework calls:

```move
public entry fun mint_ambassador_token_by_user(
    user: &signer,
    creator: &signer,
    description: String,
    uri: String,
)
```

This uses **multi-sig** (user + creator) to mint a named token where the token name is the user's address converted to string. For the numbered variant used in benchmarks:

```move
public entry fun mint_numbered_ambassador_token_by_user(
    user: &signer,
    creator: &signer,
    description: String,
    name: String,
    uri: String,
)
```

This calls `token::create_numbered_token()` which uses **Aggregators V2** internally to assign sequential indices without blocking parallel execution.

### Benchmark Parameters (from transaction-workloads-lib)

When `TokenV2AmbassadorMint { numbered: true }` is used:
- Entry function: `mint_numbered_ambassador_token_by_user`
- Arguments: random 100-char description, `"superstar #"` as name prefix, random 50-char URI
- Automatic args: `SignerAndMultiSig` (user signer + creator multisig)

---

## How Aggregators V2 Enable Parallel Minting (AIP-47)

### The Problem

NFT collections with sequential naming (e.g., "Star #143") and limited supply require:
1. A shared counter for supply tracking
2. Sequential index assignment for naming

Both are inherently sequential -- every mint must read-modify-write the same counter, creating a bottleneck.

### The Solution: Aggregators and Snapshots

Aggregators V2 (AIP-47) introduce three key types:

```move
struct Aggregator<IntTy> has store {
    value: IntTy,
    max_value: IntTy,
}

struct AggregatorSnapshot<IntTy> has store {
    value: IntTy,
}

struct DerivedStringSnapshot has store { ... }
```

**Key APIs:**
- `try_add(aggregator, value)` -- concurrent increment, fails if exceeds max
- `snapshot(aggregator)` -- capture current value without blocking
- `derive_string_concat(before, snapshot, after)` -- create a string that includes the snapshot value, resolved later

**How it works:**
1. Aggregator modifications go into the `VMChangeSet` as separate ephemeral keys (not the resource's StateKey)
2. This means concurrent transactions don't conflict on the collection's supply counter
3. Token names like `"superstar #4217"` are constructed via `derive_string_concat("superstar #", snapshot, "")` -- the actual number is filled in at commit time
4. The `TokenIdentifiers` struct stores an `AggregatorSnapshot<u64>` for the index and a `DerivedStringSnapshot` for the name

### Collection Supply Tracking

The `collection.move` module uses:
```move
struct ConcurrentSupply has key {
    current_supply: Aggregator<u64>,
    total_minted: Aggregator<u64>,
}
```

- `create_fixed_collection` uses `aggregator_v2::create_aggregator(max_supply)` -- bounded
- `create_unlimited_collection` uses `aggregator_v2::create_unbounded_aggregator()` -- unbounded
- The ambassador benchmark uses `create_unlimited_collection`

---

## Gas Costs

### Per-Token Gas (E2E Benchmark Calibration)

From `aptos-move/e2e-benchmark/data/calibration_values.tsv`:

| Operation | Gas Units |
|-----------|-----------|
| **TokenV2AmbassadorMint { numbered: true }** | **195.0** |
| TokenV1MintAndTransferNFTSequential | 292.9 |
| TokenV1MintAndTransferFT | 211.3 |
| FungibleAssetMint | 104.9 |
| CreateObjects { num: 10, payload: 0 } | 82.4 |

The ambassador NFT mint costs **195 gas units** in the e2e benchmark.

### Gas Profiling Values

From `e2e-benchmark/src/gas_profiling.rs`:
- Small DB TPS estimate: **1,077**
- Large DB TPS estimate: **1,274**

### Single Node Performance

From `testsuite/single_node_performance_values.tsv`:
- `token-v2-ambassador-mint` (1 module): **19,426.5** TPS
- `token-v2-ambassador-mint` (100 modules): **19,426.5** TPS

### Storage Fees (Gas Schedule)

From the Aptos gas schedule (release builder example output, feature version 7):

| Parameter | Value (internal gas units) |
|-----------|---------------------------|
| `storage_fee_per_state_slot_create` | 50,000 |
| `storage_fee_per_excess_state_byte` | 50 |
| `gas_unit_scaling_factor` | 1,000,000 |
| `min_price_per_gas_unit` | 100 (octas) |
| `free_write_bytes_quota` | 1,024 bytes |

Updated values (V1.14+):
| Parameter | Value |
|-----------|-------|
| `storage_fee_per_state_slot` | 400,000 |
| `storage_fee_per_state_byte` | 400 |
| `legacy_storage_fee_per_state_slot_create` | 500,000 |

### What Gets Created Per Mint (On-Chain State)

Each ambassador token mint creates:

1. **Object resource** at a new address (the token's object address)
2. **Token resource** (collection ref, description, URI, deprecated fields, mutation event)
3. **TokenIdentifiers resource** (`AggregatorSnapshot<u64>` index, `DerivedStringSnapshot` name)
4. **AmbassadorToken resource** (mutator_ref, burn_ref, property_mutator_ref, base_uri)
5. **AmbassadorLevel resource** (ambassador_level: u64 = 0)
6. **PropertyMap** (with one entry: "Rank" = "Bronze")
7. **TransferRef** operations (linear transfer + disable ungated transfer)

That is approximately **6-7 state slot creations** and associated byte storage per mint.

---

## How Lightweight Is It?

### The Token Itself

The ambassador token is NOT the absolute minimum possible NFT. It includes:
- Property map with rank tracking
- Mutable URI (changes with rank)
- Level tracking
- Burn capability
- Soulbound transfer restriction

A **truly minimal Token Object** would only need:
- Object resource (~50 bytes)
- Token resource (collection ref + description + name + URI, ~200-300 bytes depending on string lengths)
- TokenIdentifiers resource (~40 bytes with aggregator snapshots)

### Comparison

| Metric | Ambassador Token | Minimal Token Object | Token V1 NFT |
|--------|-----------------|---------------------|--------------|
| Gas units | 195.0 | ~80-100 (est.) | 292.9 |
| State slots created | ~6-7 | ~2-3 | ~4-5 |
| Custom data | Level, Rank, PropertyMap | None | PropertyMap required |

The ambassador token benchmark was chosen because it represents a **realistic NFT** -- not the absolute minimum, but a practical token with properties, metadata, and governance capabilities.

---

## Previewnet Configuration

- **Duration**: October 30 - November 21, 2023
- **Validators**: 125 nodes across 26 countries
- **Total transactions**: 9+ billion over the full test period
- **Peak P2P TPS**: 30,000
- **Sustained P2P TPS**: 25,000 for hours
- **24-hour record**: 2 billion transactions
- **NFT minting**: 1M in ~90s, 5M in ~8min (~10k NFTs/sec sustained)

---

## Key Source Files

| File | Purpose |
|------|---------|
| `aptos-move/move-examples/token_objects/ambassador/sources/ambassador.move` | The actual Move contract used |
| `aptos-move/move-examples/token_objects/ambassador/Move.toml` | Package config |
| `crates/transaction-workloads-lib/src/args.rs` | `TokenV2AmbassadorMint` enum variant |
| `crates/transaction-workloads-lib/src/move_workloads.rs` | Workload configuration |
| `crates/transaction-workloads-lib/src/token_workflow.rs` | Mint+burn cycle workflow |
| `crates/transaction-generator-lib/src/call_custom_modules.rs` | Transaction generator framework |
| `testsuite/single_node_performance.py` | Performance test runner |
| `testsuite/single_node_performance_values.tsv` | Expected TPS values |
| `aptos-move/e2e-benchmark/data/calibration_values.tsv` | Gas calibration data |
| `aptos-move/framework/aptos-token-objects/sources/token.move` | Token Objects framework |
| `aptos-move/framework/aptos-token-objects/sources/collection.move` | Collection with ConcurrentSupply |
| `aptos-move/framework/aptos-framework/sources/aggregator_v2/aggregator_v2.move` | Aggregator V2 implementation |
| `testsuite/benchmark-workloads/generate.py` | Benchmark package builder |

---

## Sources

- [Previewnet blog post (Medium)](https://medium.com/aptoslabs/previewnet-ensuring-scalability-and-reliability-of-the-aptos-network-48f0d210e8fe)
- [Aggregators blog post (Medium)](https://medium.com/aptoslabs/aggregators-how-sequential-workloads-are-executed-in-parallel-on-the-aptos-blockchain-e7992c70cefb)
- [Solving NFT Minting at Scale (Medium)](https://medium.com/aptoslabs/aptos-nfts-solving-nft-minting-at-scale-79a4334ac8ac)
- [Aptos Forum announcement](https://forum.aptosfoundation.org/t/aptos-network-achieves-new-performance-and-throughput-milestones-in-mirrored-mainnet-environment-previewnet/308)
- [AIP-47: Aggregators V2](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-047-aggregators-v2.md)
- [Ambassador token source](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/token_objects/ambassador/sources/ambassador.move)
- [PR #8209: Different NFT workloads](https://github.com/aptos-labs/aptos-core/pull/8209)
- [Aptos Gas and Storage Fees](https://aptos.dev/network/blockchain/gas-txn-fee)
- [Computing Transaction Gas](https://aptos.dev/network/blockchain/base-gas)
