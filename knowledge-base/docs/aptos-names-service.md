# Aptos Names Service (ANS) -- Comprehensive Reference

## Overview

The Aptos Names Service (ANS) is the official domain name system for the Aptos blockchain, analogous to ENS (Ethereum Name Service). It allows users to register human-readable `.apt` names (e.g., `alice.apt`) that map to on-chain Aptos addresses. ANS supports both top-level domains and subdomains (e.g., `payments.alice.apt`), primary name (reverse lookup) resolution, and name transfers.

ANS is developed and maintained by **Aptos Labs** and is deployed on mainnet and testnet. The smart contracts are written in **Move** and rely on the Aptos Framework for token creation, coin transfers, and object management.

**Key Properties:**
- Domain suffix: `.apt`
- Name constraints: 3--63 characters, lowercase Latin letters (a-z), digits (0-9), and hyphens (not at start/end)
- Registration: time-limited (annual), with tiered pricing by name length
- Subdomains: free to create by domain owner, with configurable expiration policies
- Primary name: reverse lookup mapping an address to a single canonical name
- Represented as NFTs (Token v1 in ANS v1, Token Objects in ANS v2)

---

## Architecture

### Repository Structure

The sole contracts repository is `aptos-labs/aptos-names-contracts` (65 stars, Move, active). The repo contains these Move packages:

| Package | Module(s) | Purpose |
|---------|-----------|---------|
| **core** (`aptos_names`) | `domains`, `config`, `price_model`, `token_helper`, `time_helper`, `utf8_utils`, `verify` | ANS v1 contracts -- domain/subdomain registration, name resolution, reverse lookup, NFT minting via Token v1 |
| **core_v2** (`aptos_names_v2_1`) | `v2_1_domains`, `v2_1_config`, `v2_1_price_model`, `v2_1_string_validator`, `v2_1_token_helper` | ANS v2 contracts -- reimplemented using Token Objects (aptos_token_objects), with renewal, subdomain expiration policies, and improved architecture |
| **router** (`router`) | `router` | Unified entry point that routes calls to v1 or v2 depending on mode; handles v1-to-v2 migration |
| **bulk** | `bulk` | Bulk operations: migrate, renew, register subdomains in batch |
| **bulk_clear** | script | Bulk clear script |
| **bulk_force_renewal** | script | Bulk force renewal script |
| **bulk_migrate** | script | Bulk migration script |
| **register** | script | Bulk registration/revocation script for admin |
| **distribute** | script | Distribute bulk-registered names to recipients |
| **transfer** | script | Transfer script |

### Core Module Deep-Dive

#### ANS v1 (`core/sources/domains.move`)

**Data Structures:**
- `NameRecordKeyV1` -- composite key: `(subdomain_name: Option<String>, domain_name: String)`
- `NameRecordV1` -- value: `(property_version: u64, expiration_time_sec: u64, target_address: Option<address>)`
- `NameRegistryV1` -- `Table<NameRecordKeyV1, NameRecordV1>` mapping names to records
- `ReverseLookupRegistryV1` -- `Table<address, NameRecordKeyV1>` mapping addresses to primary names

**Key Functions:**
- `register_domain(user, domain_name, num_years)` -- register a domain, pay tiered price
- `register_subdomain(user, subdomain_name, domain_name, expiration_time_sec)` -- register subdomain under owned domain
- `set_name_address(user, subdomain, domain, addr)` -- set target address
- `set_reverse_lookup(user, name_record_key)` -- set primary name
- `clear_reverse_lookup(user)` -- clear primary name
- `force_set_name_address(admin, ...)` -- admin override

**Token Standard:** Aptos Token v1 (collection: "Aptos Names V1")

#### ANS v2 (`core_v2/sources/v2_1_domains.move`)

