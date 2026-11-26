# Installed IO and failure evidence

VO #1222 asks what the **caller** receives: an immediate value (including a
returned `Except.error`), a declared failure with its payload, rejection before
Lean runs, an exception from application code, or a terminal fault. The
[baseline](../type-surface.v1.json) distinguishes these contracts from the
task scheduler. A program can recover from a declared error without making
a broken runtime safe to reuse.

**Current installed coverage: 86 of 102** — all 34 immediate IO combinations,
26 typed EIO and 26 named errors. Each combination is one profile on one
authoring route. CPython, Perl, Java and Kotlin still need both
typed contracts verified on both routes.

**CPython check in progress:** An older installed peer accepted the integer
`2` as a true tag inside a native `Except` result. A property setter let
the call continue, and a getter returned `97`. In the [CPython 3.11 replay](python-host-error-policy-20261126/cp311-cp311-linux_x86_64.json),
both freshly installed source routes rejected the malformed tag. Each
direction ran the setter once, skipped the getter, and left the shared
broker retired with zero live identities. The same releases passed the
sole-error-owner test. The CPython 3.12 install is still outstanding;
neither ABI is added to the profile count here.

**Rust:** The [ordinary](rust-host-error-policy-20261126/ordinary.json)
and [reviewed](rust-host-error-policy-20261126/reviewed.json) checks match
the [original Cargo releases](rust-host-packages-20261125.md). Each installed
pair ran in both load orders. The peer updated an application meter from
23 to 42 using only the declared error payload; dropping the last owner
ran its destructor exactly once. The [same client](../../tests/fixtures/rust-host-members/archives.rs)
distinguished an original application error from a mapped Lean error.
A nested host-member panic retired the shared runtime: catching it and
returning a number did not let the outer call succeed or either peer
dispatch again. This is the host-member policy, not the behavior of every
Rust callable adapter.

**Ruby:** An older Workshop/Peer gem pair returned `97` from a synchronous
call after its host caught a terminal worker exception. In the [ordinary](ruby-host-error-policy-20261126/ordinary.error-policy.json)
and [reviewed](ruby-host-error-policy-20261126/reviewed.error-policy.json)
installs, catching that exception now makes the outer call report retirement.
Letting the exception propagate preserves the original Ruby object. The
[installed client](../../tests/fixtures/ruby-host-workers/error-policy.rb)
checked both behaviors in both load orders, distinguished original and mapped
errors, and mutated the declared error's sole payload from 23 to 42 through
the peer. The payload was collected after release; neither component leaked
a host identity. Run `npm run test:ruby-host-workers` to repeat the checks.

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

## Count for synchronous IO

The [baseline](../type-surface.v1.json) names three separate signature
contracts: `io`, `eio`, and `declared-error`. Each applies to 17 consumer
profiles on two author routes. For **`io` alone**, 34 of those 102 total
profile/route/contract combinations have installed results whose client
digests were matched to the source in this checkout:

