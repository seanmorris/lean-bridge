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

## Checks before closing the nodes

- **1221:** Match copy, borrow, transfer and anchored leases to the owning type. Verify returned Lean closures separately from host callbacks: the caller, the captured owner and the invocation/disposal rules are different. For examples, see [WIT callable lifetimes](wit-callables-20260919.md) and [closure thread and lifetime checks](closure-thread-lifetime-20260925.md). For WIT guest-owned objects, an independently compiled defining guest and consuming guest have been exercised. That does not show that two independently published Lean object packages can share the same guest object.
- **1222:** Check returned `Except`, immediate factory failure, worker/step failure, original callback exception, malformed boundary input and unexpected trap separately. Then check cleanup on each path. The [native OS-effect receipt](native-host-effects-20261122.json) names C, C++, Cargo and PyPI; do not use it as evidence for a browser, Zend or Wasmtime profile.
- **1223:** Check cancellation before settlement, cancellation while a callback is pending, late results, unconsumed readers, demand and early iterator exit under the actual host scheduler. The [combined WIT install](wit-host-objects-20261125.md#copied-and-guest-owned-workers-in-one-release) covers a guest-owned object future and copied byte futures and cursors on the same binding. It does not establish every cancellation race for callbacks or workers that run in separate Lean packages.
