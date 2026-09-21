# Installed Rust tagged variants

VO1219 adds named Rust enums to prepared Cargo crates on ordinary-source and
independently reviewed IR paths. Consumers construct and match unit variants or
cases with named payload fields. Calls borrow their inputs and return owned
copied results inside the existing bridge `Result`.

The [machine record](rust-variants-20260921.json) binds independent contracts,
test sources, original archives, installed files and fault probes.

## Representation and ownership

`Signal::Data { count, label }` and `Signal::Marker { value: () }` are distinct
constructors. Empty cases remain distinct even when they carry no payload.
Constructor names use PascalCase and fields use snake_case. Reserved names gain
a trailing underscore; collisions reject before compilation.

The public API exposes no numeric tag, union, pointer or unsafe operation.
Private `repr(C)` tagged unions match the generated C transport. Output conversion
validates the tag before reading its matching union member and ignores inactive
payloads. Generated Lean helpers construct and inspect the actual Lean value;
adapters do not read compiler object offsets or Lean runtime tags.

Inputs can contain all nineteen primitives, copied records, arrays, Lists,
options, results, products and other admitted variants. Results contain
independent owned data. The 32-level type limit and separate Rust/native 16 MiB
conversion budgets remain in force. These budgets do not bound every Rust
allocation or Lean's working memory. Abort cannot run Rust destructors.

## Installed checks

The shared Lean fixture has fourteen exports, seven variants and eighteen
constructors. Each public execution passes 4,936 assertions over 4,274 calls.
Checks cover constructor transitions, 5,121-bit integers, exact fixed/platform
widths, IEEE special values and signed zero, Unicode/NUL, binary buffers, nested
records/containers and independent result storage. Lean independently inspects
all scalar payloads; eighteen changed fields reject. Four threads also make
256 independent calls. Nine budget failures recover with valid subsequent calls.

The author is removed before installation. Consumers install the original crate
offline using an empty Cargo home and a checksummed, locked dependency closure.
Only Rust compilation and linking are available, not Lean or C compilation.
The consumer builds with warnings denied. Eight independent invalid programs
fail for their intended types, missing fields, constructor presence, fixed-width
overflow, incomplete match or private runtime access.

Each consumer executes once after installation and twice after relocation and
removal of installed sources, archive handoff and dependency files. Embedded
library hashes are checked by the loader; the receipt retains all four native
library identities. Installed package files remain unchanged. Normal exits
leave no additional Rust loader registry or extraction directories.

An independent rebuild reproduced both original crates and every installed
package file byte for byte.

## Failure probes

A separate instrumented copy of the installed Rust adapter injects errors and
unwinding panics at all 104 conversion/allocation checkpoints across nine calls,
for 208 failed calls. Each releases all tracked scratch owners and invokes the
native output clear exactly once. Valid calls then succeed. This checks scoped
ownership and output cleanup; it is not a general Rust heap leak measurement.

Seven invalid tags reject before poisoned union bytes are read. Six multi-case
variants convert their first constructor without reading poisoned inactive
storage. The single-case enum has no inactive constructor to probe. Instrumented
sources are restored and checked against the installed receipt before removal.

Each build also runs the shared real-Lean native fault probe: 1,182 assertions,
242 allocation failures, seventy invalid inputs and one injected returned tag.
ASan and UBSan report no errors. The full LSan report matches the executable's
startup-only GMP baseline of 128 bytes in twelve allocations. No additional
conversion leaks are reported; the runtime exit baseline is not empty.

## Reproduce

Use the [Rust author toolchain](../publish/cargo.md#build-an-ordinary-lean-project),
Rust 1.90.0 and a native compiler with ASan/UBSan. The author stage prepares the
pinned Cargo dependencies; all consumer builds run offline.

```sh
source scripts/env.sh
LEAN_BRIDGE_RUST_VARIANT_TEST=1 node --test tests/rust-variants.test.mjs
node --test tests/rust-variant-contract.test.mjs tests/rust-variant-evidence.test.mjs
```

CI requires and retains `build/variants/rust.json`. Fixtures remove their
temporary author and consumer directories. No package was published.

## Scope

This record advances six Rust copied variant parameter/result/field cells.
Eight consumer profiles still need copied-variant acceptance. Bounded recursive
copied values, compound callable payloads and explicitly owned identity
aggregates remain open.
