# Aptos Staking and Consensus

## Overview

Aptos uses a proof-of-stake consensus mechanism where validators stake utility coins to participate in transaction ordering and execution. Vote weight is proportional to the amount of validator's stake, and validators receive rewards aligned with their participation.

Note: Slashing is not currently implemented on Aptos.

## Staking Architecture: Owner-Operator-Voter Model

The staking system employs three distinct personas to enable secure delegation:

### Owner
- Controls funds designated for staking
- Can add, unlock, or withdraw stakes
- Extends lockup periods
- Changes operators and sets commission percentages
- Receives all rewards

### Operator
- Runs validator nodes on behalf of the owner
- Can only join/leave validator sets
- Rotates consensus keys and updates network addresses
- Cannot move funds without owner capability
- Receives commission deducted from owner rewards

### Voter
- Designated by owner to participate in governance
- Signs governance votes using voter keys

## Validator States

Validators transition through four states:
- **Inactive**: Not tracked in validator set
- **Pending Active**: Awaiting activation at epoch boundary
- **Active**: Currently validating
- **Pending Inactive**: Awaiting removal from set

Stake has parallel granular states: inactive, pending_active, active, pending_inactive.

## Key Staking Rules

1. Voting power changes only at epoch boundaries
2. Consensus keys and network addresses update only at epoch boundaries
3. Pending inactive stakes cannot be withdrawn until lockup expires
4. Active validators cannot fall below minimum required stake

## Validator Requirements and Limits

- **Minimum stake**: 1 million APT tokens
- **Maximum stake**: 50 million APT tokens
- Rewards calculated only on maximum allowed amount if exceeded
- Validators removed from active set if stake drops below minimum

## Automatic Lockup Mechanism

Stakes automatically lock for a fixed governance-determined duration upon joining the validator set. When lockup expires, it automatically renews, allowing continued validation and rewards accrual.

## Validation Workflow

Throughout each epoch, this cycle repeats thousands of times:

1. Deterministic formula selects a leader validator based on reputation and stake
2. Leader proposes block with quorum votes from previous proposal
3. All validators vote on leader's proposal
4. Upon consensus, block finalizes
5. Only leader validator receives rewards

Rewards are given only to the leader validator, not to the voter validators.

## Epoch Mechanics

Aptos mainnet epochs last 7,200 seconds (two hours). At each epoch boundary:

- Pending active validators join active set
- Pending inactive validators leave active set
- Pending active/inactive stakes transition accordingly
- Voting power updates to active stake total
- Lockups automatically renew for continuing validators
- Rewards distribute to prior epoch participants

## Rewards Calculation

**Formula**: `Reward = staked_amount * rewards_rate_per_epoch * (successful_proposals / total_proposals)`

Key characteristics:
- Based on annual percentage yield set by governance
- Compounds as rewards add to staked amount each epoch
- Only leader-validators receive block proposal rewards
- Subject to lockup period constraints

## Stake Withdrawal

Validators can unlock stakes anytime but cannot withdraw until lockup expires (maximum fixed duration). Continued reward accrual occurs during pending withdrawal periods.

## Validator Operations Flow

1. Owner initializes stake pool
2. Owner deposits minimum required stake
3. Operator joins validator set (effective next epoch)
4. Validator proposes blocks and earns rewards
5. Stake auto-locks with automatic renewal
6. Operator can rotate keys between epochs
7. Validator requests unlock (withdrawal at lockup expiration)
8. Validator leaves set or continues participation

## References

- Current on-chain configuration: `staking_config::StakingConfig` at `0x1`
- Implementation: [stake.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/stake.move)
