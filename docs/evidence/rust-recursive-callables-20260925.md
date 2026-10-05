# Installed recursive Rust callbacks and closures

Rust packages accept finite recursive copied values in synchronous callbacks and
returned Lean closures on ordinary-source and independently reviewed Binding IR
paths. Each Cargo-only build compiles 33 Lean exports and 18 callback signatures.
The compiler-checked C transport uses the same layout as the C/C++ and Python
packages. Rust retains named aliases and exposes owned enums, structs, vectors
and boxed recursive fields.

## Installed execution

The [execution receipt](rust-recursive-callables-20260925.json) records both
original Cargo archives. The producer is removed before installing each crate
offline with an empty Cargo home and verified vendored dependencies. Rust uses
a link-only host wrapper that rejects C source and compilation options. Consumers
do not need Lean, C source, handwritten native declarations or runtime setup.

Each installation passes:

- 2,349 public checks across nine copied shapes, recursive callbacks, captured
  closures, aliases used only in callback signatures, depth limits, nested calls,
  disposal, identity capacity and recovery after callback errors.
- Twelve invalid consumers with the expected Rust compiler errors, including
  wrong argument and result types, borrowed callback results, asynchronous
  callbacks, moved closures and attempts to clone, send or share a closure.
- 926 injected allocation and panic failures across nine shapes and five call
  paths, with cleanup and closure lifetime checks.
- Nine direct callback-result ownership checks before dereferencing returned
  native pointers, plus malformed-output cleanup and runtime retirement checks.

Removing callback-result retention makes all nine ownership checks fail. Removing
runtime retirement makes its check fail. These probes compile a separate copy of
the installed crate; the original installed receipt and files remain unchanged.

The exact [Lean publisher example](../publish/cargo.md#export-recursive-callbacks-and-closures)
compiles in both producers. The exact
[Rust consumer example](../consume/rust.md#recursive-callback-values) compiles and
runs from each installed crate. Each relocated executable repeats its 2,349
checks after removing the producer, installed source trees, package archives and
vendored dependencies.

The previous primitive and acyclic structured callable suites also pass on both
source paths. The copied-value package regression passes offline installation,
composition, relocation and source-free execution checks.

## Ownership and limits

Host callbacks borrow their invocation scope and receive owned copied arguments.
Their returned values remain alive until native copying finishes. Rust catches
callback panics inside the trampoline and resumes unwinding after the native call
returns. Callback errors return after cleanup. A caller-supplied
`Error::InvalidNative` does not retire the runtime; malformed native output does.

Returned `LeanClosure` values own private generation-checked identities and use
`Drop` or explicit `close()`. Their types reject `Clone`, `Send` and `Sync`.
Closures validate their creating process and thread lifetime. Disposal during an
active call defers native release until the invocation finishes.

The accepted profile is Linux x86-64 with the pinned Rust 1.90 toolchain. Values
have 128 conversion levels, 262,144 visited nodes and separate 16 MiB native and
Rust conversion budgets. Native reentry allows 64 active calls. Closures share
4,096 identity slots. Rust allocator aborts remain process failures.

Nested callable identities, resource-containing aggregates, asynchronous delivery
and post-fork calls remain unsupported by this copied-value profile.

## Inventory and reproduction

The [integration receipt](rust-recursive-callable-integration-20260925.json)
records the source transition from `172baa67067a549454fb79449d205f939474e58b`.
Inventory 0.100.0 adds exactly four Rust recursive callback cells, taking installed
coverage from 4,794 to 4,798 of 6,562 cells. Earlier receipts remain unchanged.

```sh
LEAN_BRIDGE_RUST_RECURSIVE_CALLABLE_TEST=1 \
  node --test tests/rust-recursive-callables.test.mjs
node --test tests/rust-recursive-callable-contract.test.mjs
node --test tests/rust-recursive-callable-evidence.test.mjs
```

Use the [Rust test prerequisites](../contributing/testing.md#recursive-rust-callbacks-and-closures).
CI requires and uploads `build/recursive-callables/rust.json`.
