# Alin Tomescu (alinush) -- Encryption and Confidential Assets at Aptos

## Role

Alin Tomescu is the Founding Team Head of Cryptography at Aptos Labs since February 2022. He has a PhD from MIT and 13 years of combined academic research and production engineering experience in cryptography.

## Academic Research

### UTT: Decentralized Ecash with Accountable Privacy (2022)

- **Paper:** IACR ePrint 2022/452
- **Authors:** Alin Tomescu, Adithya Bhat, Benny Applebaum, Ittai Abraham, Guy Gueta, Benny Pinkas, Avishay Yanai
- **Core idea:** Full anonymity for digital payments -- sender, receiver, AND amount are all hidden -- with "anonymity budgets" so users can only send up to a limited amount anonymously per month
- **Cryptographic building blocks:** Pointcheval-Sanders (PS) signatures with re-randomizable anonymous credentials, threshold cryptography for decentralized trust, BFT infrastructure
- **Performance:** ~1,000 anonymous payments/second with ~100ms latency
- **Key innovation:** Unlike zkSNARK-based approaches (Zcash), UTT uses sigma protocols and PS signatures for much simpler and faster proofs

### Pairing-Based Anonymous Credentials and Re-Randomization (2023)

- Blog post and research on how PS signatures can sign Pedersen commitments directly and be re-randomized with the signed commitment, enabling anonymous coin credentials as used in UTT

### Towards Scalable Threshold Cryptosystems (IEEE S&P 2020)

- **Paper:** aptoslabs.com/pdf/dkg-sp2020.pdf
- Techniques to scale threshold signature schemes, VSS, and DKG to hundreds of thousands of participants
- AMT VSS: O(n log t) sharing phase, O(t log^2 t + n log t) reconstruction
- Directly informs the Aptos DKG used for on-chain randomness

### Distributed Randomness Using Weighted VUFs (2024)

- New scalable PVSS scheme with aggregatable transcripts for weighted VUF-based DKG
- Implemented and deployed on Aptos mainnet with 112 validators

## Aptos Confidential Assets -- What Is Deployed

### Architecture (v1.1, March 2026)

The confidential assets system is defined across several Move modules in `aptos-move/framework/aptos-framework/sources/confidential_asset/`:

**Core modules:**
- `confidential_asset.move` -- Main entry points: register, deposit, withdraw, transfer, rotate_key, rollover, normalize
- `confidential_balance.move` -- Balance types using chunked Twisted ElGamal encryption
- `confidential_amount.move` -- Transfer amount encrypted under multiple keys (sender, recipient, auditors)
- `confidential_range_proofs.move` -- Bulletproofs-based range proof verification

**Sigma protocol library:**
- `sigma_protocols/sigma_protocol.move` -- Generic sigma protocol framework
- `sigma_protocols/proofs/sigma_protocol_transfer.move` -- Transfer proof (correctness of encrypted amount)
- `sigma_protocols/proofs/sigma_protocol_withdraw.move` -- Withdrawal proof
- `sigma_protocols/proofs/sigma_protocol_registration.move` -- Key knowledge proof
- `sigma_protocols/proofs/sigma_protocol_key_rotation.move` -- Re-encryption proof

### Cryptographic Design

**Twisted ElGamal Encryption:**
- Balance `a` is split into 16-bit chunks: `[a_0, a_1, ..., a_{n-1}]` where `a = sum(a_i * B^i)`, B = 2^16
- Each chunk `i` encrypted as: `P_i = a_i * G + r_i * H` (Pedersen commitment), `R_i = r_i * ek` (ElGamal component)
- Pending balance: 4 chunks (64-bit), Available balance: 8 chunks (128-bit)
- Additively homomorphic: ciphertexts can be added without decryption

**Balance Structure:**
```
CompressedBalance<T> {
    P: vector<CompressedRistretto>,     // Pedersen commitments per chunk
    R: vector<CompressedRistretto>,     // ElGamal components per chunk (user key)
    R_aud: vector<CompressedRistretto>, // Auditor ElGamal components (optional)
}
```

