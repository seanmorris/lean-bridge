# Rust recursive values and native conversions

Rust has owned value declarations and bounded conversions for the finite native
graph model. The generated helpers connect to the compiler-checked Lean/C
boundary. Cargo package admission remains closed for recursive exports until
prepared-crate installation and source-free execution pass.

## Values

Records become named structs and variants become named enums with constructor
fields. Arrays and Lists use `Vec`, options use `Option`, results use `Result`,
and binary products keep their tuple nesting. Concrete aliases keep their names.
`None`, `Some(None)` and `Some(Some(()))` remain distinct.

Cycle-closing and oversized fields use `Box`. A recursive optional child has
type `Option<Box<Link>>`; its containing `Option` needs no extra box. `Vec`
already supplies indirection for recursive sequences. Cloning produces
independent owned values, without reference-counted identities or Lean handles.
`Nat` and `Int` use `num_bigint::BigUint` and `BigInt`.

Private C layouts keep Bool and Unit as bytes and Char as `u32` until validation.
The decoder checks constructor tags, option/result flags, UTF-8, Unicode
scalars, integer signs and span shapes before constructing Rust values.

## Ownership and failure handling

Every input is checked before initialization, view allocation or native calls.
Scoped owners retain temporary integer limbs and container views. Input strings
and byte buffers remain borrowed for the call. A result guard owns the native
root and releases it after copying, including on failure or panic unwinding.
Returned Rust values retain no pointers into native or input storage.
Text inputs borrow `str`; bytes and sequence inputs borrow slices. Callers need
not allocate a `String` or `Vec` merely to satisfy the boundary's parameter type.

Input and output share a 262,144-node limit, maximum depth 128, and 16 MiB of
accounted native copied storage. A separate 16 MiB budget accounts for Rust view
storage and copied host contents. Zero-sized elements still consume budget.
These limits do not bound the Lean algorithm's working memory or every allocator
overhead. Rust allocations that abort the process cannot run cleanup code.

Guarded calls initialize through the shared runtime, retire malformed native
results, and check readiness before publishing output. Invalid inputs, limit
failures and recoverable allocation failures do not retire it. Calls reject
after retirement while earlier owned native results remain clearable.

Native spans must come from the authenticated adapter and reference readable
process memory. Shape and alignment checks do not prove arbitrary addresses
readable. Cleanup uses the native root's private owner, not mutable child tags.

## Verification

The [recorded results](rust-recursive-conversions-20260923.json) distinguish
isolated conversion tests from fresh Lean execution. The isolated suite compiles
Rust with warnings as errors and independently compiles the C boundary fixture.
It checks all raw sizes, alignments and field offsets, malformed outputs, node
and byte limits, and cleanup at every tested allocation and unwind checkpoint.
Separate negative callers verify that invalid Rust values fail to compile.
Six Rust value tests and eight conversion tests pass, with five rejected callers,
478 C/Rust layout checks and 159 allocation/unwind checkpoints.

The Lean-backed suite builds ordinary source and an independently authored
reviewed contract. A Lean predicate independently checks all nineteen scalar
fields. Other exports exercise 1,001-bit integers, direct and mutual recursion,
Lists, arrays, aliases, nested options/results, empty records, Unit constructors,
255-field recursive constructors, independent copies, and a result that exceeds
the depth limit. Every tested native-arena and Rust conversion allocation can
fail without leaking owners. Three fresh processes check malformed Lean
carriers, malformed native tags, and retirement before result publication.
Each process passes 784 checks, including failures at 26 native allocation sites
and 70 Rust conversion checkpoints. Both source paths produce the same native
component binary as the preceding C/C++ installed-package milestone.

```sh
source scripts/env.sh
LEAN_BRIDGE_RUST_GRAPH_TEST=1 LEAN_BRIDGE_RUST_GRAPH_NATIVE_TEST=1 \
  node --test tests/rust-copied-graph-values.test.mjs \
  tests/rust-copied-graph-conversions.test.mjs
```

CI runs both suites and retains their reports. Prepared Cargo archives,
automatic asset loading, relocated installations and compiler-free deployment
still need integration and acceptance. This milestone does not promote Rust's
installed recursive coverage or publish a crate.
