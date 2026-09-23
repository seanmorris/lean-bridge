# Prepared recursive Rust packages

Ordinary Lean projects and independently reviewed contracts produce Cargo crates
with owned recursive Rust values. Public functions borrow aggregates, strings
and slices, pass fixed-width scalars by value and return `Result<T, Error>`.
Named records, enums and aliases use native containers and `Box` at recursive or
oversized fields. Consumers need neither Lean nor handwritten FFI.

The builder authenticates the native graph layout and adapter receipt, compiles
the Rust projection, and reconstructs its sources before deterministic archive
assembly. A Cargo-only build does not produce public C/GMP or C++/Boost packages.
The crate embeds its native libraries, verifies their hashes and loads them
automatically. Compatible crates share a runtime. Forked reuse is rejected.

The existing [checked conversions](rust-recursive-conversions-20260923.md) retain
depth 128, 262,144 visited nodes, a shared 16 MiB native-copy budget and a separate
16 MiB accounted Rust conversion-storage budget. Inputs validate before loading.
RAII releases temporary storage and native outputs on errors or unwinding.
Malformed native results retire the runtime; ordinary copied-value failures do
not. Rust values returned earlier remain independently owned after retirement.

## Installed checks

The [recorded executions](rust-recursive-packages-20260923.json) cover eighteen
exports on both source paths. They include all nineteen primitives, exact
1,001-bit integers, IEEE edge cases, recursive and mutually recursive types,
arrays, Lists, aliases, nested options/results, products, empty and Unit
constructors, a 255-field recursive constructor and an uninhabited type.
Independent safe consumers test copied results and depth-growing output failures.
Invalid callers fail Rust compilation with checked diagnostic codes.

The harness verifies the archive and dependency handoff, removes the author
tree, compiles offline with an empty Cargo cache and a link-only C tool, then
removes the installed source and handoff. Relocated executables run with no
compiler or runtime paths. Separate checks inject Rust allocation and unwind
failures, reject modified assets and re-signed source drift, and exercise shared
loading, fork rejection and retirement with a second installed crate.

```sh
source scripts/env.sh
LEAN_BRIDGE_RUST_GRAPH_TEST=1 LEAN_BRIDGE_RUST_GRAPH_PACKAGE_TEST=1 \
  node --test tests/rust-graph-package.test.mjs
```

CI retains `build/recursive/rust-packages.json`. The
[shared-build regressions](rust-recursive-regressions-20260923.json) preserve the
earlier C/C++, Java/Kotlin and Rust receipts while recording fresh installed
checks against the Cargo admission changes. The non-recursive Rust generator
is unchanged.

Structured callable payloads, explicitly owned resource-containing aggregates
and recursive installed acceptance in the remaining nine profiles still need
implementation. No crate was published to a registry by these checks.
