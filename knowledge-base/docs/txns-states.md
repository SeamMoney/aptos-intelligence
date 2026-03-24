# Transactions and States

## Overview

The Aptos blockchain stores three primary data types: transactions (representing intended operations), states (the accumulated ledger representing all resource values), and events (ancillary data from transaction execution). Only transactions can change the ledger state.

## Transactions

Aptos transactions contain sender account address, authentication, desired operations, and gas payment specifications.

### Transaction States

Transactions conclude in one of four states:

- **Committed and executed** (successful)
- **Committed but aborted** (with abort code indicating failure reason)
- **Discarded during submission** (validation failures: insufficient gas, invalid format, incorrect key)
- **Discarded after submission but before execution** (timeouts, insufficient gas from competing transactions)

Senders are charged gas for all committed transactions. Successfully submitted but ultimately discarded transactions may leave no visible state on accessible nodes. Users can resubmit with trivially increased gas costs to overcome downstream obstacles.

### Transaction Contents

A signed transaction contains:

- **Signature**: Digital verification of sender authentication
- **Sender address**: Account address of transaction originator
- **Sender public key**: Public authentication key corresponding to private signing key
- **Payload**: Action specification -- either Move function calls or transaction scripts with input parameters
- **Gas unit price**: Amount sender pays per gas unit (in Octas)
- **Maximum gas amount**: Maximum APT sender will pay for execution
- **Sequence number**: Unsigned integer equaling sender's account sequence number at execution time
- **Expiration time**: Timestamp after which transaction becomes invalid

### Transaction Payload Types

Two primary payload types exist:

- **Entry points** (supported by Python and TypeScript SDKs)
- **Script payloads** (callable to any entry point or public function in any module)

All Aptos blockchain operations should be available through entry point calls.

## States

The ledger state represents all accounts' state within Aptos. Upon transaction execution, transaction output generates zero or more write set operations manipulating ledger state, events vector, gas consumption data, and execution status.

### Proofs

The blockchain implements cryptographic proofs ensuring:

- Validator node agreement on state
- Client independence from data source trust -- proofs verify transaction authenticity without relying on the providing entity

Data structures use Merkle trees where each leaf represents an executed transaction.

### Versioned Database

Ledger state versioning uses unsigned 64-bit integers corresponding to executed transaction counts, enabling:

- Transaction execution against latest ledger state
- Client queries about ledger history at current and previous versions

## Transaction Execution and State Change

When transaction T_i executes against state S_(i-1), the deterministic Apply() function produces new state S_i. The Move language implements this deterministic execution ensuring identical inputs always produce identical outputs.

## Size Limits

Transaction and output size limits (configurable via gas schedule):

| Limit Type | Current Limit |
|---|---|
| Standard transaction | 64 KB |
| Governance transaction | 1 MB |
| Single write operation | 1 MB |
| Combined write operations | 10 MB |
| Write operation count | 8,192 |
| Single event | 1 MB |
| Combined events | 10 MB |
