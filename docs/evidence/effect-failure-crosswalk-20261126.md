# Installed IO and failure evidence

VO #1222 asks what the **caller** receives: an immediate value (including a
returned `Except.error`), a declared failure with its payload, rejection before
Lean runs, an exception from application code, or a terminal fault. The
[baseline](../type-surface.v1.json) distinguishes these contracts from the
task scheduler. A program can recover from a declared error without making
a broken runtime safe to reuse.

Each row points to ordinary-source and reviewed-interface installed results.
The second column concerns synchronous calls; the last column is separate
evidence, sometimes from a different package or execution mode.

| Consumer profiles | Immediate IO, EIO and validation | Callback or retirement evidence |
| --- | --- | --- |
| `c`, `python` | [Journal](native-sync-io-20261122.json): file and counter changes in order; rejected cold input does not initialize the component. A returned string/integer sum is distinct from a thrown one. | [C](c-staged-callback-results-20261125.md) distinguishes a rejected reply from a host failure. [Python](python-staged-callback-results-20261125.md) catches the original host exception. Neither treats a callback failure as an unrecoverable native fault. |
| `cpp`, `rust` | [Standalone and mixed native packages](native-sync-cpp-rust-20261122.json): direct calls do not acquire a dispatcher; actual filesystem errors, thrown owned sums, and the same values returned as data have distinct outcomes. An independently installed peer tests resource-valued errors. | [C++](cpp-retained-tasks-20261122.json) and [Rust](rust-retained-tasks-20261122.json) distinguish application failures from retirement in installed worker clients. [Direct C++ function replies](cpp-staged-callback-results-20261126.md) separately preserve exceptions in synchronous callbacks. |
| `ruby` | [MRI platform gems](ruby-sync-io-20261122.json) distinguish immediate failures and returned values in relocated installs. | [Callback-taking workers](ruby-retained-tasks-20261122.json) distinguish the original propagated Ruby exception from a same-text replacement and exercise poisoned-runtime behavior. |
| `dotnet` | [NuGet](dotnet-sync-io-20261122.json): nested returned/thrown values, explicit retirement, and invalid input before file effects. | [Managed callbacks](dotnet-retained-tasks-20261122.json) exercise a catchable injected fatal exception; this is stronger than the synchronous client's direct retirement request and is not recovery from arbitrary CLR faults. |
| `java`, `kotlin` | [Maven](jvm-sync-io-20261123.json): separate Java and Kotlin clients install and use the same direct IO packages. | [Java retained calls](jvm-retained-tasks-20261123.json) distinguish a fatal linkage error from a recoverable exception. A [separate Kotlin coroutine](kotlin-callback-fault-20261126.md) injects the fault before and after cancellation; both packages refuse further calls. |
| `perl` | [CPAN](perl-sync-io-20261123.json): prebuilt XS, relocated application calls, checked conversion and copied scalar/error values across four interpreter configurations. | [Retained workers](perl-retained-workers-20261123.json) and the [closure retirement check](perl-host-closures-20261125.md) exercise pending and stale callables; explicit broker retirement is not a native crash. |
| `php-native` | [Local Composer packages](php-sync-io-20261123.json): synchronous Journal, both import orders, retirement and modified library refusal under PHP 8.2 and 8.5. | [Retained tasks](php-retained-tasks-20261123.json) and [returned PHP callables](php-host-closures-20261125.md) test application exceptions and disposal independently of the IO suite. |
| `php-wasm` | [Zend IO installs](php-wasm-installed-sync-io-20261123.md) execute the PHP API in the interpreter, not just the surrounding JavaScript ABI. | [Nested callback failures](php-wasm-io-callback-failures-20261123.md) preserve the original PHP and declared error. Malformed replies retire the runtime; the report identifies where each fault was injected. |
| `node-javascript`, `node-typescript`, `browser-javascript`, `browser-react`, `browser-worker` | [Five independent Ledger clients](npm-synchronous-io-delivery-20261126.md) execute the common 45 checks. The TypeScript catch, mounted click handler and module worker actually run. | [Compiled guest trap](javascript-wasm-callback-io-retirement-20261123.md): plain Node and Chromium, a Node worker, and a dedicated browser worker. The parent survives a worker trap. [Typed Node and mounted React](npm-callback-trap-delivery-20261126.md) separately ran both import orders with a caught or rethrown guest trap. |
| `wit-wasi` | [Relocated Wasmtime packages](wit-sync-io-packages-20261123.md) run synchronous Journal on both routes and reject a missing filesystem grant. | A separate world-conforming component traps **after** mutating state: the caller-owned store must be discarded and a peer cannot reuse the runtime. A trap is not transactional rollback. |

## Which immediate errors keep a live resource?

These checks use a Lean-owned resource as the payload of a synchronous
declared error. They exercise a different contract from returning copied
bytes, throwing an application exception, or cancelling a pending task.
The consumer source hashes match the linked installation records.

| Installed consumer | What happens after the caller catches the error |
| --- | --- |
| [C++ and Rust](native-sync-cpp-rust-20261122.json) | The [C++](../../tests/fixtures/native-sync-resource/consumer.cpp) and [Rust](../../tests/fixtures/native-sync-resource/consumer.rs) clients check identity, mutate the payload, clone its lease, close the original input, and read 44 through the retained lease. Reading the closed input fails. |
| [Python](python-resource-leases-20261123.json), [Ruby](ruby-resource-leases-20261122.json), [.NET](dotnet-resource-leases-20261122.json) | Each client issues a fresh resource containing 13, catches a declared error carrying that resource, and closes the original. A second installed component reads 13 from the error payload. See [Python](../../tests/fixtures/python-task-resources/installed.py), [Ruby](../../tests/fixtures/ruby-task-resources/consumer.rb), and [C#](../../tests/fixtures/dotnet-task-resources/Program.cs). |
| [Native PHP](php-heap-lease-20261123.json) | The [Composer client](../../tests/fixtures/php-io-resources/installed.php) mutates a successful result and reads 11 through the error payload. After other owners close, the observer sees one live identity and one file descriptor above baseline. Dropping the error payload restores both counts. |

These are existing package results, not new runs. They do not establish the
same ownership for an application-created object, a fatal runtime fault, or
another consumer merely because it uses the same backend.

## What still requires a decision or a test?

The [capabilities index](host-worker-qualification-20261125.md#which-installed-profiles-exercised-os-access)
records which profiles permit real OS effects and which refuse to package
them. Do not infer a filesystem grant from an in-memory test. Likewise, a
stale handle, a manually retired runtime, a malformed bridge reply and a
hardware/process fault are not interchangeable. Retain the documented
per-profile policy when inspecting failure branches.

The table identifies installed witnesses, not a release-wide pass count.
The [direct Rust callback clients](rust-staged-callback-results-20261126.md)
separately distinguish a returned host error from a resumed unwind after a
nested allocation. Neither is a reason to retire those installed bindings.
The five npm profiles now each have an installed cross-package trap witness.
For native profiles, check each runtime's fatal policy against the actual
injector: a direct request to retire does not show what initiates retirement.
For non-scalar failures, match the installed payload's owner, lifetime and
error channel to #1221; returning copied bytes is not a test of a live
resource surviving a thrown error. Resolve uncovered combinations and the
#1221 ownership dependency before closing #1222. The exact-release gate
belongs to #1224.