**Data Structures:**
- `NameRecord` -- stored on the token object: `(domain_name, expiration_time_sec, target_address, transfer_ref, registration_time_sec, extend_ref)`
- `SubdomainExt` -- extension for subdomains: `(subdomain_name, subdomain_expiration_policy)`
- `ReverseRecord` -- `token_addr: Option<address>` stored at user's address
- `DomainObject` -- singleton holding the `ExtendRef` for the ANS app object

**Key Improvements over v1:**
- Uses **Token Objects** (`aptos_token_objects`) instead of Token v1
- Two separate collections: "Aptos Domain Names V2" and "Aptos Subdomain Names V2"
- Linear pricing model (price x years, no exponential scaling)
- Subdomain expiration policies: `MANUAL_SET_EXPIRATION` (0) or `LOOKUP_DOMAIN_EXPIRATION` (1)
- Domain renewal support (up to 6 months before expiration)
- Subdomain transferability control by domain owner
- Re-registration grace period (30 days)
- Subdomains are free (price = 0)
- Named objects for deterministic token addresses

**Key Functions:**
- `register_domain(router_signer, user, domain_name, duration_secs)` -- router-gated domain registration
- `register_subdomain(router_signer, user, domain, subdomain, expiration_time_sec)` -- subdomain registration
- `renew_domain(user, domain_name, renewal_duration_secs)` -- extend domain expiration
- `set_target_address(user, domain, subdomain, addr)` -- set resolution target
- `set_reverse_lookup(user, subdomain, domain)` -- set primary name
- `set_subdomain_expiration_policy(user, domain, subdomain, policy)` -- configure subdomain renewal behavior
- `set_subdomain_transferability_as_domain_owner(...)` -- toggle subdomain transferability
- `transfer_subdomain_owner(...)` -- domain owner can transfer subdomains
- `register_name_with_router(...)` -- fee-free registration for v1-to-v2 migration

#### Router (`router/sources/router.move`)

The router is the **canonical entry point** for all ANS operations. It supports two modes:

- `MODE_V1` (0): All operations route to v1 contracts only
- `MODE_V1_AND_V2` (1): New registrations go to v2; reads check v2 first, fall back to v1; migration support

**Migration Logic:**
- Users can migrate v1 names to v2 via `migrate_name()`
- Domains that expired before 2024-03-07 (AUTO_RENEWAL_EXPIRATION_CUTOFF_SEC) get 1 free year added
- V1 tokens are "burned" (transferred to router_signer), then re-created in v2
- Domain must be migrated before its subdomains
- Primary name and target address are preserved during migration

**Router Entry Functions:**
- `register_domain`, `register_subdomain` -- registration
- `migrate_name` -- v1 to v2 migration
- `renew_domain` -- renewal
- `set_primary_name`, `clear_primary_name` -- primary name management
- `set_target_addr`, `clear_target_addr` -- address resolution
- `domain_admin_transfer_subdomain` -- domain admin subdomain transfer
- `domain_admin_set_subdomain_transferability` -- toggle subdomain transfer
- `domain_admin_set_subdomain_expiration_policy` -- configure subdomain expiration
- `domain_admin_set_subdomain_expiration` -- set subdomain expiration time

**View Functions:**
- `get_target_addr(domain, subdomain)` -- resolve name to address
- `get_primary_name(user_addr)` -- reverse lookup (address to name)
- `get_expiration(domain, subdomain)` -- get name expiration
- `is_name_owner(owner, domain, subdomain)` -- check ownership
- `get_owner_addr(domain, subdomain)` -- get owner address (v2 only)
- `can_register(domain, subdomain)` -- check availability
- `get_subdomain_expiration_policy(domain, subdomain)` -- get policy

### Pricing Model

**ANS v1 Pricing (per year, exponential scaling):**
| Name Length | Base Price (APT) |
|------------|-----------------|
| 3 chars | 80 APT |
| 4 chars | 40 APT |
| 5 chars | 20 APT |
| 6+ chars | 5 APT |
| Subdomain | 0.2 APT |

