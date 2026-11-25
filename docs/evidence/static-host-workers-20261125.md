# Static host worker object contracts

The [source acceptance test](../../tests/helpers/static-worker-elaboration.mjs) compiled a Lake application against each owner's generated Lean module. The [worker code](../../tests/fixtures/static-host-workers/Jobs.lean) returns an object through a task, passes it to and from a retained owner callback, returns it as data, throws it as a declared error, and yields or rejects it from a cursor. The callback runs synchronously on its owner; the Lean export still returns a task.

For each language, ordinary source and the independently reviewed binding IR produced the same public API. Both indirect member calls—the task body calling a helper that reads the host object, and a cursor pull doing the same—were rejected during compilation. A foreign scheduler, wrong owner, missing owner marker and attempted reuse as a JavaScript worker were also rejected. The check verifies the callback's argument and result types, the leased task result, and the identity of the declared task and cursor error payloads.

| Owner | Canonical public binding IR SHA-256 |
| --- | --- |
| C | `d03889a5d4c13bcf9fce1840b4980a5ecf653c0763da289eb89199943008d599` |
| C++ | `a7ac190fad523b5d789db1d5f4867f9a3a87f2e97f5cc77d6fb2904e23dc58ba` |
| Rust | `8c453f0226147ed6635d24c03361886ea0cfffe400aa679a2cce6e7995f3e057` |
| WIT/WASI | `05d5d67c6a46aa2358c6ffedf69cb9274a7bf373dbd594a89a4919bf9ed27e32` |

Run `node --test --test-concurrency=1 tests/helpers/static-worker-elaboration.mjs` with the pinned Lean toolchain. These are source and effect checks, not evidence of an installed consumer running a host-object worker.

The [WIT/WASI guest integration](wit-host-objects-20261125.md) also runs a real defining guest, a second component importing its resource, and a native Lean worker in Wasmtime.

## Native compilation and Rust object round trip

The [component test](../../tests/helpers/static-worker-components.mjs) built the real Lean application, callback and cursor adapters, scoped task leases and each native owner domain. It checked the exact exported symbol set and dynamic dependencies. All three linked the same lease library (SHA-256 `39f751ace1626f07fe8ef74b757428d6c4fc7e7b87739ab252107122d2018381`). The pre-existing CLR worker path also passed ordinary and reviewed compilation with the shared build helper.

| Owner | Exported symbols | Compiled component SHA-256 |
| --- | ---: | --- |
| C | 55 | `cf8ec9dddaaf5d6ed705c06503f19c374766e1ba0ae73b5269dc880b99f90412` |
| C++ | 60 | `2d760a30a7f83e8a11e2ebc5028a324e4716874bc54291bfd0520a76184c23e5` |
| Rust | 39 | `a758c86133685b83ffbb59eab1d9856dd0248a811499a867b55b23cb527c160c` |

The [Rust executable](../../tests/fixtures/static-host-workers/scope.rs) used the real Rust owner registry and an application `Rc<Meter>`. It passed that object to the compiled Lean `Jobs.echo` task, waited for readiness, and recovered the *same allocation*. An out-of-scope call before open could not claim the runtime. A foreign owner, another thread, a nested scope trying to resolve its parent's token, and reuse of a released token were all rejected. Closing a second, untaken task and the binding returned the object's strong-reference count to one.

Run `npm run test:static-host-worker-components` for these private-ABI checks. The C and C++ entries in the table are compilation results, not application execution.

## Installed Rust futures and streams

The [installed Cargo test](../../tests/helpers/rust-host-packages.mjs) passed for ordinary source and independently reviewed IR. Each consumer linked a second component through the same version of the runtime crate. The test built each executable offline from checksummed crates, removed its client, Cargo registry and build directories, then ran the relocated binary without Lean or Cargo on its path. The [receipt and archive hashes](rust-host-workers-20261125.json) identify both releases and the peer.

The [Rust application](../../tests/fixtures/static-host-workers/consumer.rs) recovered the original `Rc` across a future, a stream and a retained callback. The [effect checks](../../tests/fixtures/static-host-workers/effects.rs) distinguish a factory failure, a task failure, a terminal stream failure, an ordinary returned `Result` and the original callback error. Dropping the last binding from inside its callback released its pending work without closing the peer. In a separate process, a callback panic woke a future parked on a Lean promise in the peer; the test did not rely on a timer or natural task completion.

Run `npm run test:rust-host-worker-packages` to build and test fresh packages. To keep the releases, set `LEAN_BRIDGE_RUST_HOST_HANDOFFS` to an existing directory. To repeat just the consumer checks, set `LEAN_BRIDGE_RUST_WORKER_REPLAY` to the resulting `cargo-host-releases-*` directory and run the same command.

## Installed C11 workers on application objects

The [package test](../../tests/helpers/c-host-packages.mjs) built ordinary and independently reviewed C packages, each tested alongside a separately built peer. A review with the declared task-failure annotation removed was rejected without a receipt. The [eight installed executions](c-host-workers-20261125.json) cover CMake and pkg-config in both link orders on both routes. The package hides the raw task wire, scoped object operations and lease manipulation; the application uses the generated C header.

The [C consumer](../../tests/fixtures/static-host-workers/consumer.c) checks the original object across tasks, cursor items, typed failures and two different callback signatures. It recovers its original callback payload and destructor, releases a rejected provisional owner, revokes a callback during its first invocation, cancels a task from its own callback, and rejects wrong-kind and wrong-thread handles. Closing one binding leaves the peer usable. A malformed callback return retires the runtime and wakes the peer's descriptor for a Lean promise that never resolves. The consumer also round-trips signed scalars, a negative 385-bit integer and bytes with embedded zeros.

Run `npm run test:c-host-worker-packages` with a C11 compiler, CMake, pkg-config and the pinned Lean toolchain. Set `LEAN_BRIDGE_C_HOST_WORKER_HANDOFFS` to an existing directory to keep the three releases. To repeat just the consumer checks, set `LEAN_BRIDGE_C_HOST_WORKER_REPLAY` to the resulting `c-host-releases-*` directory. Consumers do not need the Lean toolchain.

## Installed C++20 futures and streams on application objects

The [C++ consumer](../../tests/fixtures/static-host-workers/consumer.cpp) awaited the same `shared_ptr` in a coroutine, passed two distinct classes through retained callbacks, and caught the original `exception_ptr` after Lean propagated a callback failure. It distinguished factory, task and pull failures from returned `Except` values. It exercised normal stream exhaustion, an overlapping pull, early close, self-revocation, cross-thread cancellation and destruction of the binding from inside a callback. A nonstandard thrown object retired the runtime and woke a coroutine already suspended on a peer's unfulfilled promise.

The [package test](../../tests/helpers/c-host-packages.mjs) verified ordinary and independently reviewed releases, each linked with a separately built peer through pkg-config and CMake in both link orders. All eight installed executions passed with no producer tools on the runtime path. The [receipt and archive hashes](cpp-host-workers-20261125.json) identify the exact packages. Run `npm run test:cpp-host-worker-packages` for the full build and checks. Set `LEAN_BRIDGE_CPP_HOST_WORKER_HANDOFFS` to retain archives, or `LEAN_BRIDGE_CPP_HOST_WORKER_REPLAY` to an existing `cpp-host-releases-*` directory for a consumer-only replay.
