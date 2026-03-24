# Move - A Web3 Language and Runtime

## Overview

The Aptos blockchain relies on validator nodes running a consensus protocol that orders transactions and executes them on the Move Virtual Machine (MoveVM). Transactions and ledger state are processed through the VM to generate changesets, which become publicly visible once consensus commits the output.

## What is Move?

Move is a programming language designed for Web3 that prioritizes **scarcity** and **access control**.

### Scarcity

Resources in Move cannot be accidentally duplicated or dropped by default. Only structs explicitly marked as `copy` can be duplicated, and only those marked `drop` can be dropped.

### Access Control

Access control operates through two mechanisms:

- **Account-based**: A transaction's sender is represented by a `signer` -- a verified account owner with the highest permission level. Only signers can add resources to accounts.
- **Module-based**: Public functions are the only module functions accessible externally. Struct constructors remain private unless explicitly made public. Fields are accessible only within their defining module or through designated public accessors/setters. Structs with the `key` ability can only be stored/read in global storage within their defining module. Structs with `store` can be nested within other `store` or `key` structs.

## Comparison to Other VMs

| Feature | Aptos/Move | Solana/SeaLevel | EVM | Sui/Move |
|---------|-----------|-----------------|-----|----------|
| Data Storage | Global address or owner's account | Owner's account associated with program | Account associated with contract | Global address |
| Parallelization | Runtime inference within Aptos | Requires specifying all data accessed | Serial in production | Requires specifying all data accessed |
| Transaction Safety | Sequence number | Transaction uniqueness | Nonces (similar to sequence numbers) | Transaction uniqueness |
| Type Safety | Module structs and generics | Program structs | Contract types | Module structs and generics |
| Function Calling | Static dispatch | Static dispatch | Dynamic dispatch | Static dispatch |
| Authenticated Storage | Yes | No | Yes | No |
| Object Global Accessibility | Yes | N/A | N/A | No, can be placed in other objects |

## Aptos Move Features

The Aptos Move adapter extends core MoveVM capabilities through:

- **Move Objects**: Extensible programming model offering global access to heterogeneous resources at single on-chain addresses
- **Cryptography Primitives**: Support for scalable, privacy-preserving dapps
- **Resource Accounts**: Programmable on-chain accounts useful for DAOs and complex applications
- **Tables**: Key-value storage at scale within accounts
- **Parallelism via Block-STM**: Concurrent transaction execution without user input
- **Multi-Agent Framework**: Single transactions with multiple distinct `signer` entities

### Aptos Framework Libraries

- **Token Objects**: Standard (AIP-11, AIP-22) enabling interoperable NFTs with minimal smart contract development
- **Coin Standard**: Type-safe coin creation via simple module publishing
- **Fungible Asset Standard** (AIP-21): Modernized coin concept with improved programmability and controls
- **Staking and Delegation Frameworks**: Native staking and delegation infrastructure
- **Type Information Service** (`type_of`): Runtime identification of address, module, and struct names
- **Timestamp Service**: Monotonically increasing clock mapped to Unix time