Multi-year registrations scale exponentially (year 2 = 110% of year 1, etc.)

**ANS v2 Pricing (per year, linear scaling):**
| Name Length | Annual Price (APT) |
|------------|-------------------|
| 3 chars | 20 APT |
| 4 chars | 10 APT |
| 5 chars | 5 APT |
| 6+ chars | 1 APT |
| Subdomain | Free (0 APT) |

Multi-year pricing is linear (2 years = 2x price).

---

## Repositories

### Primary Repository

| Field | Value |
|-------|-------|
| **Repo** | [aptos-labs/aptos-names-contracts](https://github.com/aptos-labs/aptos-names-contracts) |
| **Language** | Move |
| **Stars** | 65 |
| **Forks** | 29 |
| **Created** | 2022-11-09 |
| **Last Push** | 2026-03-05 |
| **Open Issues** | 5 |
| **Default Branch** | main |
| **Topics** | aptos, blockchain, smart-contracts, web3 |
| **License** | None specified |
| **Branches** | `main` (dev), `mainnet` (production), `testnet` (testnet) |

### Related Repositories in aptos-labs

| Repository | Relevance to ANS |
|-----------|-----------------|
| **aptos-ts-sdk** | Contains `src/api/ans.ts` -- full TypeScript SDK for ANS operations (register, resolve, renew, primary names) |
| **aptos-indexer-processors** | Contains `ans_processor.rs` -- indexes ANS events into 8 PostgreSQL tables (v1 + v2 lookups and primary names) |
| **aptos-wallet-adapter** | Wallets use ANS for displaying primary names instead of raw addresses |
| **aptos-core** | The Aptos Framework that ANS depends on (Token v1, Token Objects, Coin, Object) |
| **create-aptos-dapp** | Scaffolding tool that may include ANS integration patterns |
| **aptos-go-sdk** | Go SDK -- may include ANS resolution |
| **aptos-python-sdk** | Python SDK -- may include ANS resolution |

**Note:** The following repos do NOT exist: `aptos-names`, `aptos-names-indexer`, `aptos-names-service`. All ANS contract code lives in the single `aptos-names-contracts` repo.

---

## Contributors

### GitHub Contributors (by commits to aptos-names-contracts)

| GitHub Handle | Git Name(s) | Contributions | Role |
|--------------|-------------|---------------|------|
| **0xChucky** | 0xChucky, Charles | 43 (primary author) | Core developer, original author |
| **BriungRi** | Brian Li | 7 | Core developer |
| **angieyth** | angieyth, Angie Huang | 6 | Core developer (v2, migration scripts) |
| **gregnazario** | Greg Nazario | 5 | Core developer |
| **0x-j** | 0xaptosj, j | 5 | Core developer (v1 updates, migration) |
| **davidiw** | David Wolinsky | 2 | Contributor |
| **GotenJBZ** | Gerardo Di Giacomo, marco ilardi, Marco Ilardi | 2 | Contributor (security, maintenance) |
| **0xmaayan** | Maayan | 1 | Contributor |

---

## Timeline

### 2022 -- Genesis and V1 Launch

| Date | Milestone |
|------|-----------|
| **2022-11-09** | Repository initialized (`init`) -- first commit by 0xChucky |
| **2022-11-14** | Presubmit tests and CI setup; bug bounty added |
| **2022-12-07** | PR #1 (presubmit) and PR #2 (bug bounty) merged; reverse lookup (primary name) support added |
| **2022-12-08** | Refactored test setup |
| **2022-12-15** | Events added (SetReverseLookup, SetNameAddress, RegisterName) |
| **2022-12-16** | Entry functions added |
| **2022-12-19--20** | Primary name invariant fixes; mainnet framework dependency |

### 2023 -- V1 Maturity and V2 Development

| Date | Milestone |
|------|-----------|
| **2023-01-09--17** | Primary name edge case fixes (PR #4: clear reverse lookup on set, registration, force_set) |
| **2023-01-24** | Legacy entry function compilation fix (PR #8) |
| **2023-01-26--27** | Ownership check improvements; CLI update (PR #10, #11, #12) |
| **2023-02-02** | Clear primary name entry function added (PR #14) |
| **2023-02-09** | Init reverse lookup script (PR #16) |
| **2023-03-20** | Address placeholders in Move.toml (PR #20) |
| **2023-04-17** | Testing experience improvements (PR #21) |
| **2023-09-07** | V1 updates for ANS v2 compatibility (PR #117) -- reverted and restored same day |
| **2023-09-15** | V1 change for v2 compatibility finalized (PR #152) |
| **2023-10-03** | **ANS v2 launched** (PR #23) -- complete rewrite using Token Objects, new pricing, renewal, router, subdomain policies |
| **2023-10-03--04** | Bulk renewal and migration scripts added (PR #176, #178) |
| **2023-10-11** | Bulk subdomain registration added (PR #177) |

### 2024 -- Stabilization and Maintenance

| Date | Milestone |
|------|-----------|
| **2024-03-20** | Dependency cleanup -- mainnet framework everywhere (PR #183) |
| **2024-05-10** | Router fix for post-cutoff period (PR #184) |
| **2024-06-07** | Security: added is_enabled check in v2, ensured time is not 0 (PR #186) |
| **2024-10-02** | Owner check added to get_primary_name (PR #188) |
| **2024-10-08** | SECURITY.md updated (PR #190) |
| **2024-10-09** | Aptos version update (PR #189) |
| **2024-11-13** | Fix subdomain name expiration for primary names (PR #191) |

### 2025 -- Move 2 Migration

| Date | Milestone |
|------|-----------|
| **2025-01-22** | Move-2 syntax fixes (PR #192) -- latest merged PR |

---

## Changelog

### V1 (2022-11-09 to 2023-09-15)

The original ANS implementation built on Aptos Token v1:

- **Domain registration** with tiered pricing (80/40/20/5 APT for 3/4/5/6+ char names)
- **Subdomain registration** at 0.2 APT flat rate
- **Name resolution**: map `name.apt` to an Aptos address
- **Primary name / reverse lookup**: map an address back to a name
- **Admin controls**: enable/disable service, set prices, admin override of name records
- **Captcha verification** support (optional signature-based gating)
- **NFT representation** via Token v1 collection "Aptos Names V1"
- **Max registration**: 2 years at a time
- **Name constraints**: 3--63 characters, lowercase alphanumeric + hyphens

### V2 (2023-10-03 to present)

Complete rewrite with significant improvements:

- **Token Objects** (aptos_token_objects) instead of Token v1 -- deterministic addresses, better composability
- **Two collections**: "Aptos Domain Names V2" (domains) and "Aptos Subdomain Names V2" (subdomains)
- **Linear pricing**: simplified from exponential to linear multi-year pricing
- **Reduced prices**: 20/10/5/1 APT for 3/4/5/6+ char names (down from 80/40/20/5)
- **Free subdomains**: subdomain price reduced from 0.2 APT to 0
- **Domain renewal**: extend registration up to 6 months before expiration
- **Subdomain expiration policies**: manual or auto-follow-domain
- **Subdomain transferability**: domain owner can lock/unlock subdomain transfers
- **Re-registration grace period**: 30 days after expiration before name becomes available
- **Router-based architecture**: unified entry point supporting dual v1/v2 mode
- **V1-to-V2 migration**: automatic migration with optional free year extension for early expiring domains
- **Bulk operations**: batch migrate, renew, register subdomains

### Post-V2 Fixes (2024--2025)

- Router post-cutoff period fix
- Security hardening (is_enabled checks, time validation)
- Primary name ownership verification
- Subdomain expiration fix for primary names
- Move-2 syntax compatibility

---

## Current Status

| Metric | Value |
|--------|-------|
| **Active** | Yes -- repo still receives updates |
| **Last Merged PR** | PR #192, 2025-01-22 |
| **Last Push** | 2026-03-05 |
| **Open Issues** | 5 |
| **Open PRs** | 2 (including PR #194: Update contracts to Move 2) |
| **Current Version** | V2 (v2_1) with router in MODE_V1_AND_V2 |
| **Deployed on** | Aptos Mainnet and Testnet |
| **Bug Bounty** | Active via [HackenProof](https://hackenproof.com/programs/aptos-naming-service-ans) |

---

## Integration Points

### TypeScript SDK (`aptos-ts-sdk`)

The `ANS` class in `src/api/ans.ts` provides complete SDK integration:

**Query Methods:**
- `getOwnerAddress({ name })` -- get domain/subdomain owner
- `getExpiration({ name })` -- get expiration timestamp
- `getTargetAddress({ name })` -- resolve name to address
- `getPrimaryName({ address })` -- reverse lookup
- `getName({ name })` -- full name details from indexer
- `getAccountNames/Domains/Subdomains(args)` -- list names for an account
- `getDomainSubdomains(args)` -- list subdomains of a domain

**Transaction Methods:**
- `setTargetAddress(args)` -- set resolution target
- `clearTargetAddress(args)` -- remove resolution target
- `setPrimaryName(args)` -- set primary name
- `registerName(args)` -- register domain or subdomain
- `renewDomain(args)` -- extend domain registration

### Indexer Processor (`aptos-indexer-processors`)

The `ans_processor.rs` indexes ANS events into PostgreSQL:

**Tables Written:**
- `current_ans_lookup` / `ans_lookup` (v1 historical + current)
- `current_ans_lookup_v2` / `ans_lookup_v2` (v2 historical + current)
- `current_ans_primary_name` / `ans_primary_name` (v1 primary names)
- `current_ans_primary_name_v2` / `ans_primary_name_v2` (v2 primary names)

**Events Processed:**
- `RegisterNameEvent` / `RegisterNameEventV1` -- name registrations
- `RenewNameEvent` -- domain renewals
- `SetReverseLookupEvent` / `SetReverseLookupEventV1` -- primary name changes
- `SetTargetAddressEvent` / `SetNameAddressEventV1` -- address resolution changes

### Wallet Integration

Wallets (via `aptos-wallet-adapter`) display ANS primary names instead of raw addresses, enabling human-readable identification across the Aptos ecosystem.

### On-Chain Resolution

Any Move contract can resolve ANS names by calling the router's view functions:
- `router::get_target_addr(domain, subdomain)` -- resolve name to address
- `router::get_primary_name(addr)` -- get primary name for address
- `router::is_name_owner(addr, domain, subdomain)` -- verify ownership

### Frontend / API

The metadata API endpoint pattern is:
- V1: `https://www.aptosnames.com/api/mainnet/v1/metadata/{name}.apt`
- V2: `https://www.aptosnames.com/api/mainnet/v2/metadata/{name}.apt`

The web interface is hosted at `https://aptosnames.com`.

---

## Dependencies

**Framework Dependencies (all packages):**
- `AptosFramework` (mainnet rev) -- core blockchain primitives
- `AptosToken` (mainnet rev) -- Token v1 (used by core v1)
- `AptosTokenObjects` (mainnet rev) -- Token Objects (used by core v2)

**Inter-package Dependencies:**
- Router depends on both `core` (aptos_names) and `core_v2` (aptos_names_v2_1)
- Bulk depends on Router
- Scripts depend on Core and/or Router

**Named Addresses:**
- `aptos_names` -- v1 contract deployer
- `aptos_names_v2_1` -- v2 contract deployer
- `aptos_names_admin` -- admin address
- `aptos_names_funds` -- fund destination address
- `router_signer` -- router's resource account
- `router` -- router deployer (used in bulk package)
