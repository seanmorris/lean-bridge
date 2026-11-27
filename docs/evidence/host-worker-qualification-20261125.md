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

The [async delivery crosswalk](async-delivery-crosswalk-20261125.md) traces
each of the 17 consumer profiles to its installed task, stream, callback and
shutdown records, separately from synchronous iteration.
The [IO and failure crosswalk](effect-failure-crosswalk-20261126.md) maps
immediate errors, callback exceptions and terminal faults separately.

For #1222, the [synchronous npm Ledger installs](javascript-wasm-sync-io-20261123.md)
executed direct IO, returned and thrown errors, and validation before a state
change in Node JavaScript and a Chromium page. Their strict TypeScript client
was typechecked, not run. The [two-package trap test](javascript-wasm-callback-io-retirement-20261123.md)
distinguishes an application throwing a JS error from a real guest trap in
Node, a Chromium page, a Node worker and a dedicated Chromium module worker.
On each Ledger route, four browser workers trapped while the parent retained
its ticket and advanced its own counter to 24. This is installed
worker evidence for cross-package retirement, not for the separate 45-check
scalar IO suite. The [five-client Ledger qualification](npm-synchronous-io-delivery-20261126.md)
subsequently ran the same 45 scalar IO checks in strict TypeScript, mounted
React and a dedicated worker as well as plain Node and Chromium on both
author routes. Keep the [synchronous iterator clients](javascript-immediate-iterators-20261125.md)
separate: cursor cleanup is neither scalar IO nor a cross-package trap.

The [baseline contract](../type-surface.v1.json) distinguishes **17 consumer
profiles** and two author routes. Its unit is a shape at a position on one
profile and route, not a package ecosystem. The acceptance questions below
are in addition to the installed examples above:

| Node | Required positions and behavior | What the worker examples cannot establish |
| --- | --- | --- |
| 1221 | Resource, host object, host callback and returned closure, each as a parameter, result, field, callback parameter and callback result (680 cells). | Returning a closure from a factory does not exercise passing it back, storing it in a field, or exchanging it as the argument or result of a callback. Each requires evidence for its own identity and lifetime. |
| 1222 | IO, EIO and named failure contracts at the signature (102 cells). | Receiving a typed worker error does not establish how an immediate call returns an `Except`, preserves the original host exception, or retires a broken runtime. |
| 1223 | Task, cancellation, synchronous iterator and asynchronous iterator at the signature (136 cells). | A host `foreach` or polling wrapper around an asynchronous Lean pull does not qualify a synchronous Lean iterator. |

### Reading the 680 identity placements

The inventory has four value kinds and five positions. Each table entry below
counts up to **34** instances (17 profiles × ordinary and reviewed author
routes). These numbers are the recorded `installedExecution: passed` entries
in [contract 0.109.0](../type-surface.v1.json), **not** the total established
by this branch's newer package reports. Zero means the inventory contains no
passing entry for that position; it doesn't mean the implementation failed.

| Value crossing the boundary | Export parameter | Export result | Record field | Callback parameter | Callback result |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lean resource | 1 | 1 | 0 | 2 | 2 |
| Host-provided function | 34 | 0 | 0 | 0 | 0 |
| Host-owned object | 0 | 0 | 0 | 0 | 0 |
| Lean-produced function | 0 | 34 | 0 | 0 | 0 |

Of those **74** entries, the resource parameter/result are Perl's ordinary
route. The resource callback argument/reply are PHP-Wasm on both routes.
The 34 host-provided-function passes are for handing a callback to a Lean
export, not for a callback receiving another host function.

Match the newer reports against the particular cell they exercise:

- A **Lean resource as an export argument or result** is now verified on both
  routes in all 17 profiles. [Direct Ticket calls](resource-ticket-positions-20261126.md)
  identify the executed client and both original installed releases in each
  profile. The constructor returned a Ticket; the reader accepted a Ticket
  directly. This does not count as a callback accepting or returning a Ticket.
- A **Lean-created function as an export argument** is verified on both routes
  in all 17 profiles. The [installed-client audit](../../tests/helpers/lean-function-export-argument-audit.mjs)
  traces each callable to a Lean-created tariff, the direct call to
  `packQuote(quote)`, and use of the function from the returned record. It
  checks the caller source digest, route-specific execution, and the browser
  entry points that invoked the common client. This is not the test for a
  plain host lambda escaping its registration. Run
  `npm run test:lean-function-export-argument` to reproduce the audit.
- For the four **field** cells, start separately with
  [Lean resources in Claim](owned-checked-record-promotion-20261026-aligned.md),
  [application functions in TariffInput](host-callback-input-records-20261126.md),
  the application-object records below, and the quoted Lean functions below.
  All four have examples on both routes across the 17 profiles. Passing a
  record through a callback does not turn its field into a direct callback
  parameter or reply.
