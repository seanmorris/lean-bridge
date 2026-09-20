# Compiled Rust options, results and products

VO1219 adds `Option`, `Except` and nested binary products to prepared Cargo
crates. Ordinary-source and independently reviewed-IR builds compile the same
64-export Lean fixture. Payloads can use all nineteen primitives, arrays,
acyclic copied records and these constructors within the 32-level type limit.

| Lean | Rust |
| --- | --- |
| `Option T` | `Option<T>` |
| `Except E T` | `Result<T, E>` |
| `A × B` | `(A, B)` |

Compound inputs borrow the container. Returned values own their payloads.
`None`, `Some(None)` and `Some(Some(()))` preserve all nested Unit option states.
`Ok` and `Err` remain distinct for equal payload types. A function returning
Lean `Except E T` exposes `Result<Result<T, E>, Error>`: the outer result reports
bridge failures, while the inner result carries the Lean value. Products retain
their binary nesting instead of becoming flat tuples or arrays.

The adapter reuses the typed Lean constructor and projection helpers from the
[native compound implementation](native-compounds-20260920.md). Private
`repr(C)` structures describe the C boundary, not Lean object offsets. Flags,
pointers, runtime configuration and serialization stay out of the public API.

## Installed validation

```sh
LEAN_BRIDGE_RUST_COMPOUND_TEST=1 node --test tests/rust-compounds.test.mjs
node --test tests/rust-compound-contract.test.mjs
```

The [machine-readable record](rust-compounds-20260920.json) retains exact crate,
receipt, source, compiler model and independent consumer identities. Each source
path passes 5,311 installed consumer checks with Rust 1.90.0. The test relocates
the release, removes the producer workspace and build staging, then installs
offline with locked, vendored Rust dependencies. Cargo compiles Rust consumer
code and links the packaged libraries without Lean or C compilation. Generated
signatures and compiled source types match an independent signature catalog.

Checks cover primitive payloads in every constructor, asymmetric result
branches, nested options, arrays of options/results/products, mixed record
fields, 24 nested Options, exact 5,121-bit integers, IEEE edge values, Unicode/NUL,
byte copies and independent returned storage. Four threads call the installed
runtime with separate scratch storage. Oversized inputs and results fail,
followed by successful calls. The executable repeats all 5,311 checks after
relocation and deletion of its crate, dependency sources and Cargo build tree.

Each path compiles eleven invalid consumers and checks the compiler diagnostic
and source span: wrong option/result payloads, Unit confusion, bare payloads,
missing borrows, wrong tuple arity, array-as-product, flattened nested options,
negative Nat values, conflated domain/bridge results and fixed-width overflow.

Two installed private test functions check malformed output flags and conversion
cleanup. They reject flag values other than zero and one and ignore poisoned
inactive payloads. Across 63 conversion checkpoints, 126 injected allocation
failures and unwinding panics verify that temporary buffers are released, native
output is cleared exactly once, and the next call succeeds. Native allocator
fault coverage remains in the C/C++ compound suite.

Rust conversions and native input/output copying each have a 16 MiB accounting
budget. These limits do not bound all Rust allocation or Lean working memory.
Process abort, including abort-on-panic or allocation abort, cannot run cleanup.
Local acceptance uses Linux x86-64 with glibc floor 2.36; CI builds the supported
2.38-floor crates. No other operating system is claimed by this record.

This milestone promotes 18 Rust profile/path/type/position cells: options,
results and products in inputs, results and fields through both source paths.
Compound callables, lists, aliases with distinct runtime identity, tagged
variants, recursive copied types and resource-containing copies remain outside
this milestone. Other host adapters are not promoted.
