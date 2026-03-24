# AIP-61: Keyless Accounts

**AIP Number:** 61
**Title:** Keyless accounts
**Author:** Alin Tomescu (alin@aptoslabs.com)
**Status:** Accepted
**Type:** Standard (Core, Framework)
**Created:** 01/04/2024
**Last Call End Date:** 02/15/2024

---

## Summary

Currently, Aptos account security depends on protecting secret keys -- a challenge users frequently fail at through loss or theft. This AIP introduces **keyless accounts** secured through existing OIDC provider accounts (Google, GitHub, Apple) rather than difficult-to-manage secret keys.

The solution leverages three technologies:
1. The unmodified OIDC standard
2. Blockchain applications of OIDC
3. Recent zero-knowledge proof advances for OIDC signatures

Your blockchain account = your OIDC account.

**Critical Warning:** Keyless accounts bind to both the user's OIDC account and a managing application. If that application disappears or loses OIDC registration, account access becomes inaccessible unless recovery paths exist.

## Goals

### User-Friendliness
- Enable blockchain accounts backed by user-friendly OIDC accounts (easy to access, hard to lose)
- Support walletless experiences allowing users to interact with dapps via OIDC without wallet installation
- Enable seamless cross-device account access

### Security
- Keyless accounts should achieve security parity with underlying OIDC accounts
- Provide account recovery if managing applications disappear

### Privacy
- Hide user OIDC account information (email, OAuth sub identifier)
- Prevent OIDC providers from tracking transaction activity
- Ensure accounts across different managing applications remain unlinkable on-chain

### Efficiency
- Wallet/dapp transaction creation: < 1 second
- Validator verification: < 2 milliseconds

### Censorship-Resistance
Validators cannot provide preferential treatment based on managing application identity or user identity

### Decentralization
Systems should not require parties that fundamentally resist decentralization

## Background

### OAuth and OIDC Concepts
The proposal assumes familiarity with:
- OAuth implicit and authorization code grant flows
- OAuth client registration and `client_id`
- JSON Web Tokens (JWTs) with header, payload, and signature components
- Relevant JWT fields (`kid`, `aud`, `sub`, `iss`, `email_verified`, `nonce`, `iat`, `exp`)
- JSON Web Keys (JWKs) published by OIDC providers

### Key Terminology

**OIDC account:** A Web2 account with providers like Google (example: alice@gmail.com)

**Keyless account:** A blockchain account secured by an OIDC account rather than a secret key

**Application-specific keyless accounts:** Accounts bound to both user identity and managing application identity, requiring signed JWT tokens exhibiting both identities

**Zero-knowledge proofs:** ZKP systems allowing provers to convince verifiers of relation satisfaction without revealing private inputs beyond the proof validity

## Motivation

This proposal accomplishes two objectives:
1. Dramatically simplifies user onboarding by enabling OIDC-based account creation
2. Makes account loss extremely difficult since no secret keys require management

Without acceptance, the status quo persists -- secret-key-based account management inhibits adoption among users unfamiliar with cryptographic practices.

## Specification

### Public Keys

A keyless account's public key comprises:
1. **iss_val:** OIDC provider identity (e.g., `https://accounts.google.com`)
2. **addr_idc:** Identity commitment hiding:
   - User identifier (uid_val) from OIDC provider
   - JWT field name storing the identifier (uid_key)
   - Managing application identifier (aud_val) from OAuth registration

The identity commitment formula:
```
addr_idc = H'(uid_key, uid_val, aud_val; r)
```
where H' is a SNARK-friendly hash function and r is a high-entropy pepper.

### Peppers

The pepper (r) serves critical dual functions:
1. **Required for transaction signing** - Knowledge of pepper enables account access
2. **Non-security-critical** - Pepper revelation compromises privacy only, not account security

**Access loss:** Lost peppers cause account inaccessibility
**Privacy loss:** Revealed peppers allow attacker brute-forcing of identity commitment to reveal user and app identity

Since users cannot realistically remember peppers, a **pepper service** assists in pepper derivation and storage (see AIP-81).

### Authentication Keys

Authentication keys derive simply as:
```
auth_key = H(iss_val, addr_idc)
```

### Secret Keys

