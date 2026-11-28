# Returning a Lean function from a Rust callback

The installed Cargo API distinguishes a scalar callback reply from a leased
Lean function. With the [staged contract](../../tests/fixtures/structured-types/tariff-staged-contract.json),
Rust receives the first argument and supplies a function. Lean applies that
function to the second argument. The recovery function is required by the
callback signature; a failure must not return it as a successful answer.

| Author input | Cargo package | Installed client and observer |
| --- | --- | --- |
| Ordinary Lean project with selected exports | [Package receipt](rust-staged-callback-results-20261126/ordinary.package-set.json) | [Execution record](rust-staged-callback-results-20261126/ordinary.execution.json) |
| Separately reviewed Binding IR, with no export list | [Package receipt](rust-staged-callback-results-20261126/reviewed.package-set.json) | [Execution record](rust-staged-callback-results-20261126/reviewed.execution.json) |

The [consumer](../../tests/fixtures/structured-types/tariff-staged.rs) calls
only generated public Rust APIs:

- A flat callback multiplies 9 by 3. A staged callback returns a fresh
  function and gets 93; returning a clone of a caller-owned function gets
  703 and leaves the caller's copy usable.
- A closed recovery function is rejected before entering Rust. A closed
  reply is rejected after one callback entry; the next valid call succeeds.
  Missing recovery and returning a scalar instead of a function are compile
  errors checked in separate downstream programs.
- After allocating and calling another function, the callback returns a Rust
  error. The caller gets the original string allocation, not a copy. A
  separate callback unwinds; the outer Rust caller catches the original
  panic payload, identified by its shared pointer. This tests unwinding
  panics, not a process built with `panic=abort`.

The [separate observer](../../tests/fixtures/structured-types/tariff-rust-probe.rs)
runs the same program and reads the native broker. It first obtains and
calls a known live function, samples the count while holding it, drops it
and checks for zero. It takes another sample after each of the seven cases
and after the owner thread exits. Both routes measured **3 while held** and
**0 at all eight checkpoints**. Rust's session cache
holds a weak pointer, so an idle owner thread need not pin a session. The
ordinary consumer needs no broker API. Both executables run again after
relocation with their Cargo project, vendored sources, and package handoff
removed.

To run the two Lean producers and downstream clients, use
`npm run test:rust-staged-callbacks` with the native Lean and Rust toolchains
and the locked Cargo dependencies in the author cache. To replay installed
clients without recompiling Lean, retain both package sets with
`LEAN_BRIDGE_RUST_TARIFF_KEEP=/new/directory` on a producer run, then set
`LEAN_BRIDGE_RUST_TARIFF_REPLAY` to that directory on the next run. Each
consumer compiles against its own vendored dependencies offline.

## A Rust record owns its function field

The [field client](../../tests/fixtures/structured-types/tariff-fields.rs)
clones a tariff, closes the original function and invokes the clone. It also
constructs a tariff from an owned function, echoes it through compiled Lean
and drops the input before invoking the result. Extracting the function or
repacking it from a clone likewise preserves its captured price.

A host `FnMut` is different. Passing it to `pack_quote` does not make the
borrow durable: calling the returned field directly or through Lean yields
`Error::CallbackFailed` without entering the host function. A closed field
is refused as input and the next valid record succeeds.

The [ordinary](rust-staged-callback-results-20261126/ordinary.fields.json)
and [reviewed](rust-staged-callback-results-20261126/reviewed.fields.json)
offline installs ran after relocating the binary and removing the crate,
feed and sources. The observer first saw three live identities for a known
live function, then zero after each of the seven cases and thread exit.
