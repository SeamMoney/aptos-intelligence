# Aptos Events

## Overview

Events are emitted during transaction execution. Each Move module can define and emit its own events. Aptos Move supports two event mechanisms: **module events** (modern, framework release 1.7+) and **EventHandle events** (deprecated legacy mechanism).

## Module Events

Module events are global event streams identified by a struct type. Define event structs using the `#[event]` attribute on Move structs with `drop` and `store` abilities:

```move
/// An example module event struct denotes a coin transfer.
#[event]
struct TransferEvent has drop, store {
    sender: address,
    receiver: address,
    amount: u64
}
```

Create and emit events using:

```move
let event = TransferEvent {
    sender: 0xcafe,
    receiver: 0xface,
    amount: 100
};
0x1::event::emit(event);
```

For API compatibility, module events include `Account Address`, `Creation Number`, and `Sequence Number` fields all set to 0.

## Testing Access

MoveVM cannot read events during production execution (stored in separate event accumulator). However, two native test functions provide access:

```move
#[test_only]
public native fun emitted_events<T: drop + store>(): vector<T>;

#[test_only]
public fun was_event_emitted<T: drop + store>(msg: &T): bool
```

## API Access

Query both module and EventHandle events using the GraphQL API.

## EventHandle Events (Deprecated)

Legacy Libra/Diem-derived event streams identified by globally unique GUIDs with per-event sequence numbers, stored within resources. Access via REST interface endpoints like `Get events by event handle`.

Example query structure: events contain `key`, `sequence_number`, `type`, and `data` fields.

## Migration Strategy

Projects should emit module events alongside existing EventHandle events. EventHandle events cannot be deleted but remain available for systems unable to upgrade.
