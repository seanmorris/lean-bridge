# Where to verify host identity, failures, and asynchronous delivery

Use these installed-consumer records when reviewing VO 1221 (identity and callables), 1222 (effects and failures), and 1223 (tasks and iterators). A type declaration or successful compilation does not show what an installed consumer receives. Each link identifies the client and the release route it ran. These are local results, not new hosted promotions.

| Target | Installed consumer evidence |
| --- | --- |
| npm | [Retained callbacks](javascript-host-imports-20261124.md#retained-callbacks-with-application-objects) and [returned Lean functions](npm-host-closures-20261125.md) preserve the original application object in Node, Chromium and their workers. Canceling one binding's pending callback does not revoke its sibling's functions. |
| PyPI | [CPython workers](python-worker-wheels-20261124.md) share a registry between packages. [Returned Lean closures](python-host-closures-20261125.md) separately check captured Python object identity, self-close, foreign threads and expired binding contexts. |
| Cargo | [Rust futures and streams](static-host-workers-20261125.md#installed-rust-futures-and-streams): an installed executable receives the original `Rc` and distinguishes a factory failure from a later task or stream failure. [Returned Lean functions](rust-host-closures-20261125.md) preserve the application object and error, allow an active call to finish after owner disposal, and release captures after a panic. |
| C | The [C11 worker client](static-host-workers-20261125.md#installed-c11-workers-on-application-objects) tests both build systems and peer link orders. [Returned C callables](c-host-closures-20261125.md) check original object identity, stale aliases, independent bindings, self-drop and destructor counts after failure. |
| C++ | [C++20 consumer](static-host-workers-20261125.md#installed-c20-futures-and-streams-on-application-objects): generated futures and streams, both build systems and link orders. [Move-only returned functions](cpp-host-closures-20261125.md) preserve shared pointers and exceptions, finish an in-flight call on self-close, and release captures on the owner thread. |
| NuGet | [.NET 8 packages](dotnet-worker-packages-20261124.md): two assemblies share the host-class registry. [Returned C# callables](dotnet-host-closures-20261125.md) retain the original application object, release captures on the owner thread, and remain usable in a sibling task callback when another binding closes. |
| Maven | [Java and Kotlin](jvm-worker-packages-20261124.md): separate client programs run against relocated Maven packages, including both component load orders. [Returned functions](jvm-host-closures-20261125.md) keep the original JVM object, propagate checked exceptions through retained callbacks, and release captures after scope loss or runtime retirement. |
| RubyGems | [MRI platform gems](ruby-worker-gems-20261124.md) exercise an independently packaged peer. [Three installed closure configurations](ruby-host-closures-20261125.md) cover captured Ruby objects, original exceptions, self-disposal, fiber ownership and stale Proc conversion. |
| CPAN | [Perl workers](perl-worker-packages-20261124.md) and [installed returned coderefs](perl-host-closures-20261125.md) on threaded and unthreaded Perl 5.36.3 and 5.38.2, with prebuilt and locally compiled generated XS. |
| Native PHP | [Composer client](php-host-task-packages-20261124.md): application objects and callbacks through Amp futures and `foreach`. [Returned Lean functions](php-host-closures-20261125.md) capture the original PHP object and release it after self-close, owner disposal, retirement or a destructor throwing during the factory. |
| PHP-Wasm | [Zend interpreter packages](php-wasm-zend-packages-20261124.md): PHP class identity, pending work and isolation between two interpreters. A JavaScript object test alone does not establish this. |
| WIT/WASI | [Guest-owned objects](wit-host-objects-20261125.md), [copied canonical values](wit-canonical-async-20261124.md) and [pollable task resources](wit-task-resource-world-20261123.md) have different runtime contracts. Evidence for one does not qualify the others. |

### Returned functions that capture application objects

For a signature such as `Box → IO (Box → IO Box)`, C, C++, Cargo, CPAN,
Maven (Java and Kotlin), npm, NuGet, native PHP, PyPI and RubyGems have
installed ordinary, reviewed and worker-package evidence.
Native PHP and PHP-Wasm use the same Lean namespace but different object
owners. Installing a Composer package for native PHP does not test Zend in Wasm.

For **WIT/WASI**, [installed synchronous and worker packages](wit-host-closures-20261125.md)
now exercise captured objects, owned failures and disposal. Two independent
worker packages passed 80 pending-callback cancellation cases. The
[synchronous peer check](wit-host-closures-20261125.md#two-installed-synchronous-packages)
passed all eight route/order combinations. Its graph rejected an object
provider importing the downstream close method; it did not exercise an
active self-close from a guest member.
For **PHP-Wasm**, the [threaded and standalone packages](zend-host-closures-20261125.md)
returned functions that captured a Zend object, including across nested calls
and independent packages. The standalone installs also ran on a Chromium
page without a pthread pool. Receiving a callback from PHP is the opposite direction.

## Which installed profiles exercised OS access?

| Profiles | Evidence for VO 1222 |
| --- | --- |
| C, C++, Cargo, PyPI | The [four-target receipt](native-host-effects-20261122.json) covers an environment read during initialization, a synchronous file read, a worker read and an iterator finalizer that writes the file. |
| RubyGems | In addition to [synchronous Journal](ruby-sync-io-20261122.json), [ordinary and reviewed MRI gems](ruby-worker-gems-20261124.md#file-effects-and-early-iterator-exit) exercise initialization, a real file-backed task, two demands and early finalization on `break`. The missing filesystem grant prevented publication. |
| NuGet | [Two installed .NET 8 clients](dotnet-worker-packages-20261124.md#file-effects-through-task-and-iasyncenumerable) cover environment access, synchronous and Task reads, two iterator demands and a write on early disposal. Removing the filesystem grant prevented publication. |
| Maven | [Four Java/Kotlin clients](jvm-worker-packages-20261124.md#file-effects-on-demand-and-early-stream-cancellation) exercise startup, synchronous and async reads, separate stream demands, and a finalizer write on Java cancellation or Kotlin `take(2)`. Missing filesystem permission prevented publication. |
| CPAN | In addition to [synchronous Journal](perl-sync-io-20261123.json), [eight relocated worker installs](perl-worker-packages-20261124.md#granted-effects-through-a-worker-and-cursor) read the environment and files, observe separate pull demand, and write the file on early close. Omitting the grant refused the worker, pull and finalizer before packaging. |
| Native PHP | [Offline Composer installs](php-host-task-packages-20261124.md#filesystem-access-during-a-task-and-cursor) cover startup, sync IO, Amp tasks, successive cursor reads and early-break finalization on PHP 8.2 and 8.5. Missing filesystem permission and owner-blocking cleanup both prevent publication. |
| npm, PHP-Wasm | [Node and Chromium](javascript-wasm-sync-io-20261123.md) and [the installed Zend extension](php-wasm-installed-sync-io-20261123.md) exercise in-memory IO. The [threaded publisher check](../../tests/helpers/wasm-host-worker-effect-refusals.mjs) builds real npm and Zend worker projects. Each refused an explicit OS grant; without a grant it identified the environment-reading initializer and filesystem operations in the synchronous call, task, pull and close. A separate build rejected `IO.wait` in the finalizer even on an already-resolved promise. All six refusals left no release directory. |
| WIT/WASI | The [standalone synchronous profile](wit-sync-io-packages-20261123.md) reads and writes a real file through the native host. The [guest-owned worker profile](wit-host-objects-20261125.md#copied-and-guest-owned-workers-in-one-release) refuses an environment read in a finalizer and refuses an explicit grant. |

Synchronous Journal results do not establish what happens during a pending callback or an iterator's finalizer on the same target.

To reproduce the two threaded publisher checks, set `LEAN_BRIDGE_TEST_TASK_INPUTS`
and `LEAN_BRIDGE_JS_TASK_INPUTS_SHA256` to the [verified pthread author SDK](../publish/npm.md#build-a-threaded-npm-handoff)
directory and its manifest digest, then run `npm run test:wasm-worker-effect-refusals`.

## Checks before closing the nodes

The [baseline contract](../type-surface.v1.json) distinguishes **17 consumer
profiles** and two author routes. Its unit is a shape at a position on one
profile and route, not a package ecosystem. The acceptance questions below
are in addition to the installed examples above:

| Node | Required positions and behavior | What the worker examples cannot establish |
| --- | --- | --- |
| 1221 | Resource, host object, host callback and returned closure, each as a parameter, result, field, callback parameter and callback result (680 cells). | Returning a closure from a factory does not exercise passing it back, storing it in a field, or exchanging it as the argument or result of a callback. Each requires evidence for its own identity and lifetime. |
| 1222 | IO, EIO and named failure contracts at the signature (102 cells). | Receiving a typed worker error does not establish how an immediate call returns an `Except`, preserves the original host exception, or retires a broken runtime. |
| 1223 | Task, cancellation, synchronous iterator and asynchronous iterator at the signature (136 cells). | A host `foreach` or polling wrapper around an asynchronous Lean pull does not qualify a synchronous Lean iterator. |

For **resource fields**, start with the [hosted owned-record acceptance](owned-checked-record-promotion-20261026-aligned.md),
not another build of the same fixture. The [actual Lean record](../../tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean)
has `Claim.holder : Ticket`. Across 17 profiles the full ordinary and reviewed
packages exercise borrowed and transferred claims, leased results, and claims
exchanged with synchronous callables. The standalone result-only packages
do not exercise transfers or callback inputs. These are results for the
archived releases and this concrete resource field. A closure *receiving*
a claim is not a closure *stored inside* a field. Neither it nor a Lean
`Ticket` field establishes ownership of an application-hosted object field.

For **a returned function passed back as an argument**, there is also existing
installed evidence for pure Lean functions on resource-containing records:

- The [Python client](../../tests/fixtures/structured-types/owned-installed-python.py)
  passes a Lean identity function into `callback_record`, into a returned
  higher-order dispatcher, and into `retain_callback`. By contrast, calling
  an escaped, call-borrowed Python lambda is refused. Its SHA-256 matches
  `packages.ordinary.consumerSha256` and `packages.reviewed.consumerSha256` in
  the [Python execution record](owned-python-execution-20260927.json).
- The [native PHP client](../../tests/fixtures/structured-types/owned-installed-php.php)
  passes the Lean function to `retain_callback`, closes the original wrapper
  and still calls the returned function. A similarly returned PHP lambda
  expires. Both routes pin the client as `packages.<route>.sourceSha256` in the
  [native PHP record](owned-php-integration-20260928.json).

These are actual calls to [`retainCallback : (Bundle → Bundle) → Bundle → Bundle`](../../tests/fixtures/onboarding/owned-cpp-composition/Owned.lean).
They do not cover a function capturing an application's host object and
performing IO, or a callable stored in a record. For the latter, the
[`HiddenCallback.callback` fixture](../../tests/fixtures/onboarding/owned-aggregates/Owned.lean)
and its [compiler test](../../tests/owned-aggregate-metadata.test.mjs) distinguish
two cases. Without a retention decision, the compiler still rejects the field.
Naming `Owned.HiddenCallback.callback` in `ownedAggregates.closureFields`
produces an owned record with a leased function field. Its `Bundle → Bundle`
signature borrows the resource-containing argument and leases the result.
This is compiler evidence; it is separate from an installed consumer calling
the field after the original wrapper closes.

The [source configuration](../../src/analyze/export-configuration.mjs) distinguishes
`iterators` from `asyncIterators`. [Lean checks the pull function](../../src/analyze/HostExports.lean)
for an immediate option or a task-backed result, respectively.
[Installed Python wheels](python-sync-iterators-20261125.md) exercise immediate
iteration from ordinary source and a reviewed interface on CPython 3.11 and 3.12.
[Installed C11 libraries](native-sync-iterators-20261125.md#c11) exercise both
routes with a typed handle and a real file-writing finalizer. The separate
[Rust installs](native-sync-iterators-20261125.md#rust) use Rust's standard
`Iterator` and complete without async Cargo features.
The [C++20 installs](native-sync-iterators-20261125.md#c20) exercise a
single-pass range through both CMake and pkg-config, including deferred
destruction on the owning thread and at process exit.
The [MRI gems](native-sync-iterators-20261125.md#ruby) implement ordinary
`Enumerable` iteration with no task runtime; both routes closed on block
exit, application exceptions, collection and shutdown.
Both author routes for [native PHP](native-sync-iterators-20261125.md#native-php)
ran `foreach` on PHP 8.2 and 8.5 without a scheduler. The [Java and Kotlin
clients](native-sync-iterators-20261125.md#java-and-kotlin) separately pulled
items from an installed Maven package on both routes, including independent
leases for a resource item and a declared step error. The [threaded and
unthreaded Perl clients](native-sync-iterators-20261125.md#perl) exercised
both source routes with no event loop. [Five installed npm clients](javascript-immediate-iterators-20261125.md)
add Node JavaScript, Node TypeScript, browser JavaScript, React, and browser
workers. The [installed .NET client](native-sync-iterators-20261125.md#net)
pulls directly and disposes unread owned items. [PHP-Wasm in Node and
Chromium](php-wasm-immediate-iterators-20261125.md) runs the cursor in Zend
and releases live resources at request shutdown. [WIT/WASI](wit-immediate-iterators-20261125.md)
opens and borrows store-owned resources in real Wasmtime installations. That
gives **17 of 17** locally exercised direct iterator profiles on both source
routes. This count is for synchronous iterators only.

For the WIT/WASI profile, the other three signature families have separate
installed records. The [task and cancellation consumer](wit-task-resource-world-20261123.md#installed-package-receipts)
checks a real parked task, delivery at most once, cancellation before delivery
and refusal of a late result. The [canonical stream consumer](wit-canonical-async-20261124.md#consume-a-compiled-pull-cursor-as-a-stream)
counts actual Lean pulls, including withdrawn demand and early reader drop.
The [two-worker cancellation check](wit-host-objects-20261125.md#two-installed-worker-packages-cancel-one-reader)
adds a live callback and an unaffected sibling. These observations answer
different questions; a synchronous cursor needs none of those schedulers.
The [iterator ABI unit test](../../tests/internal/abi/iterator-adapter.test.mjs)
starts with constructed IR; it cannot stand in for an installed source package
on another profile. Check each profile for one pull per demand, value versus
exhaustion, start versus step failure, early exit, and exactly-once cleanup.

- **1221:** Match copy, borrow, transfer and anchored leases to the owning type. Verify returned Lean closures separately from host callbacks: the caller, the captured owner and the invocation/disposal rules are different. For examples, see [WIT callable lifetimes](wit-callables-20260919.md) and [closure thread and lifetime checks](closure-thread-lifetime-20260925.md). [Two independently installed synchronous WIT packages](wit-host-objects-20261125.md#two-independently-installed-lean-packages-share-one-guest-object) preserve the defining guest's box across a success, mutation and declared failure. A second defining instance is rejected even if it came from the same component bytes.
- **1222:** Check returned `Except`, immediate factory failure, worker/step failure, original callback exception, malformed boundary input and unexpected trap separately. The [two installed WIT workers](wit-host-objects-20261125.md#two-installed-worker-packages-cancel-one-reader) preserve an owned exception across nested calls, a retained callback and future settlement; the defining guest records exactly one destruction. The separate process-trap control does not establish destructor counts on a terminal trap. The [native OS-effect receipt](native-host-effects-20261122.json) names C, C++, Cargo and PyPI; do not use it as evidence for a browser, Zend or Wasmtime profile.
- **1223:** Check cancellation before settlement, cancellation while a callback is pending, late results, unconsumed readers, demand and early iterator exit under the actual host scheduler. The [combined WIT install](wit-host-objects-20261125.md#copied-and-guest-owned-workers-in-one-release) covers a guest-owned object future and copied byte futures and cursors on the same binding. The [two-package cancellation test](wit-host-objects-20261125.md#two-installed-worker-packages-cancel-one-reader) checks a late stream result while a sibling package completes its callback future. The [independent registration owners](wit-host-objects-20261125.md#independent-callback-owners-in-installed-worker-packages) each count their own acquisitions, invocations and drops when either package’s read is canceled.
