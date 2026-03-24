# Aptos Blockchain Deep Dive

## Overview

The Aptos Blockchain Deep Dive documentation details the complete lifecycle of transactions from submission through commitment, along with the architectural components that enable this process.

## Life of a Transaction

The document traces a transaction's journey through five distinct stages:

### Transaction Stages

1. **Accepting** - Client submits signed transaction to REST service
2. **Sharing** - Transaction propagates through mempool to other validators
3. **Proposing** - Block proposal by current leader/proposer
4. **Executing & Consensus** - Block execution and validator agreement
5. **Committing** - Persistent storage of agreed-upon transactions

## Core Node Components

### Validator Node Architecture

- **Mempool** - In-memory buffer holding pending transactions awaiting execution
- **Consensus** - Coordinates ordering of blocks and validator agreement
- **Execution** - Manages transaction execution and maintains transient state
- **Virtual Machine (VM)** - Verifies and executes Move bytecode
- **Storage** - Persists finalized transactions to blockchain
- **REST Service** (Fullnode) - Entry point for client requests

## Key Technical Flows

### Mempool Validation

The system ensures transactions are validated upon entering a mempool through sequence number verification, signature checking, and balance confirmation before propagation.

### Execution Model

Transaction execution occurs speculatively during consensus before finalization. The execution component maintains a "scratchpad" holding in-memory Merkle accumulator copies to calculate state root hashes prior to validator agreement.

### Consensus Integration

When a validator becomes leader, its consensus component pulls transaction batches from mempool and replicates proposals to other validators. Agreement requires 2f+1 validator signatures.

### State Management

Account sequence numbers increment by one per committed transaction, preventing replay attacks. The blockchain uses a Merkle accumulator data structure for transaction ordering and state verification.
