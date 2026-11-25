# Where to verify host identity, failures, and asynchronous delivery

Use these installed-consumer records when reviewing VO 1221 (identity and callables), 1222 (effects and failures), and 1223 (tasks and iterators). A type declaration or successful compilation does not show what an installed consumer receives. Each link identifies the client and the release route it ran. These are local results, not new hosted promotions.

| Target | Installed consumer evidence |
| --- | --- |
| npm | [Node, Node worker, Chromium, bundled page and module worker](javascript-host-imports-20261124.md#retained-callbacks-with-application-objects): a retained callback carries the actual JavaScript object; a peer sees the same object. |
| PyPI | [CPython wheels](python-worker-wheels-20261124.md): independently packaged components use one registry; closing a binding with a callback pending releases its readers. |
| Cargo | [Rust futures and streams](static-host-workers-20261125.md#installed-rust-futures-and-streams): an installed executable receives the original `Rc` and distinguishes a factory failure from a later task or stream failure. |
| C | [C11 consumer](static-host-workers-20261125.md#installed-c11-workers-on-application-objects): pkg-config and CMake, ordinary and reviewed packages, both peer link orders. |
| C++ | [C++20 consumer](static-host-workers-20261125.md#installed-c20-futures-and-streams-on-application-objects): generated futures and streams, both build systems and link orders. |
| NuGet | [.NET 8 packages](dotnet-worker-packages-20261124.md): two assemblies share the host-class registry; cancellation is scoped to the binding. |
| Maven | [Java and Kotlin](jvm-worker-packages-20261124.md): separate client programs run against relocated Maven packages, including both component load orders. |
| RubyGems | [MRI platform gems](ruby-worker-gems-20261124.md): ordinary and reviewed APIs, independently packaged peer and original Ruby object identity. |
| CPAN | [Perl distributions](perl-worker-packages-20261124.md): threaded and unthreaded Perl 5.36.3 and 5.38.2, with prebuilt and locally compiled generated XS. |
| Native PHP | [Composer client](php-host-task-packages-20261124.md): application objects and closures through Amp futures and `foreach`. |
| PHP-Wasm | [Zend interpreter packages](php-wasm-zend-packages-20261124.md): PHP class identity, pending work and isolation between two interpreters. A JavaScript object test alone does not establish this. |
| WIT/WASI | [Guest-owned objects](wit-host-objects-20261125.md), [copied canonical values](wit-canonical-async-20261124.md) and [pollable task resources](wit-task-resource-world-20261123.md) have different runtime contracts. Evidence for one does not qualify the others. |

## Which installed profiles exercised OS access?

| Profiles | Evidence for VO 1222 |
| --- | --- |
| C, C++, Cargo, PyPI | The [four-target receipt](native-host-effects-20261122.json) covers an environment read during initialization, a synchronous file read, a worker read and an iterator finalizer that writes the file. |
| RubyGems, NuGet, Maven | The [Ruby](ruby-sync-io-20261122.json), [.NET](dotnet-sync-io-20261122.json) and [Java/Kotlin](jvm-sync-io-20261123.json) receipts cover installed synchronous Journal packages. See the per-target records for the exact calls and refusal cases. |
| CPAN, native PHP | [Perl](perl-sync-io-20261123.json) and [PHP](php-sync-io-20261123.json) have separate installed synchronous receipts. The [Perl](../../tests/helpers/perl-io-installed.mjs) and [PHP](../../tests/helpers/php-sync-installed.mjs) build checks remove Journal's filesystem grant and require the producer to refuse the package. |
| npm, PHP-Wasm | [Node and Chromium](javascript-wasm-sync-io-20261123.md) and [the installed Zend extension](php-wasm-installed-sync-io-20261123.md) exercise in-memory IO. The [JS package check](../../tests/helpers/javascript-wasm-io-package-flow.mjs) and [PHP-Wasm compiler check](php-wasm-sync-io-core-20261123.md) separately test undeclared filesystem access. |
| WIT/WASI | The [standalone synchronous profile](wit-sync-io-packages-20261123.md) reads and writes a real file through the native host. The [guest-owned worker profile](wit-host-objects-20261125.md#copied-and-guest-owned-workers-in-one-release) refuses an environment read in a finalizer and refuses an explicit grant. |

Synchronous Journal results do not establish what happens during a pending callback or an iterator's finalizer on the same target.

## Checks before closing the nodes

- **1221:** Match copy, borrow, transfer and anchored leases to the owning type. Verify returned Lean closures separately from host callbacks: the caller, the captured owner and the invocation/disposal rules are different. For examples, see [WIT callable lifetimes](wit-callables-20260919.md) and [closure thread and lifetime checks](closure-thread-lifetime-20260925.md). [Two independently installed synchronous WIT packages](wit-host-objects-20261125.md#two-independently-installed-lean-packages-share-one-guest-object) preserve the defining guest's box across a success, mutation and declared failure. A second defining instance is rejected even if it came from the same component bytes.
- **1222:** Check returned `Except`, immediate factory failure, worker/step failure, original callback exception, malformed boundary input and unexpected trap separately. Then check cleanup on each path. The [native OS-effect receipt](native-host-effects-20261122.json) names C, C++, Cargo and PyPI; do not use it as evidence for a browser, Zend or Wasmtime profile.
- **1223:** Check cancellation before settlement, cancellation while a callback is pending, late results, unconsumed readers, demand and early iterator exit under the actual host scheduler. The [combined WIT install](wit-host-objects-20261125.md#copied-and-guest-owned-workers-in-one-release) covers a guest-owned object future and copied byte futures and cursors on the same binding. It does not establish every cancellation race for callbacks or workers that run in separate Lean packages.