No additional secret key exists requiring user recording. Instead, the "secret key" constitutes the user's ability to sign into their OIDC account through the committed managing application. The OIDC password and pre-installed HTTP cookies serve as practical equivalents, with one caveat: the managing application must remain available for OAuth access.

### Signatures

Keyless signatures exist in two modes:

#### Leaky Mode Signatures
Leaky signatures reveal user and app identity through plaintext JWT payload and pepper inclusion.

**Signature components:**
- uid_key, jwt, header, epk, sigma_eph, sigma_oidc, exp_date, rho, r, idc_aud_val

**Verification process:**
1. If using email-based IDs, verify email_verified field
2. Extract uid_val from JWT
3. Determine aud_val (from JWT or idc_aud_val)
4. Verify addr_idc calculation matches H'(uid_key, uid_val, aud_val; r)
5. Verify auth_key matches H(iss_val, addr_idc)
6. Verify EPK commitment in JWT nonce
7. Verify EPK expiration not too distant from JWT issued-at time
8. Verify EPK remains non-expired
9. Verify ephemeral signature under EPK
10. Fetch OIDC provider JWK via JWT header kid field
11. Verify OIDC signature under JWK

#### Zero-Knowledge Mode Signatures
Privacy-preserving signatures leak nothing about OIDC accounts or managing application identity.

**Signature components:**
```
sigma_txn = (header, epk, sigma_eph, exp_date, exp_horizon, extra_field,
             override_aud_val, sigma_tw, pi)
```

Where:
- **exp_horizon:** Ensures expiration date lies between jwt["iat"] and jwt["iat"] + exp_horizon
- **extra_field:** Optional publicly-revealed JWT field (user can optionally reveal email)
- **override_aud_val:** Optional recovery service `aud` for account recovery scenarios
- **sigma_tw:** Optional training wheels signature protecting against ZK relation bugs
- **pi:** Zero-knowledge proof of knowledge for relation R

**Verification involves:**
1. Verify auth_key matches H(iss_val, addr_idc)
2. Assert exp_horizon <= max_exp_horizon (on-chain parameter)
3. Verify EPK non-expiration
4. Verify ephemeral signature under EPK
5. Fetch OIDC provider JWK
6. Derive public inputs hash: pih = H_zk(epk, addr_idc, exp_date, exp_horizon, iss_val, extra_field, header, jwk, override_aud_val)
7. If training wheels enabled, verify training wheels signature over ZKP and pih
8. Verify ZKPoK pi

### The Keyless ZK Relation R

The relation R performs privacy-sensitive verification through:

**Public inputs:**
- epk, addr_idc, exp_date, exp_horizon, iss_val, extra_field, header, jwk, override_aud_val

**Private inputs:**
- aud_val, uid_key, uid_val, r, sigma_oidc, jwt, rho

**Verification steps:**
1. Verify public inputs hash derivation
2. Assert iss_val matches jwt["iss"]
3. For email-based IDs, verify email_verified = true
4. Assert uid_val matches jwt[uid_key]
5. Verify addr_idc calculation
6. For normal mode: assert aud_val matches jwt["aud"]
7. For recovery mode: assert override_aud_val matches jwt["aud"]
8. Verify EPK commitment in JWT nonce
9. Verify expiration date horizon
10. If extra_field set, parse and verify presence in JWT
11. Verify OIDC signature under JWK

The ZKP pi reveals nothing about private inputs, achieving complete privacy.

## Reference Implementation

### Groth16 ZKP System Selection

Initial deployment uses Groth16 over BN254 elliptic curves, chosen for:
1. **Smallest proof size:** 128 bytes
2. **Constant verification time:** ~1.5 milliseconds
3. **Fast proving:** ~3.5 seconds with multithreading
4. **Circom implementation ease**
5. **Mature tooling**
6. **Non-malleability capability**

