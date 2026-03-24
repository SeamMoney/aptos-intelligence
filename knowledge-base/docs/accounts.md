# Aptos Accounts

## Overview

An account on Aptos controls a set of on-chain assets, including tokens and NFTs, represented through Move language resources. Each account uses a 32-byte address for identification, with optional human-readable `.apt` domain registration via Aptos Name Service.

Unlike implicit account systems on other blockchains, Aptos implements explicit accounts backed by on-chain resources enabling key rotation and native multisig capabilities. With Stateless Accounts (AIP-115), new addresses can submit sponsored transactions without prior on-chain registration.

### Account Features

- **Key rotation**: Authentication keys can be updated to use different private keys
- **Native multisig**: Support for k-of-n multisig using Ed25519 and Secp256k1 ECDSA schemes

### Account Types

1. **Standard account** - typical address with public/private key pair
2. **Resource account** - autonomous account without private key, used for on-chain resource/module storage
3. **Object** - complex resource sets within single address representing unified entities

## Account Address

Aptos standardizes addresses as 32-byte hex strings. Shorter strings pad with leading zeroes (e.g., `0x1` becomes `0x0000000000000...01`). Most applications remove leading zeros only for special addresses `0x0` through `0xa`.

## Creating an Account

Account creation involves:

1. Select authentication scheme (Ed25519 or Secp256k1 ECDSA)
2. Generate private/public key pair
3. Combine public key with scheme identifier to create 32-byte authentication key and account address

With Stateless Accounts (AIP-115), you no longer need to create an account on-chain before transaction submission. New users can submit sponsored transactions from freshly generated addresses immediately.

## Account Sequence Number

The sequence number for an account indicates the number of transactions that have been submitted and committed on-chain from that account.

Processing requirements:
- Each transaction must contain unique sequence number for sender
- Blockchain processes only if transaction sequence number equals or exceeds current on-chain number
- Contiguous sequence enforcement prevents replay attacks and guarantees ordering

**Multi-agent transactions**: Only primary signer's sequence number increments; secondary signers' numbers remain unchanged.

**Orderless alternative**: Aptos supports orderless transactions using unique nonces instead of sequence numbers, enabling parallel submissions without coordination (AIP-123).

## Authentication Key

Initial account address equals derived authentication key. The key may change through rotation, but the account address remains permanent.

### Ed25519 Authentication

Process:
1. Generate keypair (`privkey_A`, `pubkey_A`) using PureEdDSA over Ed25519 curve (RFC 8032)
2. Derive authentication key: `auth_key = sha3-256(pubkey_A | 0x00)`
   - `0x00` represents single-signature scheme identifier
3. Use authentication key as permanent account address

### MultiEd25519 Authentication

For K-of-N multisig (N total signers, K required signatures):

1. Generate N ed25519 public keys `p_1`, ..., `p_n`
2. Decide threshold value K
3. Derive authentication key: `auth_key = sha3-256(p_1 | ... | p_n | K | 0x01)`
   - `0x01` represents multisig scheme identifier
4. Use as permanent account address

### Generalized Authentication

Supports Ed25519 and Secp256k1 ECDSA with scheme values `0x02` (single) and `0x03` (multikey). Each key includes prefix indicating type:

| Key Type | Prefix |
|----------|--------|
| Ed25519 generalized | `0x00` |
| Secp256k1 ECDSA generalized | `0x01` |
| Secp256r1 ECDSA WebAuthn | `0x02` |
| Keyless | `0x03` |

**Single Secp256k1 example**: `auth_key = sha3-256(0x01 | pubkey | 0x02)`

**Multikey example** (1-of-2 with Secp256k1 and Ed25519): `auth_key = sha3-256(0x02 | 0x01 | pubkey_0 | 0x00 | pubkey_1 | 0x01 | 0x03)`

## Rotating Keys

An Account on Aptos can rotate keys so that potentially compromised keys cannot be used to access the accounts via `account::rotate_authentication_key` function.

System integrators can use on-chain mapping (`aptos account lookup-address`) to map effective addresses from current mnemonics to actual account addresses, simplifying key refresh processes.

## State of an Account

Account state comprises code and data:

- **Move modules**: Contain code (type/procedure declarations), no data. Encode rules for updating blockchain global state
- **Move resources**: Contain data, no code. Every resource has type declared in published module

## Access Control with Signers

Transaction senders are represented by signers. When Move functions include `signer` arguments, the VM translates signing account identity into a signer for entry points. Functions without signer arguments have no signer-based access controls.

Example Move implementation:

```move
module Test::Coin {
  struct Coin has key { amount: u64 }

  public fun initialize(account: &signer) {
    move_to(account, Coin { amount: 1000 });
  }

  public fun withdraw(account: &signer, amount: u64): Coin acquires Coin {
    let balance = &mut borrow_global_mut<Coin>(Signer::address_of(account)).amount;
    *balance = *balance - amount;
    Coin { amount }
  }

  public fun deposit(account: address, coin: Coin) acquires Coin {
    let balance = &mut borrow_global_mut<Coin>(account).amount;
    *balance = *balance + coin.amount;
    Coin { amount: _ } = coin;
  }
}
```
