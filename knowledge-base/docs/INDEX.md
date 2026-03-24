# Aptos Knowledge Base - Document Index

## Core Documentation

| File | Description |
|---|---|
| [blockchain-deep-dive.md](./blockchain-deep-dive.md) | Transaction lifecycle stages, validator node components (mempool, consensus, execution, VM, storage), and core technical flows |
| [move.md](./move.md) | Move language overview: scarcity, access control, VM comparison table, Aptos-specific features (Objects, Block-STM, Tables), and framework libraries |
| [accounts.md](./accounts.md) | Account model: address format, authentication schemes (Ed25519, Secp256k1, MultiKey, Keyless), sequence numbers, key rotation, and signer-based access control |
| [resources.md](./resources.md) | Resource and instance model: key/store abilities, struct permissions, phantom types, storage layout, and parallel execution implications |
| [events.md](./events.md) | Event system: modern module events with `#[event]` attribute, legacy EventHandle events (deprecated), testing APIs, and migration strategy |
| [txns-states.md](./txns-states.md) | Transaction structure (payload, gas, sequence number, expiration), transaction states, ledger versioning, Merkle proofs, deterministic execution, and size limits |
| [staking.md](./staking.md) | Proof-of-stake consensus: owner-operator-voter model, validator states, epoch mechanics (7200s), rewards formula, lockup, and stake withdrawal |

## Architecture Reference

| File | Description |
|---|---|
| [architecture-overview.md](./architecture-overview.md) | Comprehensive technical reference covering full transaction lifecycle, Block-STM parallel execution (MVCC, speculative execution, validation), Quorum Store, Raptr/Prefix consensus, Jellyfish Merkle Tree, Move VM internals, encrypted mempool (BIBE), Zaptos optimistic pipelining, and Shardines internal sharding |

## Aptos Improvement Proposals (AIPs)

| File | Description |
|---|---|
| [aips/aip-61-keyless-accounts.md](./aips/aip-61-keyless-accounts.md) | AIP-61: Keyless Accounts -- OIDC-based blockchain accounts using zero-knowledge proofs, eliminating secret key management via Google/Apple/GitHub login |
| [aips/aip-143-confidential-assets.md](./aips/aip-143-confidential-assets.md) | AIP-143: Confidential APT -- privacy-preserving transfers using Twisted ElGamal encryption, range proofs, and homomorphic balance operations with optional auditor access |