| Profiles | Both-route records and what the installed clients observed |
| --- | --- |
| C, C++, Rust, Python | All eight [Journal rows](native-sync-cpp-rust-20261122.json) identify their [client sources](../../tests/fixtures/native-sync-io-clients). The callers write and read in order, distinguish a failed file read from a returned value, then make another call. |
| Ruby, .NET, Java, Kotlin | The [gem](ruby-sync-io-20261122.json), [NuGet](dotnet-sync-io-20261122.json) and [Maven](jvm-sync-io-20261123.json) records include the executed clients. Java and Kotlin have separate application results. A missing file produces the generated IO error rather than a promise or a successful string. |
| Perl, native PHP | The [CPAN](perl-sync-io-20261123.json) and [Composer](php-sync-io-20261123.json) reports passed on both package orders. Additional interpreter versions, XS modes and load orders do not count as extra consumer profiles. |
| Five npm profiles | The [Ledger results](npm-synchronous-io-delivery-20261126.md) match both receipt files and all four client source hashes. Each client observed the immediate counter transition, invalid inputs that left state unchanged, a thrown Lean IO error and successful reuse. |
| PHP-Wasm | The installed Ledger client passed in Node and Chromium, using the Composer autoloader and npm-mounted PHP, at startup and on first call. The [two receipts](php-wasm-installed-sync-io-20261123.md#both-author-routes-installed) distinguish the actual ordinary and reviewed source. |
| WIT/WASI | The [Journal replay](wit-sync-io-packages-20261123.md#replay-the-retained-archives) matched the original archive hashes and the exact C sources. Both relocated clients executed the 27 session checks, including real file IO. |

### When the same package also establishes the typed-error contract

For six profiles, installed clients distinguish an `EIO` failure, the
callable's named error payload, validation, and an unexpected runtime trap
on the **same Ledger or Journal release**:

- **Strict TypeScript and mounted React:** The [reconciliation check](../../tests/helpers/npm-effect-contract-reconciliation.mjs)
  verifies the original Ledger archive bytes and joins the [scalar error runs](npm-synchronous-io-delivery-20261126.md)
  to the [two-package trap runs](npm-callback-trap-delivery-20261126.md) by
  receipt on each route. The installed Binding IR labels `Ledger.choose` and
  `RubyIO.nested` as `EIO`, names each declared error, and specifies
  `poison-runtime` for unexpected faults. The 45 checks exercise all
  returned and thrown payload arms, validation, and subsequent healthy calls.
  Four real trap cases per app and route show the different outcome: no
  resumed native callback, and no further calls on the retired heap. To
  repeat the check, set `LEAN_BRIDGE_LEDGER_RELEASE_PAIR` to the directory
  containing the original ordinary and reviewed npm release trees, then run
  `node --test tests/helpers/npm-effect-contract-reconciliation.mjs`.
- **Node JavaScript, Chromium page and dedicated browser worker:** The
  [ordinary](npm-matched-realm-errors-20261126/ordinary.json) and
  [reviewed](npm-matched-realm-errors-20261126/reviewed.json) replays use
  the same Ledger releases, callback component and diagnostic Wasm as the
  typed clients above. Each realm ran the 45 scalar checks and four real
  guest traps (both import orders; callback catches or propagates the trap).
  Every trap prevented native callback completion and barred peer calls.
  The worker's parent stayed usable. A Node worker separately confirmed
  isolation; it is a control, not an additional profile.
- **WIT/WASI:** The [installed Journal consumer](../../tests/fixtures/wit-sync-io/consumer.c)
  independently varies return versus declared failure and the inner error's
  payload arm. Validation leaves the output untouched; a real trap in the
  [custom store](../../tests/fixtures/wit-sync-io/custom.c) instead requires
  discarding it and prevents its peer from reusing the runtime. The same
  two verified Journal archives supplied the bindings for both programs.

The resulting lower bound for #1222 is **58/102 (56%, rounded down)**: 34 immediate
IO, twelve EIO, and twelve named-error signature combinations. These counts are
not estimates of time remaining. In particular, a named error carrying
copied bytes does not establish that an error can be the sole owner of a
live application object. That obligation is tracked below, separately
from the hosted release gate.

### PHP-Wasm: the same Ledger packages on both sides of a fault

The [ordinary](php-wasm-matched-errors-20261126/ordinary.json) and
[reviewed](php-wasm-matched-errors-20261126/reviewed.json) records match
the earlier Ledger scalar runs exactly: the same receipts, runtime,
interface, client sources and eight installed observations on each route.
The [PHP program](../../tests/fixtures/php-wasm-sync-io-probe/callbacks.php)
also used the separately installed Switchboard package. It checked nested
callback ordering, the original exception object, and a declared EIO
exception with its NUL-containing payload across two callback frames.

Three fresh sessions per host then supplied malformed result bytes to
the installed decoder: a pending tag for immediate IO, an invalid sum arm,
and nonzero padding. These were **injected decoder inputs, not guest
machine traps**. In both Node and Chromium, each decoder failure retired
the runtime. The other component and an existing closure refused further
calls, copied error data stayed readable and the live owner count ended at
zero. This does not show that a copied error payload owns an application object.

To rerun, set `LEAN_BRIDGE_PHP_WASM_IO_CALLBACK_PEER` to the Switchboard
handoff with its observer, then run `npm run test:php-wasm-ledger-routes`
with the [Ledger handoffs](php-wasm-installed-sync-io-20261123.md#both-author-routes-installed).
These four additional EIO/named-error combinations bring #1222 to **62/102**:
34 direct IO, 14 typed EIO and 14 named errors.

### .NET: the same NuGet install owns the error and enforces retirement

The [ordinary](dotnet-error-owner-20261126/ordinary.json) and
[reviewed](dotnet-error-owner-20261126/reviewed.json) clients ran in both
load orders against Workshop and an independently built Peer. The installed
interface identifies `Workshop.rejectBox` as an `EIO` with a leased error
payload; the [C# client](../../tests/fixtures/dotnet-host-meter/ErrorOwner.cs)
checks the exception's declaration and the identity of its meter. It disposes
the producing binding and drops the original local reference. The peer reads
23 and updates the meter to 42 through the exception. After the frame holding
the exception returns, a forced collection clears the weak reference while
the peer remains open.

In the same executable, [ordinary returns and validation](../../tests/fixtures/dotnet-host-meter/InstalledScalars.cs)
remain distinct from that failure. A [nested host exception](../../tests/fixtures/dotnet-host-meter/Installed.cs)
retains its identity; a new IO failure does not impersonate it. A deliberately
thrown CLR `OutOfMemoryException` in a peer is fatal even when a setter catches
it: the outer getter does not run, and neither package can continue. This is
fault injection, not exhaustion of the machine's memory.

Run `npm run test:dotnet-host-packages` with the [NuGet toolchains](dotnet-host-imports-20261124.md).
Set `LEAN_BRIDGE_CLR_ERROR_KEEP` to an existing directory to retain both
release pairs, or `LEAN_BRIDGE_CLR_ERROR_REPLAY` to the retained
`handoffs-*` directory to rerun the consumer without rebuilding Lean.
These four combinations bring #1222 to **66/102**: 34 direct IO, 16 typed
EIO and 16 named errors. Nine profiles still need both typed contracts
verified on both routes.

### Native PHP: a caught terminal failure disables both Composer packages

The [ordinary](php-native-error-policy-20261126/ordinary.json) and
[reviewed](php-native-error-policy-20261126/reviewed.json) records match the
original two Composer receipts for each route. Each pair ran in both load
orders on PHP 8.2.35 and 8.5.10. The throwing package's interface declares a
leased application meter as the error payload. After closing that binding and
dropping the original meter, the other package updated it from 23 to 42
through the exception. Releasing the exception ran the destructor once.

In the [fault test](../../tests/fixtures/php-host-members/registry-limit.php),
invalid input, the original nested PHP exception, a mapped Lean failure,
and a replacement IO error were recoverable. Exhausting the reference
counter inside a nested constructor was terminal. Even after the host caught
the overflow and the test restored the counter, neither package could enter a
member again. Each process ended with zero reference tokens.

This qualifies native PHP separately from PHP-Wasm. The installed count is
**70/102**: 34 direct IO, 18 typed EIO and 18 named errors. The eight remaining
profiles are C11, C++, Rust, CPython, Ruby, Perl, Java and Kotlin.

### C and C++: the error outlives the throwing binding

The [C client](../../tests/fixtures/c-host-members/consumer.c) received the
application meter in the typed error slot; the success output stayed
unchanged. The [C++ client](../../tests/fixtures/c-host-members/consumer.cpp)
retained the thrown exception itself. Each dropped the original meter and
closed Workshop. The independent Peer still read 23 and updated the meter
to 42 through the error. Releasing it ran the destructor once, before Peer
closed. Returning `Except.error 17` was a successful call in both languages.

Both clients distinguish a propagated nested host failure from its Lean
replacement. In a separate terminal case, a member reported success without
returning its required object. The calling host caught that failure and
tried to return a valid number. The outer call still failed, and neither
component could make another host call after the defective member was
restored. Validation and ordinary callback failures left both usable.

The [ordinary C](c-host-error-policy-20261126/ordinary.json),
[reviewed C](c-host-error-policy-20261126/reviewed.json),
[ordinary C++](cpp-host-error-policy-20261126/ordinary.json) and
[reviewed C++](cpp-host-error-policy-20261126/reviewed.json) records pin the
original releases, their interfaces and the actual application sources.
Each ran via pkg-config and CMake in both link orders. To reproduce without
a Lean build, run `npm run test:c-host-packages` or
`npm run test:cpp-host-packages` with the corresponding
`LEAN_BRIDGE_C_HOST_REPLAY` or `LEAN_BRIDGE_CPP_HOST_REPLAY` release directory.
Set the matching `*_HOST_ERROR_OUTPUT` to retain the two JSON records.

## Which immediate errors keep a live resource?

These checks use a Lean-owned resource as the payload of a synchronous
declared error. They exercise a different contract from returning copied
bytes, throwing an application exception, or cancelling a pending task.
The consumer source hashes match the linked installation records.

| Installed consumer | What happens after the caller catches the error |
| --- | --- |
| [C11 ordinary](c11-error-owner-20261126/ordinary.json) and [reviewed](c11-error-owner-20261126/reviewed.json) | The [C client](../../tests/fixtures/native-sync-resource/last-owner.c) received `TYPED_ERROR` from an immediate call, closed the original and rejected a stale copy without changing the caller's output. A second installed package incremented the error's still-live ticket to 42. Releasing that payload restored both the live-identity and descriptor counts, and a new call succeeded. |
| [C++ and Rust](native-sync-cpp-rust-20261122.json) | The [C++](../../tests/fixtures/native-sync-resource/consumer.cpp) and [Rust](../../tests/fixtures/native-sync-resource/consumer.rs) clients check identity, mutate the payload, clone its lease, close the original input, and read 44 through the retained lease. Reading the closed input fails. The mixed-package runs here used ordinary C++ and reviewed Rust, not both routes per language. |
| [Python](python-resource-leases-20261123.json), [Ruby](ruby-resource-leases-20261122.json), [.NET](dotnet-resource-leases-20261122.json) | Each client issues a fresh resource containing 13, catches a declared error carrying that resource, and closes the original. A second installed component reads 13 from the error payload. See [Python](../../tests/fixtures/python-task-resources/installed.py), [Ruby](../../tests/fixtures/ruby-task-resources/consumer.rb), and [C#](../../tests/fixtures/dotnet-task-resources/Program.cs). |
| [Native PHP](php-heap-lease-20261123.json) | The [Composer client](../../tests/fixtures/php-io-resources/installed.php) mutates a successful result and reads 11 through the error payload. After other owners close, the observer sees one live identity and one file descriptor above baseline. Dropping the error payload restores both counts. |
| [Java and Kotlin](jvm-error-owner-20261126.md) | Each closed the original, rejected a stale read, mutated the ticket through an independent package and read 42. Closing the error payload released the last identity and descriptor. Separate clients ran in both package load orders on both routes. |

The C++, Rust, Python, Ruby, .NET and native PHP rows use existing results; the JVM clients ran on the original
Maven packages in a new replay. These checks do not establish the
same ownership for an application-created object, a fatal runtime fault, or
another consumer merely because it uses the same backend.

A [second C++ and Rust replay](native-error-owners-20261126.md) on the pinned
native packages closed the original while the declared error was still live,
used its payload in the independent task package, then measured zero identities
after releasing the payload. The earlier read through a cloned lease alone did
not establish that the error held the final reference.
The complementary packages also passed: [ordinary Rust](native-error-complement-20261126/cargo.json)
and [reviewed C++](native-error-complement-20261126/cpp.json). Taken together,
these four installed pairs cover both author routes for both clients.

For the C11 row, the [producer and installer](../../tests/helpers/c-resource-error-installed.mjs) independently
built Desk and Counter, checked both package-set receipts and compiled the same consumer against their
installed headers using `pkg-config`. Both author routes ran both initialization orders from relocated
libraries with the source, original archives and compiler search path removed. The success result and
declared error used distinct output slots. The result is for a Lean-owned ticket with a file descriptor,
not a test of ownership of an application-created C object. Reproduce with `npm run test:c-resource-error-owner`.

## When the declared error owns an application object

Three managed clients distinguish a returned error value from a thrown error
containing an object created by the application:

| Client | Observation through the installed package |
| --- | --- |
| Java | The [Java client](../../tests/fixtures/jvm-host-meter/LeasePayloads.java) saves a thrown `MixedFaultError`, closes both Maven bindings, unwraps its nested `Ok(Err(box))`, and reads 17 from the original box. Asking for an incompatible payload class throws `ClassCastException`. |
| Kotlin | The [Kotlin client](../../tests/fixtures/jvm-host-meter/KotlinLeasePayloads.kt) separately observes `Result.Err(meter)` as data, saves a thrown `RejectBoxError`, exits the binding’s `use` block and reads 37 from the identical meter. The [JAR receipts](jvm-host-imports-20261124.md#leased-java-objects-in-returned-and-thrown-values) cover ordinary and reviewed packages in both load orders. |
| C# | The [NuGet last-owner check](#net-the-same-nuget-install-owns-the-error-and-enforces-retirement) observes both the returned sum and the thrown error; the exception alone keeps the meter alive after producer disposal. |

The Java and Kotlin clients above also hold a local reference. They verify
identity and use after the binding closes, not that the exception holds the
last reference.

The [WIT client](../../tests/fixtures/static-host-workers/installed-peers.wat.in)
receives a box from `Gauge.reject : Box → EIO Box UInt32`. The application
guest created the box. It checks that the error payload and the original
refer to the same box, then drops both its original handle and the successful
return from Workshop. With the error payload as its only handle to that box,
it calls the independent `Workshop.mapped` and reads **73**. After it drops
the error, the guest counts **one** live owner: the counter it is using to
take the measurement. It then drops the counter.

The [installed packages](wit-host-closures-20261125.md#two-installed-synchronous-packages)
ran all four ordinary/reviewed pairings in both load orders. This covers a
guest-created object carried by a synchronous WIT error. A [separate worker
test](wit-host-objects-20261125.md#two-installed-worker-packages-cancel-one-reader)
observed the defining guest's error destructor run once after a callback and
a future. Neither test places an application object in a record field.

Perl has an independent last-owner check. The [installed CPAN client](../../tests/fixtures/perl-host-meter/installed-pair.pl)
gets the original meter back from `rejectObject : Box → EIO (Except String (Except Box String)) Unit`.
The error outlives the inner binding and its local meter and successful result.
The weak reference is still live then, and clears immediately on `undef $error`,
while the outer binding is still open. The [original CPAN installs](perl-host-imports-20261124.md#cpan-host-packages)
ran Workshop and Peer in both orders on four Perl ABIs: prebuilt component
XS on ordinary source and locally built XS on reviewed source. They mutated
the meter across packages **before** the error; unlike the WIT case, this
client does not call the peer through the error after dropping the original.

A [second Perl client](perl-error-owner-20261126.md) installed the same
archives and made that missing call. With the exception as last owner, the
peer read 23 and updated the meter to 42. Dropping the exception cleared the
weak reference and ran one destructor in all 16 route/ABI/order combinations.

The [standalone PHP-Wasm client](php-wasm-host-record-fields-20261126.md)
closed Workshop and unset its original box after catching the declared error.
Sidekick then mutated the error payload to 42. A PHP weak reference cleared
when the exception was dropped. Both source routes ran with embedded and
Composer autoloaders in Node and in a real Chromium interpreter.

In native Composer installs, the [PHP CLI client](../../tests/fixtures/php-host-members/error-owner.php)
distinguishes `choose` returning `Err(17)` from `fail_with` throwing a
`FailWithError` whose payload is the original application meter. It closes
the throwing binding and drops the input, then uses the error’s only reference
in the other package to change the meter from 23 to 42. Dropping the exception
runs the object's destructor exactly once and clears its weak reference while
the other binding is still open. The client disables exception trace arguments
so a PHP backtrace cannot itself keep the meter alive.

The [ordinary](php-error-owner-20261126/ordinary.json) and
[reviewed](php-error-owner-20261126/reviewed.json) records pin the throwing
peer's archive, the independent Workshop release and the client. Both package
orders passed on PHP 8.2.35 and 8.5.10. To reproduce, run
`npm run test:php-host-peer` with the [native PHP publisher inputs](php-host-finalizers-20261124.md).

## Which native failures actually retire a runtime?

The trigger matters. A host method returning an invalid object is not the
same as an application callback returning an error. Two bindings of one
component are not two independently built packages, either.

| Installed public call | Trigger and observed behavior |
| --- | --- |
| [C11 host member](c-host-closures-20261125.md) | The [member](../../tests/fixtures/c-host-closures/consumer.c) reported success without returning the required object. Calls through a sibling binding then failed. Both captures reached their respective destructors once. An ordinary application error code did not retire the binding. |
| [C++20 host member](cpp-host-closures-20261125.md) | The [member](../../tests/fixtures/cpp-host-closures/consumer.cpp) returned a null shared pointer. Both its closure and a sibling reported `Unavailable`. Weak pointers expired as each binding released its capture. A thrown application exception instead preserved its original identity and the binding remained usable. |
| [Rust host member](rust-host-closures-20261125.md) | A real [member panic](../../tests/fixtures/rust-host-closures/consumer.rs) produced `CallbackPanic`; a sibling call then returned `Unavailable`. Closing the owners ran both destructors once. A returned application error preserved its original `Rc` without retirement. The [staged callback API](rust-staged-callback-results-20261126.md) has a different contract: it resumes the original unwind after cleaning up. |
| [C# synchronous host setter](dotnet-host-imports-20261124.md#installed-nuget-consumer) | The [setter](../../tests/fixtures/dotnet-host-meter/Installed.cs) catches the original, deliberately thrown `OutOfMemoryException` from a peer and returns normally. Lean's next getter never runs, the outer update reports the runtime unavailable, and the peer refuses a new call. This exercises failure ordering across two installed bindings, not actual heap exhaustion. |
| [Native PHP callback task](php-retained-tasks-20261123.json) | With one PHP callback suspended, another [threw a PHP `Error`](../../tests/fixtures/php-retained-tasks/installed.php). The caller caught the identical object, the waiting task failed, and a fresh call failed too. After the late resume, live owners and descriptor delta both returned to zero. This was not a direct retirement request through FFI. |
| [MRI callback task](ruby-retained-tasks-20261122.json) | The [Ruby client](../../tests/fixtures/ruby-retained-tasks/consumer.rb) raised an `Exception` outside `StandardError`, directly or during error formatting. Repeated awaits preserved the fatal object; the next call reported unavailability. Recoverable application exceptions have separate checks. |

For [CPython](python-recursive-packages-20260923.md#installed-checks) and
[Perl](perl-recursive-packages-20260923.md#cleanup-and-shared-runtime),
recursive-value package tests separately inject malformed **native output**:
later calls reject and previously copied application values remain usable.
The Perl probe compiles instrumented XS from the exact archive and uses the
installed runtime; it does not modify the installed library. These results
do not show that a user exception in a Python or Perl callback poisons its
runtime, or that an application can recover from an arbitrary process crash.

## What still requires a decision or a test?

The [C11 record client](c-host-record-fields-20261126.md) exercises a recoverable
result-conversion failure: after an object is exported, a later buffer exceeds
the byte budget. No record is published, the temporary lease is released, and a
subsequent call succeeds. The [C++ client](cpp-host-record-fields-20261126.md)
observes that failure as `std::length_error`, separately from a meter throwing
its original application exception. The [installed Rust client](rust-host-record-fields-20261126.md)
observes `Fault::Limit` after a partial result export and checks that its weak
pointer expires when the application drops its own meter. In a separate call,
a member returning `Err` reaches the caller as the original error allocation.
These are recoverable failures, not thrown EIO payloads or fatal faults.

The [five npm clients](javascript-host-record-fields-20261126.md) also
distinguish the original JavaScript exception from a copy-budget failure
partway through a compiled record result. Both authoring routes leave the
binding usable. Disposal and strict object identity are observable here;
the Rust weak-pointer observation is not a JavaScript GC guarantee.

In a separate [ten-run npm qualification](npm-function-fields-20261126.md),
the host callback was expected to return a Lean function. When it threw
instead, each installed client caught the **same JavaScript error object**
and could still call its retained function. An expired call-scoped callback
instead produced status 10 without entering the host. Both paths finished
with zero live Wasm identities. Neither is a declared Lean error or a
terminal Wasm trap.

On all four [Perl configurations](perl-host-record-fields-20261126.md), an
invalid second argument caused no member call. A failed output conversion
released the intermediate meter, as observed through a weak reference, and
left an existing closure usable. A thrown application exception reached the
caller unchanged. Neither case is a declared EIO error containing a record.

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
