# Rust primitive callbacks and returned closures

Ordinary-source and independently reviewed Cargo packages each pass 35,890
installed assertions. Each relocated executable repeats those checks after its
crate sources are removed. The [acceptance record](rust-callables-20260919.json)
retains source, consumer, compiler-model, receipt, executable and archive hashes.

## Compiled and installed contract

The independent 60-export fixture applies callbacks once and twice and returns
captured two-argument closures for all nineteen primitives. Additional exports
exercise mixed signatures, multiple callback arguments and expired call borrows.
Lean checks the callback identity lemmas. The reviewed contract comes from an
independent signature fixture, not compiler output.

Each path relocates and verifies its crate and locked Rust dependencies, deletes
the author and build directories, and installs offline. Cargo compiles Rust;
consumers do not compile Lean or native adapters. The executable then runs with
compiler paths disabled. The harness also removes the crate and dependency
sources, relocates the executable and runs it again.

## Checks

- All nineteen primitives cross direct inputs/results, callback arguments/results
  and returned-closure arguments/results. Counters and distinct replacement
  values check execution count and both captured-value branches.
- Tests include fixed-width endpoints, values around 2^31, 2^32 and 2^53,
  5,121-bit integers, subnormal floats, signed zero, infinities, NaN, Unicode,
  embedded NUL and arbitrary bytes. Rust's typed API prevents wrong primitive
  types instead of coercing them.
- Eight separate consumers fail compilation for wrong arguments, wrong callback
  results, borrowed callback text, wrong closure arguments, `Send`, `Sync`,
  `Clone` and async callbacks. Diagnostics must point to the consumer source.
- Callback errors and original boxed panic payloads survive native cleanup.
  The first failure suppresses later callbacks. Nested calls recover from a
  handled failure and from the native 64-call re-entry limit.
- Expired host callback borrows fail after return. Independent threads create
  and use their own closures. Post-fork calls reject before native entry, and
  dropping an inherited closure does not touch inherited native locks.
- Explicit close, repeated close, automatic `Drop`, deferred close and the
  4,096-lease limit restore the broker's original live-identity count.
- Injected errors and panics at every conversion checkpoint in string, bytes,
  bigint, closure creation and closure invocation paths release scratch owners,
  outputs and native leases. Copy-budget exhaustion leaves later calls usable.

Run the installed checks with:

```sh
LEAN_BRIDGE_RUST_CALLABLE_TEST=1 node --test tests/rust-callables.test.mjs
```

Set `LEAN_BRIDGE_CARGO` and `LEAN_BRIDGE_RUSTC` to absolute Rust 1.90 or newer
tool paths if they are not in the repository's pinned toolchain directory.
Local execution uses Rust/Cargo 1.90.0 and glibc floor 2.36. CI retains floor 2.38
and uploads both source-path reports. The existing Rust suite separately checks
nested copied values, unrelated crates, reproducible relocation, shared runtime
loading and failed packaging.

## Ownership and panic handling

Host callbacks use typed `FnMut` functions returning `Result`. Callback arguments
are owned Rust values. Returned `LeanClosure<fn(...) -> T>` values provide
`call`, `close` and `is_closed`; `Drop` releases them automatically. They are
neither `Send`, `Sync` nor `Clone`. The signature parameter describes the API;
it does not expose a callable native function pointer.

Generated trampolines catch unwinding panics and keep their payloads alive until
C returns. The Rust caller then resumes unwinding, so no Rust panic crosses a C
frame. Payloads are not formatted or dropped inside the C call because their
destructors may panic. Rust's [catch_unwind contract](https://doc.rust-lang.org/std/panic/fn.catch_unwind.html)
excludes aborting panics; panic hooks and panic-in-destructor behavior still
follow Rust's normal rules. Out-of-memory aborts cannot run cleanup.

Native copying and Rust scratch each have a 16 MiB accounting budget. Rust
retains callback result buffers until C has copied them. Budgets do not bound
Lean working memory or every Rust allocation. This milestone does not promote
compound callable types, resources, asynchronous operations or other backends.
