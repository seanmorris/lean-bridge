# Installed structured Rust callbacks and closures

VO task 1219. Arrays, Lists, options, results, products, acyclic records,
variants and aliases cross Rust callbacks and returned closures on both
ordinary-source and independently reviewed package paths.

The 26-export fixture passes 1,970 public checks per installed path. The tests
cover all variant constructors, nested absent and present options, Unit, empty
containers, domain success/error branches, Unicode and embedded NUL, bytes and
large integers. Eleven incorrect callers fail at their own source locations,
including borrowed callback results, wrong nested option types, asynchronous
callbacks, copying or reusing a moved closure, and Send/Sync violations.

Forty conversion paths exercise 1,448 injected allocation-error and panic
checkpoints per installed path. Rust owners and native closure counts return to
their baselines after every failure. Callback errors retain their identity;
unwinding panics resume after returning from native code. Nested calls, expired
callback borrows, deferred closure cleanup, post-fork rejection and conversion
budgets are also checked.

The adapter retains complete callback result owners whenever nested ABI fields
borrow Rust string or byte storage. Eight direct ownership tests inspect the
retained owners before reading borrowed memory. Deliberately removing retention
makes seven tests fail; the option-of-option-of-Unit case requires no retained
storage. Six existing generated fixture packages remain byte-identical to the
preceding implementation. The separate primitive regression passes 35,890 checks
on each source path.

The installed gate removes author inputs before relocating and installing the
original crate offline. It compiles and runs the exact structured example from
the [consumer guide](../consume/rust.md#structured-callback-values). A final
deployment keeps only the executable, after removing crate sources, dependency
sources and archives. The crate embeds and loads its native libraries.

```sh
LEAN_BRIDGE_RUST_STRUCTURED_CALLABLE_TEST=1 \
  node --test --test-concurrency=1 tests/rust-structured-callables.test.mjs \
  tests/rust-structured-callable-contract.test.mjs
```

The gate writes `build/structured-callables/rust.json`. Primitive regression uses
`LEAN_BRIDGE_RUST_CALLABLE_TEST=1 node --test tests/rust-callables.test.mjs`.

Recursive callable payloads, resource-containing aggregates and the remaining
host projections still need implementation and installed acceptance. This
milestone does not complete task 1219.