**Drawback:** Relation-specific trusted setup required (MPC ceremony outside this AIP's scope). Future transitions to transparent SNARKs or universal trusted setup systems planned.

### Move Module Configuration

The `aptos_framework::keyless_account` module stores:

1. **Groth16VerificationKey:** 288-byte verification key (alpha_g1, beta_g2, gamma_g2, delta_g2, gamma_abc_g1)

2. **Configuration resource:**
   - override_aud_vals: Vector of recovery service `aud` values
   - max_signatures_per_txn: Transaction signature count limit
   - max_exp_horizon_secs: Maximum EPK expiration distance
   - training_wheels_pubkey: Training wheels public key (optional)
   - max_commited_epk_bytes: EPK length limit (93 bytes)
   - max_iss_val_bytes: JWT `iss` field length limit
   - max_extra_field_bytes: JWT field name/value length limit
   - max_jwt_header_b64_bytes: Base64-encoded JWT header length limit

### Rust Structures

**KeylessPublicKey:**
```
- iss_val: String (OIDC provider identity)
- idc: IdCommitment (user and app identity hash)
```

**KeylessSignature:**
```
- cert: EphemeralCertificate (ZeroKnowledgeSig or OpenIdSig)
- jwt_header_json: String (decoded JWT header)
- exp_date_secs: u64 (ephemeral key expiration)
- ephemeral_pubkey: EphemeralPublicKey (Ed25519 or Secp256r1)
- ephemeral_signature: EphemeralSignature (Ed25519 or WebAuthn)
```

**ZeroKnowledgeSig:**
```
- proof: ZKP
- exp_horizon_secs: u64 (circuit expiration enforcement)
- extra_field: Option<String> (optional publicly-revealed JWT field)
- override_aud_val: Option<String> (recovery service aud)
- training_wheels_signature: Option<EphemeralSignature>
```

**OpenIdSig:**
```
- jwt_sig: Vec<u8> (JWS signature bytes)
- jwt_payload_json: String (decoded JWT payload)
- uid_key: String (user identifier field name)
- epk_blinder: Vec<u8> (EPK nonce obfuscation)
- pepper: Pepper
- idc_aud_val: Option<String> (recovery-mode aud)
```

## Security, Liveness and Privacy Considerations

### Training Wheels

Initial deployment includes optional **training wheels mode** where the prover service signs valid ZKPs. This eliminates the single-point-of-failure risk of ZK relation implementation bugs without granting the prover service account-stealing capabilities.

**Security model:** ZK relation breaks will not cause catastrophic fund loss, but the prover service cannot steal funds without also compromising OIDC accounts.

**Liveness consideration:** Prover service downtime makes accounts inaccessible, but breaches should be brief and acceptable for initial deployment.

### Recovery Service

Since managing applications can disappear through:
- OAuth client_id banning by OIDC provider
- Administrator loss of OAuth client_secret
- Application shutdown without realizing user account consequences

**Recovery mechanism:**
1. User signs into recovery service via OIDC provider
2. Recovery service obtains OIDC signature over its client_id and user sub
3. Recovery service client_id appears in on-chain `aud` override list (via governance)
4. Validators accept this [ZKPoK of an] OIDC signature as valid for any managing application
5. User can authorize key rotation for inaccessible accounts

### Compromised OIDC Account

By design, keyless account security matches OIDC account security. Compromised OIDC accounts enable permanent keyless account compromise (attackers can immediately rotate keys).

### Compromised OIDC Provider

Provider compromise affects all associated keyless accounts. Mitigation: Emergency governance proposal can revoke provider JWKs.

## Future Potential

This approach could onboard billions of users by eliminating mnemonic and secret key management friction.

## Appendix

### JWT Example (Google)

**Header (85 bytes):**
```json
{
  "alg": "RS256",
  "kid": "822838c1c8bf9edcf1f5050662e54bcb1adb5b5f",
  "typ": "JWT"
}
```

**Payload (398 bytes):**
```json
{
  "iss": "https://accounts.google.com",
  "azp": "407408718192.apps.googleusercontent.com",
  "aud": "407408718192.apps.googleusercontent.com",
  "nonce": "15919628789903246873379427733051374218372906955101515791742506401291192372556",
  "sub": "103456789123450987654",
  "email": "alice@gmail.com",
  "email_verified": true,
  "at_hash": "a5z9bu-5jokhN3pmxj2kMg",
  "iat": 1684349149,
  "exp": 1684352749
}
```

### Related AIPs
- **AIP-67:** JWK consensus on validators
- **AIP-75:** ZK proving service design
- **AIP-81:** Pepper service design