**Transfer Amount Structure:**
```
Amount {
    P: vector<RistrettoPoint>,              // Shared Pedersen commitments
    R_sender: vector<RistrettoPoint>,       // Encrypted under sender key
    R_recip: vector<RistrettoPoint>,        // Encrypted under recipient key
    R_eff_aud: vector<RistrettoPoint>,      // Encrypted under effective auditor (optional)
    R_volun_auds: vector<vector<RistrettoPoint>>,  // Voluntary auditors
}
```

**Proofs required per transfer:**
1. Sigma protocol proof: proves the transfer is well-formed (balance conservation, correct encryption)
2. Two Bulletproofs range proofs: one for new sender balance (non-negative), one for transfer amount (non-negative)

### Privacy Guarantees

**What IS hidden:**
- Token amounts in transfers
- Account balances (stored as ciphertexts on-chain)

**What is NOT hidden:**
- Sender address (visible on-chain)
- Receiver address (visible on-chain)
- Asset type (visible)
- Transaction timing

### Auditor System

- Global auditor: governance-assigned, applies to all assets unless overridden
- Per-asset auditor: takes precedence over global auditor
- Voluntary auditors: sender can optionally encrypt amounts for additional parties
- Auditor can only decrypt transactions/balances from after their appointment (no retroactive decryption)

### Performance (from AIP-143)

- Client-side proof generation: ~25ms
- Amount decryption: ~0.3-0.5ms
- Balance decryption (BSGS): ~13ms native, 130-260ms browser
- Validator proof verification: ~2ms

## The Gap: UTT vs Deployed Confidential Assets

### What UTT provides that Confidential Assets does NOT:

| Feature | UTT (Paper) | Aptos CA (Deployed) |
|---------|-------------|---------------------|
| Amount hidden | Yes | Yes |
| Sender hidden | Yes | No |
| Receiver hidden | Yes | No |
| Anonymity budgets | Yes (per-month limits) | N/A |
| Decentralized authorities | Yes (threshold crypto) | Partial (auditor only) |
| Anonymous credentials | Yes (PS signatures) | No |

### What would be needed to go from CA to full UTT on Aptos:

1. **Anonymous credentials infrastructure** -- PS signatures, blind issuance, re-randomization. None of this exists in the current Move framework.
2. **Coin-based (UTXO) model** -- UTT uses coin-based transactions where coins are created/consumed, not account-based balances. This is a fundamental architectural change from Aptos's account model.
3. **Threshold bank/registrar** -- UTT requires threshold authorities (bank, registrar, auditor) implemented via BFT. Aptos has DKG infrastructure but would need to add blind signing and anonymous credential issuance.
4. **Privacy-preserving nullifiers** -- To prevent double-spending of anonymous coins without revealing sender identity.
5. **Anonymity budget enforcement** -- Cryptographic mechanism to limit anonymous spending per time period without revealing identity.

### Existing Cryptographic Primitives in aptos-core That Could Support Future Privacy:

- `crates/aptos-crypto/src/elgamal/` -- Generic ElGamal over Curve25519 and BLS12-381
- `crates/aptos-crypto/src/bulletproofs/` -- Range proofs (currently max 64-bit)
- `crates/aptos-dkg/` -- Full DKG infrastructure (PVSS, weighted VUF, range proofs over BLS12-381)
- `aptos-move/framework/aptos-framework/sources/confidential_asset/sigma_protocols/` -- Composable sigma protocol framework in Move

The DKG infrastructure (threshold PVSS, weighted VUF) is the most relevant existing building block for UTT-level privacy, as UTT explicitly requires threshold cryptography for decentralized trust.

## Key Commits

- `3044960` -- Confidential assets v1.1 (March 23, 2026)
- `4243834` -- Enforce allow listing on testnet
- `e77e6a9` -- Governance script to enable APT for confidentiality
- `1422233` -- Confidential asset v1.1.2 minor fixes (April 9, 2026)

## Status (April 2026)

Confidential APT is set to launch on mainnet pending a governance vote. APT is the only asset type enabled at launch (allow-listed). The system provides amount confidentiality only -- it is a stepping stone, not the full UTT vision of invisible/untraceable transactions.
