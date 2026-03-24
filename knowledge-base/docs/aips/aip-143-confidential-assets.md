# AIP-143: Confidential APT

**AIP:** 143
**Title:** Confidential APT
**Authors:** @alinush, @sherry-x
**Status:** Draft
**Type:** Standard
**Created:** 03/04/2026

---

## Overview

This proposal introduces a privacy-preserving extension to Aptos' fungible asset model enabling encrypted peer-to-peer transfers. The system maintains that sender and recipient addresses remain visible, while amounts and balances are hidden from public observers, with optional auditor access for compliance.

## Motivation

The document identifies three core drivers:

1. **Security risks** from publicly visible balances enabling targeted attacks and financial profiling
2. **Real-world use cases** requiring confidentiality (institutional treasury, payroll, token grants)
3. **Regulatory compatibility** through selective disclosure mechanisms

## Specification

### Key Components

**Cryptographic foundations:**

- **Twisted ElGamal encryption** for additively homomorphic balance encryption
- **Zero-knowledge proofs** verifying transaction validity
- **Range proofs** constraining encrypted values within safe bounds (amounts in [0, 2^64), balances in [0, 2^128))

### Move Module Interface

Six primary functions:

1. `register()` -- Registers user encryption keys
2. `deposit()` -- Converts public to confidential balance
3. `withdraw()` -- Converts confidential to public balance
4. `transfer()` -- Confidential peer-to-peer transfers
5. `rotate_key()` -- Key rotation without balance exposure
6. `balance()` -- Returns encrypted balance

### SDK Interface

Client-side operations include:
- `generate_encryption_key_pair()`
- `generate_transfer_proof()`
- `decrypt_balance()`

## Design Rationale

The framework balances privacy against verifiability by:

- Encrypting balances and amounts while keeping addresses visible
- Using homomorphic encryption for efficient updates
- Employing zero-knowledge proofs for validation without data revelation
- Requiring no consensus protocol modifications

## Key Design Choices

### Governance-Assigned Auditing

No auditor is assigned at launch with authority retained by on-chain governance. If an auditor is designated at time T:

- **May decrypt:** Transactions and balances post-T
- **Cannot decrypt:** Pre-T transactions or historical balances

This ensures governance actions cannot retroactively compromise user confidentiality.

### Selective User Disclosure

Users retain control, able to share decryption keys or verified histories with trusted parties without public exposure.

### APT-Only Restriction

Confidential functionality restricted to APT at launch -- a product and ecosystem decision rather than a technical limitation. Other assets cannot opt in.

**Rationale includes:**
- Preventing dilution of privacy capabilities
- Avoiding fragmented liquidity
- Simplifying auditing requirements
- Reducing systemic risk during early deployment

## Backwards Compatibility

The system operates alongside standard APT, enabling conversion through deposit/withdrawal. No modifications to the Aptos consensus protocol are required.

## Performance and Gas Costs

### Client-Side Operations

- **Proof generation:** ~25 ms
- **Amount decryption:** ~0.3-0.5 ms
- **Balance decryption (Baby-Step Giant-Step):** ~13 ms (native) / 130-260 ms (browser)

These occur client-side without affecting validator throughput.

### Validator Operations

- **Proof verification:** ~2 ms

Verification uses specialized sigma protocols and range proofs rather than general-purpose circuits, reducing complexity while avoiding trusted setups.

### Gas Pricing

Confidential transfers incur higher costs than standard transfers due to proof verification, ciphertext processing, and increased payload size.

### Network Impact

The design maintains modest additional execution overhead while preserving Aptos' high-throughput execution model.

## Security Considerations

Critical elements include:

- Range proofs preventing overflow attacks
- Zero-knowledge proofs enforcing token conservation
- Secure user key management requirements
- Comprehensive pre-mainnet security auditing

## Deployment Timeline

- **Current status:** Testnet implementation available
- **URL:** https://confidential.aptoslabs.com/
- **Mainnet target:** April 2026 (pending security audits and governance approval)

## Future Feature Considerations

### Confidential Staking
Enabling confidential APT participation in staking while maintaining voting power verification and reward distribution.

### Confidential Governance
Supporting voting power proof through cryptographic balance verification while preserving outcome transparency.

### DeFi and Application Integration
Privacy-preserving payment primitives, settlement protocols, and privacy-aware DeFi upon infrastructure maturation.

## Ecosystem Impact

### Developer and Wallet Considerations
Developers can build privacy-preserving applications including private payment systems, payroll and compensation infrastructure, token distribution and grant systems.

Wallets must support encryption key generation, proof production, balance decryption, and key rotation.

### Institutional Use Cases
Examples include confidential treasury operations, private payroll distribution, token grants, and institutional settlement.
