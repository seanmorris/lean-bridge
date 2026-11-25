# C, C++ and Rust worker object contracts

The [source acceptance test](../../tests/helpers/static-worker-elaboration.mjs) compiled a Lake application against each owner's generated Lean module. The [worker code](../../tests/fixtures/static-host-workers/Jobs.lean) returns an object through a task, passes it to and from a retained owner callback, returns it as data, throws it as a declared error, and yields or rejects it from a cursor. The callback runs synchronously on its owner; the Lean export still returns a task.

For each language, ordinary source and the independently reviewed binding IR produced the same public API. Both indirect member calls—the task body calling a helper that reads the host object, and a cursor pull doing the same—were rejected during compilation. A foreign scheduler, wrong owner, missing owner marker and attempted reuse as a JavaScript worker were also rejected. The check verifies the callback's argument and result types, the leased task result, and the identity of the declared task and cursor error payloads.

| Owner | Canonical public binding IR SHA-256 |
| --- | --- |
| C | `d03889a5d4c13bcf9fce1840b4980a5ecf653c0763da289eb89199943008d599` |
| C++ | `a7ac190fad523b5d789db1d5f4867f9a3a87f2e97f5cc77d6fb2904e23dc58ba` |
| Rust | `8c453f0226147ed6635d24c03361886ea0cfffe400aa679a2cce6e7995f3e057` |

Run `node --test --test-concurrency=1 tests/helpers/static-worker-elaboration.mjs` with the pinned Lean toolchain. These are source and effect checks, not evidence of an installed consumer running a host-object worker.

## Native compilation and Rust object round trip

The [component test](../../tests/helpers/static-worker-components.mjs) built the real Lean application, callback and cursor adapters, scoped task leases and each native owner domain. It checked the exact exported symbol set and dynamic dependencies. All three linked the same lease library (SHA-256 `39f751ace1626f07fe8ef74b757428d6c4fc7e7b87739ab252107122d2018381`). The pre-existing CLR worker path also passed ordinary and reviewed compilation with the shared build helper.

| Owner | Exported symbols | Compiled component SHA-256 |
| --- | ---: | --- |
| C | 55 | `cf8ec9dddaaf5d6ed705c06503f19c374766e1ba0ae73b5269dc880b99f90412` |
| C++ | 60 | `2d760a30a7f83e8a11e2ebc5028a324e4716874bc54291bfd0520a76184c23e5` |
| Rust | 39 | `a758c86133685b83ffbb59eab1d9856dd0248a811499a867b55b23cb527c160c` |

The [Rust executable](../../tests/fixtures/static-host-workers/scope.rs) used the real Rust owner registry and an application `Rc<Meter>`. It passed that object to the compiled Lean `Jobs.echo` task, waited for readiness, and recovered the *same allocation*. An out-of-scope call before open could not claim the runtime. A foreign owner, another thread, a nested scope trying to resolve its parent's token, and reuse of a released token were all rejected. Closing a second, untaken task and the binding returned the object's strong-reference count to one.

Run `npm run test:static-host-worker-components` for these checks. The Rust executable uses the private native ABI. A public, installed Rust future/stream API for host objects, retained-callback execution and cancellation races still need downstream tests. The C and C++ entries above are compilation results, not application execution.
