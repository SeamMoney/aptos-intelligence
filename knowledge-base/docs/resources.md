# Move Resources on Aptos

## Overview

On Aptos, on-chain state is organized into resources and modules stored within individual accounts. This differs fundamentally from blockchains like Ethereum, where smart contracts maintain separate storage spaces.

## Resources vs Instances

Move modules define struct definitions that may include abilities like `key` or `store`. Resources are struct instances with the `key` ability stored in global storage or directly in accounts. The `store` ability allows struct instances to be nested within resources.

The APT coin illustrates this distinction:

```move
struct CoinStore<phantom CoinType> has key {
    coin: Coin<CoinType>,
}

struct Coin<phantom CoinType> has store {
    value: u64,
}
```

Coin instances can be extracted from CoinStore with appropriate permissions and transferred to another CoinStore resource, or kept in custom resources like:

```move
struct CustomCoinBox<phantom CoinType> has key {
    coin: Coin<CoinType>,
}
```

## Defining Resources and Objects

All instances and resources are defined within modules at specific addresses. The format `0x1234::coin::CoinStore<0x1234::coin::SomeCoin>` represents:

```move
module 0x1234::coin {
    struct CoinStore<phantom CoinType> has key {
        coin: Coin<CoinType>,
    }

    struct SomeCoin { }
}
```

Here, `0x1234` is the address, `coin` the module, `CoinStore` the storable struct, and `SomeCoin` a supporting struct. Phantom types enable multiple distinct `CoinStore` resources with different `CoinType` parameters.

## Permissions

Permissions are dictated by the module defining the struct. While instances within resources can be accessed or removed, their internal state cannot change without module-level permission. Ownership is signified either by storing resources under accounts or through module logic.

## Viewing and Storage

Resources can be located by searching within owner accounts using their full query path. They are viewable on the Aptos Explorer or fetched directly from fullnode APIs.

The defining module specifies storage rules. Storing data in individual user accounts enables higher execution efficiency and parallel transaction processing across different accounts.
