# C, C++ and Rust worker object contracts

The [source acceptance test](../../tests/helpers/static-worker-elaboration.mjs) compiled a Lake application against each owner's generated Lean module. The [worker code](../../tests/fixtures/static-host-workers/Jobs.lean) returns an object through a task, passes it to and from a retained owner callback, returns it as data, throws it as a declared error, and yields or rejects it from a cursor. The callback runs synchronously on its owner; the Lean export still returns a task.

For each language, ordinary source and the independently reviewed binding IR produced the same public API. Both indirect member calls—the task body calling a helper that reads the host object, and a cursor pull doing the same—were rejected during compilation. A foreign scheduler, wrong owner, missing owner marker and attempted reuse as a JavaScript worker were also rejected. The check verifies the callback's argument and result types, the leased task result, and the identity of the declared task and cursor error payloads.

| Owner | Canonical public binding IR SHA-256 |
| --- | --- |
| C | `d03889a5d4c13bcf9fce1840b4980a5ecf653c0763da289eb89199943008d599` |
| C++ | `a7ac190fad523b5d789db1d5f4867f9a3a87f2e97f5cc77d6fb2904e23dc58ba` |
| Rust | `8c453f0226147ed6635d24c03361886ea0cfffe400aa679a2cce6e7995f3e057` |

Run `node --test --test-concurrency=1 tests/helpers/static-worker-elaboration.mjs` with the pinned Lean toolchain. These are source and effect checks, not evidence of an installed consumer running a host-object worker.