- For a **Lean function as a callback result**, see the direct staged-reply
  installs below (17 profiles on both routes). For a **Lean function as a
  callback parameter**, use the [incoming-function releases](npm-incoming-functions-20261126.md)
  instead. Both routes have installed passes for **all 17 profiles** in
  that incoming direction: five npm profiles, C11, C++20, the
  [Python, Ruby and Rust clients](npm-incoming-functions-20261126.md#installed-python-ruby-and-rust-clients),
  [C#, Java, Kotlin and native PHP](npm-incoming-functions-20261126.md#installed-c-java-kotlin-and-native-php-clients),
  [Perl and PHP-Wasm](npm-incoming-functions-20261126.md#installed-perl-and-php-wasm-clients),
  and [WIT/WASI through Wasmtime](wit-function-fields-20261126.md). An
  application supplying its own callable as the *reply* is a
  different cell. For example, the [CPython staged-reply client](python-staged-callback-results-20261125.md)
  returns a Lean function and rejects a Python lambda.
- For **host-owned objects**, use the installed applications at the top of
  this page. Match the object's actual position in the Lean signature to the
  operation the downstream client calls. For example, the
  [original Python wheels](python-worker-wheels-20261124.md#which-host-object-positions-do-these-wheels-cover)
  exercise an export argument, a callback argument, and a *different*
  host object returned by the callback. The [Python record wheels](python-host-record-fields-20261126.md)
  independently exercise the immediate object result and record field.
  The [Ruby gem pair](ruby-worker-gems-20261124.md#direct-host-object-arguments-and-results)
  additionally tests the immediate export result, separately from task
  delivery. A closure capturing an object, a
  callback receiving it, and a callback returning it are not interchangeable.
- The [one-call restriction](native-once-callback-20261126.md) is a behavior
  exercised across all 17 profiles. It adds no new position by itself.

The remaining review has two parts: attach the installed evidence on each
specific route, then identify the places that actually need a new package or
application case. Do not subtract 74 from 680 to estimate the tests left.

### Installed coverage after the November 26 replays

This table counts **profiles with both ordinary and reviewed results**, out
of 17, not individual test assertions. It combines the original contract's
passes with the linked client results. A dash means no paired result has
been credited here, not that the feature has been tested and failed.

| What crosses the boundary | Export argument | Export result | Record field | Callback argument | Callback result |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lean resource | 17 | 17 | 17 | ≥16 | ≥13 |
| Host-provided function | 17 | 9 | 17 | 9 | 9 |
| Host-owned object | 17 | 17 | 17 | 17 | 17 |
| Lean-created function | 17 | 17 | 17 | 17 | 17 |

That accounts for **at least 622 of 680** profile/route/position combinations.
The final two incoming Lean-function placements are the [installed Wasmtime
replays](wit-function-fields-20261126.md) of the ordinary and reviewed
compiled Lean components. They verify the WIT host at runtime, not a fresh
WIT-targeted source build or a hosted release.
The resource callback counts include the two original PHP-Wasm routes, plus
the [separately checked callers](resource-ticket-positions-20261126.md#direct-callbacks-are-separate).
The difference is not a count of missing implementations: some installations
still need review or a more discriminating client. These counts also do not
measure lifetime, failure, reentry or cleanup coverage, or hosted release acceptance.

The **58 placements without a completed pair** break down as follows.
Some already have an ordinary-route result; the table below subtracts those.

| Public call that still needs a witness | Profiles without a paired witness | Placements |
| --- | --- | ---: |
| Forward an application function through an immediate export result, a callback argument, and a callback reply | C++, Rust, .NET, Java, Kotlin, native PHP, PHP-Wasm, Perl | 8 × 3 × 2 = 48 |
| Read the actual resource passed into a callback | Kotlin | 1 × 2 = 2 |
| Return a resource distinguishable from the input and recovery value | .NET, Java, Kotlin, native PHP | 4 × 2 = 8 |

For example, Java has a qualifying resource argument but still needs a
distinct reply; Kotlin needs both. A single installed workload can exercise all
three rows, but only its previously uncredited positions increase the total.

### What has passed on just the ordinary route?

Three profiles have ordinary-package evidence inside that 58-placement
gap. Count each profile and position once, even if multiple archives or
build tools exercised it:

| Ordinary installed consumer | Forwarded function positions | New Ticket positions | Newly evidenced route checks |
| --- | ---: | --- | ---: |
| [C++20](native-application-functions-20261127/ordinary.cpp.json) | 3 | — | 3 |
| [Rust](native-application-functions-20261127/ordinary.cargo.json) | 3 | — | 3 |
| [Native PHP](c-wit-application-functions-20261127/ordinary.php-native.json) | 3 | Callback result | 4 |

This brings the lower bound to **632/680 individual installed placements**:
622 backed by pairs, plus 10 ordinary-only. **48** still lack an individual
witness in this tally. The paired figure is **622/680**; use the
reviewed install to complete each pair. Neither number counts lifetime or
error assertions, or qualifies a hosted release.

### Reproducing application-provided function crossings

`npm run test:npm-application-function-positions` builds ordinary and reviewed
packages from [the forwarding functions](../../tests/fixtures/structured-types/pass-application-quote.lean).
The application supplies a stateful function. While its registration is
live, a visitor invokes it, passes it through an immediate export result,
and returns it to Lean as another callback's reply. Lean invokes that reply;
a different fallback makes substitution visible. After the original call
ends, a saved wrapper must not re-enter the application. This tests
forwarding a **call-borrowed registration**, not creating a new long-lived
registration by returning a bare JavaScript function.

The [ordinary](npm-application-functions-20261126/ordinary.json) and
[reviewed](npm-application-functions-20261126/reviewed.json) packages passed
in Node, strict TypeScript, a Chromium page, mounted React and a dedicated
worker. On both routes, three calls per client reached the application
function, the original exception propagated, no stale call entered application
code, and the live identity count returned to zero. The executed TypeScript
client also returned 903 through its typed API. These runs qualify three
positions on five profiles and two routes (30 placements).

On those same two releases the [self-disposal replay](effect-failure-crosswalk-20261126.md)
also verifies that an inner host exception neither revives an expired
registration nor invalidates its still-active caller. It does not add positions.

Set `LEAN_BRIDGE_APP_QUOTE_KEEP` to an existing directory to retain the
package sets, or `LEAN_BRIDGE_APP_QUOTE_REPLAY` to the resulting `sets-*`
directory to rerun the installed clients without rebuilding Lean.

For Python, Ruby and Rust, `npm run test:native-application-function-positions`
builds a wheel, gem and crate from each authoring route, installs them, and
runs downstream clients. They distinguish forwarding the live application
function from returning a substitute, exercise nested calls and the original
host error, and try the saved wrappers again after their registration ends.
`npm run test:native-application-function-interfaces` separately checks the
Rust client against the generated public API. Type-checking alone does not
qualify an installed client in the table.

The [ordinary Python wheel](native-application-functions-20261127/ordinary.pypi.json)
has now passed in a relocated Python 3.11 environment. The client observed
the original inner exception and no calls through an expired registration;
the observer recorded one live identity after each scenario and zero on
shutdown. The [ordinary Rust crate](native-application-functions-20261127/ordinary.cargo.json)
also passed. Cargo built the application and observer offline from the locked
dependencies. Both executables ran after removing the build tree; the observer
saw three live identities while holding a known Lean tariff and zero at all seven
cleanup checkpoints. The wheel and crate share a compiled Lean component but
have distinct archives and downstream applications. Neither single-route pass
counts as a paired placement.
Set `LEAN_BRIDGE_PYTHON` to an interpreter with `venv` and `ensurepip`.
To run a single retained route without rebuilding, set
`LEAN_BRIDGE_NATIVE_APP_QUOTE_REPLAY` to the two-route directory and
`LEAN_BRIDGE_NATIVE_APP_QUOTE_ROUTE` to `ordinary` or `reviewed`.
Use `LEAN_BRIDGE_NATIVE_APP_QUOTE_RESUME` in place of `REPLAY` to build
a missing route. A single-route run never writes paired evidence.
Set `LEAN_BRIDGE_NATIVE_APP_QUOTE_TARGET` during a replay to isolate one
installed consumer (`pypi`, `rubygems`, or `cargo`). Check the recorded results
against the retained archives and actual client sources with
`npm run test:native-application-function-receipts`.

`npm run test:c-wit-application-function-positions` now builds C, C++ and
WIT/WASI archives together on each author route. The C11 application runs
against native C and Wasmtime; the C++20 application uses the public C++
facade through **both pkg-config and CMake**. Separate observers check
cleanup. A retained two-target C/WIT handoff can still be replayed without
attributing a C++ result to it. Supply an existing scratch directory in
`LEAN_BRIDGE_C_WIT_APP_KEEP` to keep the two releases or point
`LEAN_BRIDGE_C_WIT_APP_REPLAY` to their `sets-*` directory to reinstall
without recompiling Lean. The smaller `test:c-wit-application-function-interfaces`
check compiles the clients against all three headers; it does not execute them.

C11 ([ordinary](c-wit-application-functions-20261127/ordinary.c.json),
[reviewed](c-wit-application-functions-20261127/reviewed.c.json)) and Wasmtime
([ordinary](c-wit-application-functions-20261127/ordinary.wit-wasi.json),
[reviewed](c-wit-application-functions-20261127/reviewed.wit-wasi.json))
ran the same application through four distinct installed archives.
All four forwarded the application function, recovered from a nested failure,
observed Tickets 42 and 71 inside the callback, and returned different Tickets
(43 and 72) rather than the recovery Ticket 800. The live count fell to zero
at shutdown. To audit those results, set `LEAN_BRIDGE_C_WIT_APP_REPLAY` to
the retained sets directory, `LEAN_BRIDGE_C_WIT_APP_OUTPUT` to the reports
directory and run `npm run test:c-wit-application-receipts`. Set
`LEAN_BRIDGE_C_WIT_APP_AUDIT_ROUTE=ordinary` to inspect only the first
route. This checks the archive, user source, compiled interface, source hashes
and installed output, plus the actual WIT world and Wasm binary.

The MRI 3.3.12 [ordinary gem](c-wit-application-functions-20261127/ordinary.rubygems.json)
and [reviewed gem](c-wit-application-functions-20261127/reviewed.rubygems.json)
each ran the forwarding and Ticket clients in separate relocated processes.
The [Ticket application](../../tests/fixtures/structured-types/tariff-ticket-application.rb)
read the incoming handle, returned a distinct Ticket, propagated the exact
Ruby exception on failure and repeated the successful exchange. After each
scenario the observer saw one live session; shutdown removed it. Each
gem contained the native library from its matching C author route.

The CPython 3.11.16 [ordinary wheel](native-application-functions-20261127/ordinary.pypi.json)
and [reviewed wheel](c-wit-application-functions-20261127/reviewed.pypi.json)
ran the same forwarding client and observer. The wheels are **not** builds
of an identical module: the reviewed module appends two Ticket definitions.
Comparing their archived interfaces found the same original declarations,
ownership rules, types and errors. A control that changes a returned function
from leased to copied fails the comparison. This qualifies three forwarding
positions on both routes. The separate Ticket client ran only in the newer
wheel and adds no new Python placement.

To repeat that comparison, set `LEAN_BRIDGE_FORWARDING_ORDINARY_SET` and
`LEAN_BRIDGE_FORWARDING_REVIEWED_SET` to the package-set directories for
those wheels, and the corresponding `_REPORT` variables to the linked JSON
files. Run `npm run test:forwarding-wheel-extension`.

An alternative C++ run reuses the compiled Lean component in a retained
Python wheel without running Python or rebuilding Lean. Set
`LEAN_BRIDGE_CPP_APP_WHEEL` to its complete native package handoff,
`LEAN_BRIDGE_CPP_APP_WHEEL_SHA256` to the independently verified receipt
hash, `LEAN_BRIDGE_CPP_APP_ROUTE` to the author route, and
`LEAN_BRIDGE_CPP_APP_OUTPUT` to a fresh directory. Run
`npm run test:cpp-application-from-wheel` with the matching Lean headers and
[pinned public GMP kit](../publishing.md). The production C++ packager verifies
the component and runtime and emits a distinct C++ archive. Both link methods
exercise this installed archive. Its Lean source has the forwarding exports
but not the newer Ticket exchange; the program checks borrow expiry after
both success and failure instead. This is not a fresh C++-targeted author build.
The [ordinary C++20 replay](native-application-functions-20261127/ordinary.cpp.json)
used the same compiled Lean bytes as the wheel. Independently built pkg-config
and CMake executables both observed 42 from the forwarded function, 43 after
the nested failure, and zero live identities on shutdown. To replay an
existing projection, set `LEAN_BRIDGE_CPP_APP_REPLAY_SHA256` to the C++ set's
receipt hash in addition to the donor wheel's pin. This never overwrites the
retained handoff.

To use the combined C/WIT release for C++ instead, set
`LEAN_BRIDGE_CPP_APP_C` and `LEAN_BRIDGE_CPP_APP_C_SHA256` in place of the
wheel settings. Both pkg-config and CMake clients then exercise the Ticket
callback as well as function forwarding.

`test:c-family-application-from-c` packages and installs one Python wheel
or Rust crate from the same verified C release. Set `LEAN_BRIDGE_FAMILY_APP_TARGET`
to `pypi` or `cargo`, and supply `LEAN_BRIDGE_FAMILY_APP_C`, `_C_SHA256`,
`_ROUTE` and `_OUTPUT` with that same prefix. The output directory has a
subdirectory per target. Python uses `LEAN_BRIDGE_PYTHON`; the relocated
environment runs the forwarding and Ticket clients in separate processes.
Rust requires the pinned Cargo/rustc toolchain, offline producer cache,
and `LEAN_BRIDGE_FAMILY_APP_RUST_DEPS` containing the vendored dependency
archive and `dependencies.json`. Pin the latter's SHA-256 with
`LEAN_BRIDGE_FAMILY_APP_RUST_DEPS_SHA256`; the client checks the dependency
archive and the lockfile inside the installed crate before compiling offline.
Its runtime test covers forwarding, not a new Rust Ticket placement.

To audit Python, Ruby or native PHP results, run `test:projected-application-receipts`.
Set `LEAN_BRIDGE_PROJECTED_APP_TARGET` to `pypi`, `rubygems` or `php-native`,
`LEAN_BRIDGE_PROJECTED_APP_DONORS` to the directory of C release sets,
and `LEAN_BRIDGE_PROJECTED_APP_OUTPUT` to the target directory with the
retained handoffs and JSON reports. Leave `LEAN_BRIDGE_PROJECTED_APP_ROUTE`
unset for a pair or set it to audit a single route.

The same authenticated wheel can supply a new gem or NuGet package.
Use `test:ruby-application-from-wheel` or `test:dotnet-application-from-wheel`
with the corresponding `LEAN_BRIDGE_RUBY_APP_*` or `LEAN_BRIDGE_DOTNET_APP_*`
settings in place of `LEAN_BRIDGE_CPP_APP_*`, a pinned private GMP kit, and
the Ruby 3.3 or .NET 8 toolchain. Each projection gets its own package receipt;
rebuilding a binding never changes the result recorded for an older archive.
To include direct Ticket callbacks, select the combined C/WIT handoff instead
of a wheel: use `*_APP_C` and `*_APP_C_SHA256` in place of the two
`*_APP_WHEEL` settings. Ruby and .NET use the same restored native inputs.
For CPAN, use `test:perl-application-from-c` with `LEAN_BRIDGE_PERL_APP_C`,
`LEAN_BRIDGE_PERL_APP_C_SHA256`, `LEAN_BRIDGE_PERL_APP_ROUTE` and a fresh
`LEAN_BRIDGE_PERL_APP_OUTPUT`. Set `LEAN_BRIDGE_PERLS` to the four ABI
interpreter paths. The runner produces separate component and runtime archives,
then exercises both prebuilt and generated XS installs. Set `*_APP_REPLAY_SHA256`
to replay a previously retained destination receipt. Optional
`LEAN_BRIDGE_PERL_APP_ABI` and `LEAN_BRIDGE_PERL_APP_MODE` select one result;
a partial replay does not establish full Perl coverage.

To isolate a Perl forwarding failure without building a new CPAN release,
use `npm run test:perl-callback-frame-facade` with
`LEAN_BRIDGE_FRAME_APPLICATION=1` and `LEAN_BRIDGE_FRAME_C_HANDOFF`
pointing at the ordinary/reviewed C package sets. Supply each selected
route's receipt pin as `LEAN_BRIDGE_FRAME_APPLICATION_ORDINARY_SHA256`
or `LEAN_BRIDGE_FRAME_APPLICATION_REVIEWED_SHA256`, the matching
`LEAN_BRIDGE_LEAN_PREFIX` and `LEAN_BRIDGE_PERLS`. Optionally select
`LEAN_BRIDGE_FRAME_APPLICATION_ROUTE` and `LEAN_BRIDGE_FRAME_APPLICATION_ABI`.
The [failure crosswalk](effect-failure-crosswalk-20261126.md) distinguishes
this compiled XS probe from the separately installed CPAN results.

For native PHP, `test:php-application-from-c` installs a separate Composer
distribution from the same authenticated C donor. Set `LEAN_BRIDGE_PHP_APP_C`,
`LEAN_BRIDGE_PHP_APP_C_SHA256`, `LEAN_BRIDGE_PHP_APP_ROUTE` and
`LEAN_BRIDGE_PHP_APP_OUTPUT` as above. Set `LEAN_BRIDGE_PHP_HOST_INTERPRETERS`
to the comma-separated PHP CLI executables with FFI (the qualification uses
PHP 8.2 and 8.5). The client installs offline, relocates the vendor tree,
and checks the installed native library against the donor before reporting.
To rerun the same ZIP, also supply `LEAN_BRIDGE_PHP_APP_REPLAY_SHA256`.
This does not exercise the separate wasm32 Zend runtime.

PHP-Wasm uses a separate wasm32 Zend extension. `npm run test:php-wasm-application-function-interfaces`
compiles its C transport and inspects the PHP functions in a real PHP 8.4 VM.
Use `npm run test:php-wasm-application-function-positions` for the installed
test: the [wasm32 PHP caller](../../tests/fixtures/structured-types/tariff-zend-application.php)
must forward its own function, preserve a nested exception, reject expired
registrations, and survive a binding shutdown and VM refresh. The runner
requires embedded and Composer installations, on startup and on demand in both
Node and Chromium. Set `LEAN_BRIDGE_ZEND_TARIFF_KEEP` to retain the releases
or `LEAN_BRIDGE_ZEND_TARIFF_REPLAY` to reuse them; select a single author
with `LEAN_BRIDGE_ZEND_TARIFF_ROUTE` for a partial run.

The original ordinary gem (`ea79cbe3…`) raised `ArgumentError` before a
forwarded Ruby function could run: MRI would not re-enable the same
thread-filtered `TracePoint`. The [corrected gem](native-application-functions-20261127/ordinary.rubygems.json)
(`52cfb2dc…`) ran the same Lean component with a binding that reuses the
already active guard. The [installed application](../../tests/fixtures/structured-types/tariff-application-function.rb)
verified forwarding, nested exception identity, containment of a nonlocal
exit, and rejection of fiber switches in both the inner and outer callback.
An unrelated thread could switch fibers; the caller could too after return.
The broker returned to its one-session baseline after every scenario and
to zero on shutdown. The combined C-donor gems above exercise the same
guard on both author routes.

For Java, Kotlin and native PHP, build **the same two author projects** for
both Maven and Composer. Set `LEAN_BRIDGE_MANAGED_APPLICATION_KEEP` to an
existing directory and run `npm run test:managed-application-packages`. The
resulting `sets-*` directory contains one verified handoff per author route.
The downstream checks run independently without rebuilding Lean:

- Set `LEAN_BRIDGE_JVM_APPLICATION_REPLAY` to that directory and run
  `npm run test:jvm-application-function-positions`. See the
  [JDK, Kotlin and Maven settings](jvm-function-fields-20261126.md).
- For one route without recompiling Lean, set `LEAN_BRIDGE_JVM_APPLICATION_C`
  to the verified C/WIT handoff, `LEAN_BRIDGE_JVM_APPLICATION_C_SHA256` to
  its receipt hash, and `LEAN_BRIDGE_JVM_APPLICATION_ROUTE` and
  `LEAN_BRIDGE_JVM_APPLICATION_OUTPUT` to the route and destination. Leave
  `*_KEEP` and `*_REPLAY` unset; `*_REPLAY_SHA256` can pin a previously
  retained Maven projection. The same Java and Kotlin clients install the JAR
  and POM offline and run on a relocated JRE with no compiler.
- To include NuGet, set `LEAN_BRIDGE_MANAGED_APPLICATION_NUGET=1` **before**
  running the producer. Set `LEAN_BRIDGE_DOTNET_APPLICATION_REPLAY` to that
  three-target handoff directory, then run `npm run test:dotnet-application-function-positions`.
  The C# client runs again after removal of the build tree, with a runtime
  containing no SDK. The C# compile-only check also includes the two direct
  Ticket replies; compilation alone is not a passing installed result.
- Set `LEAN_BRIDGE_PHP_APPLICATION_REPLAY` to the same directory and run
  `npm run test:php-application-function-positions`. The [PHP application](../../tests/fixtures/structured-types/tariff-application.php)
  runs from a relocated Composer installation. Set `LEAN_BRIDGE_PHP_HOST_INTERPRETERS`
  to a comma-separated list to check additional native PHP builds with FFI.

The clients record the forwarded value, the surviving outer call after
an inner failure, and both actual Ticket replies. A separate observer
checks live native owners after cleanup. The faster `test:jvm-application-function-interfaces`
and `test:php-application-function-interfaces` checks only compile or
inspect the public API; they are not installed-run evidence.

### Host-owned objects: which installs cover each position?

An immediate export argument or result is the object itself. Passing a
record that contains it, or awaiting a task that later delivers it, doesn't
establish that position. The callback checks below deliberately distinguish
the object supplied to the callback from the object it returns.

| Consumer profiles | Object in a record field, both author routes | Export and callback arguments and results |
| --- | --- | --- |
| Python | [Rack](python-host-record-fields-20261126.md) | [Workers](python-worker-wheels-20261124.md#which-host-object-positions-do-these-wheels-cover) and Rack's immediate `select_primary` result cover all four. |
| Ruby | [Panel](ruby-host-record-fields-20261126.md) | [Four positions](ruby-worker-gems-20261124.md#direct-host-object-arguments-and-results), both gem routes. |
| .NET | [Pair](dotnet-host-record-fields-20261126.md) | [Four positions](dotnet-worker-packages-20261124.md#host-objects-as-arguments-and-results), both NuGet routes and load orders. |
| Perl | [Record and independent peer](perl-host-record-fields-20261126.md) | [Four positions](perl-worker-packages-20261124.md#which-calls-preserve-the-original-perl-reference), from the synchronous and worker CPAN installs. |
| JavaScript (Node, strict TypeScript, browser, React, worker) | [Five installed clients](javascript-host-record-fields-20261126.md) | [Each client exchanged two distinct meters](javascript-host-imports-20261124.md#host-object-arguments-and-results-in-five-installed-clients) in all four positions on the original ordinary and reviewed releases. |
| C and C++ | [C](c-host-record-fields-20261126.md) · [C++](cpp-host-record-fields-20261126.md) | The [C11](static-host-workers-20261125.md#c11-object-arguments-and-replies) and [C++20](static-host-workers-20261125.md#c20-object-arguments-and-replies) clients each checked immediate identity and a distinct callback reply, on both releases and with both link orders. |
| Rust | [Record and independent peer](rust-host-record-fields-20261126.md) | The [Rust client](static-host-workers-20261125.md#rust-object-arguments-and-replies) verifies immediate Box identity and a distinct Dial returned by callback, on both primary releases. |
| Java and Kotlin | [Both Maven clients](jvm-host-record-fields-20261126.md) | [Separate Java and Kotlin clients](jvm-worker-packages-20261124.md#passing-and-returning-application-objects) verify immediate identity and distinct callback replies in both load orders on each route. |
| Native PHP | [Composer/FFI](php-host-record-fields-20261126.md) | [Native PHP clients](php-host-task-packages-20261124.md#where-php-object-identity-is-checked) exercise a cold immediate return and two callbacks exchanging distinct objects on both routes. |
| PHP-Wasm | [Zend](php-wasm-host-record-fields-20261126.md) | The [installed Zend clients](php-wasm-zend-packages-20261124.md#checking-the-original-zend-object-in-each-position) test both immediate returns and distinct callback arguments and replies through Node and Chromium. |
| WIT/WASI | [Guest-owned boxes](wit-host-record-fields-20261126.md) | The [installed Wasm guest](wit-host-objects-20261125.md#when-a-callback-returns-a-different-box) distinguishes two equal-valued boxes on both routes, including an echo provider that must fail. |

All 17 profiles have installed evidence for all five host-object positions
on both routes (170/170). This is one of the four identity families.

For **resource fields**, start with the [hosted owned-record acceptance](owned-checked-record-promotion-20261026-aligned.md),
not another build of the same fixture. The [actual Lean record](../../tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean)
has `Claim.holder : Ticket`. Across 17 profiles the full ordinary and reviewed
packages exercise borrowed and transferred claims, leased results, and claims
exchanged with synchronous callables. The standalone result-only packages
do not exercise transfers or callback inputs. These are results for the
archived releases and this concrete resource field. A closure *receiving*
a claim is not a closure *stored inside* a field. Neither it nor a Lean
`Ticket` field establishes ownership of an application-hosted object field.
For the latter, the [Python rack consumer](python-host-record-fields-20261126.md)
uses two Python-created meters in a public record and checks the actual
objects before and after another rack closes.
The [Ruby panel consumer](ruby-host-record-fields-20261126.md) passes two
records in one call and checks ownership through frozen and duplicated panels.
The [native PHP consumer](php-host-record-fields-20261126.md) checks the
same application meters across a cloned record and a returned function.
It also exercises failure after a native result has already copied one
field and exported a meter.
The [NuGet record consumer](dotnet-host-record-fields-20261126.md) additionally checks that a closed-generic
`Pair<Meter>` cannot be replaced with `Pair<object>`, mutable byte-array properties do not alias,
and the original CLR objects survive closure capture but are released on disposal.
The [separate Java and Kotlin Maven clients](jvm-host-record-fields-20261126.md)
check their own static types and evaluate the getters on the original JVM objects.
The [C11 client](c-host-record-fields-20261126.md) separately counts each meter's
destruction. A returned row survives binding closure; a getter can outlive that row.
The [C++ client](cpp-host-record-fields-20261126.md) instead checks the shared
ownership control block and uses weak pointers to observe the same two lifetimes.
The [Rust client](rust-host-record-fields-20261126.md) passes a getter result
to an independent Cargo package after dropping the record and closing its
binding. The peer increments the original meter and keeps the last owner alive.
The [five npm programs](javascript-host-record-fields-20261126.md) exercise
the independent peer in Node JavaScript, executed strict TypeScript, a
Chromium page, mounted React and a dedicated browser worker.
The [installed Perl clients](perl-host-record-fields-20261126.md) pass a meter
from the returned record to an independent CPAN package and observe its final release.
The [Zend client](php-wasm-host-record-fields-20261126.md) held two real PHP
objects in a compiled record and used a getter result in a second package,
under both Node and Chromium. The [WIT/WASI guest](wit-host-record-fields-20261126.md)
constructed a record with two guest-owned boxes and passed the last owner
from its getter to an independent package. That completes **17 of 17 profiles**
for caller-constructed application-object records on both authoring routes.
It does not qualify callable fields or either direction of a callback exchange.
A private cursor carrying an application object between pulls is not the
same as an application being able to construct, inspect and pass a record.

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
For installed calls, the [Python wheels](python-leased-closure-fields-20261125.md)
exercise a scalar function field after its original wrapper closes. The
[C11 Tariff client](c-leased-closure-fields-20261125.md) releases the original
owner, invokes the remaining leases, and verifies that a raw alias is invalid
after its last lease is released. The [C++20 record client](cpp-staged-callback-results-20261126.md#a-caller-builds-a-record-with-a-function-field)
distinguishes a copied or repacked Lean function from a C++ lambda whose
borrow has expired. The [Rust field client](rust-staged-callback-results-20261126.md#a-rust-record-owns-its-function-field)
checks `Clone`, `drop`, a caller-built record and rejection of an expired
`FnMut` with no remaining native owner. The [C# NuGet client](dotnet-function-fields-20261126.md)
checks `Retain`, a caller-built record and `AsCallback` repacking. A plain
delegate that escapes its call is refused; the native broker is empty after
the owner thread exits. The [five installed npm clients](npm-function-fields-20261126.md)
retain and repack a function from a record; all five observe a live Wasm
identity while holding it and none after disposal. [Java and Kotlin](jvm-function-fields-20261126.md)
each retain and repack function fields from an offline Maven install; both
return to baseline after each case, then zero after owner-thread exit.
The [RubyGems consumer](ruby-function-fields-20261126.md) also retains and
repacks the field, returns it directly from a callback, and observes the
native count return to its warmed baseline on both routes.
The [native PHP client](php-function-fields-20261126.md) exercised both
routes on PHP 8.2 and 8.5; the broker returned to baseline before request
shutdown and to zero afterward.
These tests do not exercise a function field containing
a captured application object or a durable host callback.

The [C callback exchange](c-callback-function-fields-20261125.md) separately
exercises the function-bearing record as a callback argument and reply,
including a borrowed reply, transferred reply owner and explicitly retained
incoming function. Passing a record is different from passing a bare callable.

### A callback receives a Lean function directly

`withFunction value callback := callback id value` passes the function itself,
not a record containing it. Existing ordinary and reviewed installs cover
this case for the following clients. The host invokes the borrowed function
inside its callback, retains an independent handle, and checks expiry or
rejection of the borrow and continued use of the retained handle.

| Client | Where to verify the installed check |
| --- | --- |
| C# | [HigherOrder](../../tests/fixtures/structured-types/owned-dotnet-callback-signatures.cs) is included in the installed executable. Both [NuGet reports](owned-dotnet-execution-20260927.json) pin the original probe in `packages.<route>.originalProbeSha256` and separately identify the compiled consumer. |
| Java and Kotlin | The [Maven reports](owned-jvm-execution-20260927.json) identify a separate compiled consumer for each language in both `callbacks-*` packages. The [packaged Java probe](https://github.com/seanmorris/lean-bridge/blob/578f04d09320e6998959390a3a0218ac6fd66d02/tests/fixtures/structured-types/owned-jvm-callback-signatures.java) and [Kotlin probe](../../tests/fixtures/structured-types/owned-kotlin-callback-signatures.kt) match the receipt's source inventory. The current Java source includes a [later thread-cleanup change](jvm-thread-exit-repair-20260928.md); it is not the byte-for-byte source for this receipt. |
| Perl | The [CPAN reports](owned-perl-integration-20260928.json) bind the [signature client](../../tests/fixtures/structured-types/owned-perl-signatures.pl) at `packages.callbacks-ordinary.consumerSha256` and `packages.callbacks-reviewed.consumerSha256`. The expired borrow and later successful retained call are separate assertions. |
| Native PHP | The [Composer reports](owned-php-integration-20260928.json) bind the [installed PHP client](../../tests/fixtures/structured-types/owned-installed-php.php) at `packages.<route>.sourceSha256`. |
| PHP-Wasm | The [interpreter package reports](owned-php-wasm-integration-20260928.json) bind a [different PHP client](../../tests/fixtures/structured-types/owned-php-wasm-installed.php) at `reports.packages.observations[].consumerSha256`. |

This evidence is for a pure Lean identity function over a resource-bearing
record, as a **callback parameter**. It does not establish a direct function
**returned by** a host callback, nor a host function registered for later use.
For the return direction, the [installed C11 staged callback](c-staged-callback-results-20261125.md)
returns a typed Lean function on both author routes. Lean applies it to a second
argument. The two build-system clients distinguish a fresh owned reply from
a caller-owned function, missing recovery, a host failure and a foreign reply.
This does not register a C function for use after the callback returns.
The [C++20 direct-reply clients](cpp-staged-callback-results-20261126.md)
also check compile-time recovery requirements, ownership of a freshly
returned function, and preservation of the original C++ exception.
The [two installed CPython wheels](python-staged-callback-results-20261125.md)
exercise the same direct reply through the Python API. A retained Lean
function remains usable; a Python lambda is not a valid function result.
An exception raised by the host callback survives as the original Python
object. Both installs reached zero live identities at session close.
The [offline Rust clients](rust-staged-callback-results-20261126.md) also
exercise a direct function reply rather than a record containing one. They
distinguish a recoverable Rust error from a panic and check the original
allocation or payload in the caller. The [C# client](dotnet-function-fields-20261126.md)
returns a native closure from a host callback with a typed recovery value;
throwing after a nested allocation preserves the original managed exception.
The [npm clients](npm-function-fields-20261126.md) return a retained Lean
function through a host callback. Throwing a JavaScript error in that callback
returns the original error object and leaves the retained function callable.
The [two Maven clients](jvm-function-fields-20261126.md) also return a bare
leased function, then separately throw during a callback after a nested
allocation. Both languages recover the original exception and invoke their
saved functions again.

The [installed Wasmtime client](wit-function-fields-20261126.md) also
qualifies a leased callable field and a direct higher-order callback reply.
Both WIT source routes rejected stale calls before host entry and restored
their native owner count. This is separate from invocation-count policy.
The [CPAN consumer](perl-function-fields-20261126.md) ran both paths on
threaded and unthreaded Perl 5.36 and 5.38. The native broker returned
to baseline before shutdown in all eight installs.
The [wasm32 PHP client](php-wasm-function-fields-20261126.md) ran each
source route in Node and Chromium, with both autoloaders and both loading
modes. All 17 profiles now have both authoring routes for this scalar
function-field and direct function-reply case. This does not qualify
arbitrary host callbacks supplied inside input records.

An [installed npm input-record test](npm-function-fields-20261126.md#passing-a-javascript-function-inside-an-input-record)
passes a caller-created JS function through a field on both author routes.
It can reenter Lean during the call but not after the returned borrow expires.
This covers input fields in all five npm profiles, not durable registrations.
The [ordinary and reviewed C11 installs](host-callback-input-records-20261126.md)
demonstrate the same input-field lifetime through pkg-config and CMake.
The [CPython wheels](host-callback-input-records-20261126.md) and
[relocated C++ releases](host-callback-input-records-20261126.md#c-callers)
qualify it as well. Both [offline Cargo installs](host-callback-input-records-20261126.md#rust-callers)
passed all seven scenarios. The [two RubyGems installs](host-callback-input-records-20261126.md#ruby-callers)
and [both C# NuGet installs](host-callback-input-records-20261126.md#c-callers-1)
also passed. The [ordinary and reviewed CPAN installs](host-callback-input-records-20261126.md#perl-callers)
passed with prebuilt XS on all four Perl ABIs. The [native Composer installs](host-callback-input-records-20261126.md#native-php-callers)
passed in PHP 8.2 and 8.5 on both routes. The [offline Maven installs](host-callback-input-records-20261126.md#installed-java-and-kotlin-consumers)
also passed in separate Java and Kotlin applications. Both
[PHP-Wasm packages](host-callback-input-records-20261126.md#php-wasm-callers)
passed all eight Node/Chromium installation and loading combinations. The
[relocated WIT/WASI clients](host-callback-input-records-20261126.md#witwasi-callers)
also passed on both routes, bringing this input-field case to **17 of 17 profiles**.

A separate [incoming-function check](npm-incoming-functions-20261126.md)
passes a Lean function directly into the host callback. All five consumers
rejected the expired borrow and kept an independent lease on each of the
[matched npm releases](npm-incoming-functions-20261126/matched/pair.json).
Both used the same runtime archive. An older ordinary release passed the
same checks with a different runtime.

The [installed C11 clients](npm-incoming-functions-20261126.md#installed-c11-clients)
passed on both author routes through pkg-config and relocated CMake, bringing
the direct incoming-function check to **6 of 17 profiles**.

The [C++20 releases](npm-incoming-functions-20261126.md#installed-c20-clients)
and [wheel, gem and crate](npm-incoming-functions-20261126.md#installed-python-ruby-and-rust-clients)
subsequently passed the same direction, taking the installed count to 10.

The [managed runtime clients](dotnet-function-fields-20261126.md#a-function-passed-directly-into-a-callback)
also tested nested failure, comparison of live and expired views, and zero
owners after thread exit. Those .NET, Java and Kotlin runs exercised real
compiled code; they are not paired NuGet or Maven installation results.

### Does a callback allow one call or many?

Running a callback exactly once in an example doesn't show the binding
would reject a second call. The [registry unit test](../../tests/callback-runtime.test.mjs)
gives a callback an explicit `once` plan and verifies that rejection. The
[registry](../../src/runtime/callbacks.mjs) counts admission before entering
application code. This is not evidence from a client of an installed package.

In the [reviewed owned-function frontend](../../src/analyze/reviewed-owned-source.mjs),
the admitted policy is repeated calls, same-agent reentry and deferred
self-disposal. The [threaded npm author check](../../tests/helpers/javascript-wasm-task-callback-cli.mjs)
changes `many` to `once` in the review and expects the build to **reject**
the mismatch. Neither a successful single invocation nor this publisher
refusal qualifies an author-selected one-call contract.

The [Budget package](npm-once-callback-20261126.md) now exercises that
contract for retained callbacks on the threaded npm profile. The author
selects the allowance in the export configuration. It is per task and
parameter: an independent registration works even while another is active.
The [PHP-Wasm Budget install](php-wasm-once-callback-20261126.md) enforces
the same limit on synchronous PHP callbacks retained by a Lean task.
The [CPython wheel pairs](python-once-callback-20261126.md) independently
qualified asyncio on 3.11 and 3.12. The [relocated C11 archives](native-once-callback-20261126.md#c11)
also enforced the allowance when two Lean workers raced for the same callback.
The [C++20 clients](native-once-callback-20261126.md#c20) also distinguished a
typed admission error from the original C++ exception and a replacement Lean error.
The [installed Rust clients](native-once-callback-20261126.md#rust) preserved
the original host error even when it carried an earlier policy refusal.
The [MRI gems](native-once-callback-20261126.md#ruby) distinguished admission,
factory IO, terminal IO, typed errors and original Ruby exceptions.
The [two .NET 8 installs](native-once-callback-20261126.md#net) also preserved
the original CLR exception and released the retained delegate's capture.
The [Maven packages](native-once-callback-20261126.md#java-and-kotlin)
passed both a Java future client and a Kotlin suspend client. The
[native Composer packages](native-once-callback-20261126.md#native-php)
passed on PHP 8.2 and 8.5. The [CPAN packages](native-once-callback-20261126.md#perl)
passed 256 two-worker races across 16 relocated installs. Both WIT/WASI
interfaces now have installed results: [pollable tasks](native-once-callback-20261126.md#witwasi-pollable-tasks)
and [canonical futures](native-once-callback-20261126.md#witwasi-canonical-futures).
That completes **17 of 17 profiles on both author routes for this one-call
rule**. It does not qualify the separate direct-function borrow.
This does not change the separate synchronous owned-function frontend.

### Synchronous iterators by profile

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

For npm's asynchronous protocols, [two additional installed consumers](typescript-react-threaded-delivery-20261125.md)
exercise strict TypeScript as an executed Node program and React as a mounted
Chromium application. The evidence includes early iterator exit, cancellation
while a host callback is pending, and a late reply followed by a successful
new task. The React component unmounts without closing the shared runtime.

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
