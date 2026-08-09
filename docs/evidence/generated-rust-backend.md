# Generated Rust Backend Evidence

Status: the Alpha Binding IR generates a Rust 2021 crate that compiles without warnings and passes a native consumer test. The runtime used by this test implements the generated typed trait. The real Lean runtime connection remains a later conformance task.

## Backend decision

Rust was selected over C++ for the second high-level POC backend. The host type system represents the Binding IR ownership and lifetime distinctions directly:

| Binding IR rule | Rust projection |
|---|---|
| copied record | owned struct with typed fields |
| explicit resource lease | owned type with `Drop` |
| receiver-anchored borrow | `&self` result |
| declared or boundary failure | `Result<T, Error>` |
| borrowed callback | closure parameter |
| returned callable lease | owned type with `.call(...)` and `Drop` |
| finite generic set | concrete generated functions |

C++ remains useful for distribution and native ecosystem reach. Rust provides stronger POC evidence that the IR carries host-independent ownership semantics.

## Generated crate

`generateRustBindingPackage` emits:

- `Cargo.toml`;
- `src/lib.rs`, the safe public API;
- `src/__runtime.rs`, the hidden per-declaration integration trait;
- package documentation; and
- a manifest tied to the canonical Binding IR SHA-256 hash.

The Alpha value projection is equivalent to:

```rust
pub struct Payload {
    pub enabled: bool,
    pub count: u32,
    pub label: String,
    pub bytes: Vec<u8>,
    pub values: Vec<u32>,
}
```

`Box::new` returns an owned `Box`. `Box::read` borrows the receiver. `Box::identity` returns the same `&Box` after checking the runtime identity. `Drop` releases the runtime value once.

`with_callback` accepts `FnMut(u32) -> Result<u32, Error>`. `make_adder` returns an owned `Transform`. Stable Rust does not allow a generated resource type to implement `Fn`, so `Transform` exposes `.call(value)`. The manifest records `owned-callable-operator` as a capability gap with `call-method` as the projection. Consumers never pass the private identity.

## Executed checks

`tests/rust-generator.test.mjs` writes the crate into a fresh directory and runs Cargo offline with warnings denied. The compiled consumer:

- installs one typed runtime and confirms exactly-once initialization;
- constructs, reads, compares, and drops a `Box`;
- round-trips a `Payload` with native `String` and `Vec` fields;
- passes an ordinary Rust closure;
- receives, calls, and drops a Lean callable projection; and
- checks deterministic resource and callable release.

Generation is deterministic and hash-bound. The audit rejects public dispatcher names and private bridge machinery. Negative fixtures reject Promise delivery and arbitrary-precision integers because this dependency-free POC crate cannot preserve them. Finite generic metadata produces only the concrete Rust functions supported by the component.

## Current boundary

The compiled runtime fixture proves the Rust API shape, ownership behavior, borrow shape, failure convention, generated integration contract, and cleanup. It does not connect that trait to the current Lean Wasm private symbols. Cross-language conformance must connect JavaScript, C, and Rust projections to the same Alpha implementation and compare behavior, identity, cleanup, and failures.
