# Installed async delivery, by consumer

VO #1223 asks what an application actually observes when a task, callback or
iterator runs. This index maps the 17 [contract profiles](../type-surface.v1.json)
to ordinary-source and reviewed-interface **installed** results. The task and
stream package and the retained-callback package are often different: the
former proves demand and item delivery, not that callbacks can reenter. Dates
and package identities belong to the linked runs, not to this inventory.
These are local qualifications, not a promotion of today's release archives.

**Current installed coverage: 136/136.** The smaller totals below record
earlier checkpoints. All 17 profiles passed the four signatures on both
author routes. Node #1223 still depends on #1221 for ownership and #1222
for effects.

| Consumer profile | Task, cancellation and iterator witness | Nested callback or teardown witness |
| --- | --- | --- |
| `perl` | [CPAN installs](perl-tasks-20261123.json): a real event loop advances while a Future is pending; demand, early close, typed step failure and cancellation run on installed XS. | [Retained workers](perl-retained-workers-20261123.json): the callback waits for another installed Future; separate retirement runs exercise blocked work on threaded and unthreaded Perls. |
| `node-javascript` | [Jobs and Depot](threaded-task-probe.md): returned errors differ from failed tasks; an item lease survives exhaustion; early return cancels a pending pull. | [Relay and Echo](threaded-task-probe.md#retained-callbacks-on-the-javascript-owner) nest two awaited callbacks, refuse a third outstanding reply and discard replies after shutdown. |
| `node-typescript` | [Executed strict TypeScript](typescript-react-threaded-delivery-20261125.md): no read before demand, early and natural end, typed step failure, explicit cancel wins once. | [Workshop replay](#the-workshop-replay): inner failure and recovery while the outer callback is active; runtime closed before a late reply. |
| `browser-javascript` | [Isolated Chromium page](javascript-threaded-host-regression-9431fd5.json) runs the installed Workshop worker API; [Jobs and Depot](threaded-task-probe.md) exercise task failures and item ownership. | [Relay](threaded-task-probe.md#retained-callbacks-on-the-javascript-owner) exercises nested calls; a separate real pthread failure rejects pending work and prevents reuse. |
| `browser-react` | [Mounted UI](typescript-react-threaded-delivery-20261125.md): early break, actual unmount cancellation and no late UI update. [Workshop replay](#the-workshop-replay) additionally measures demand, natural exhaustion and typed pull failure in a click handler. | Nested calls complete while mounted. Unmount leaves a sibling call usable; explicitly closing the runtime is a different case. |
| `browser-worker` | [Deployed module worker](threaded-task-probe.md#exercise-a-production-browser-worker-deployment): real `for await` early break and exhaustion inside the worker. | The worker runs the two-package callback suite and closes its own runtime while a **different**, still-live page runtime has work pending. |
| `php-native` | [Local Composer packages](php-task-delivery-20261123.json): a pending task yields to the event loop, natural exhaustion, cancelled pulls, errors and retirement are observed by PHP. | [Retained tasks](php-retained-tasks-20261123.json) exercise nested awaits in PHP; [Amp worker installs](php-host-task-packages-20261124.md) separately check application objects. |
| `php-wasm` | [Zend packages](php-wasm-task-packages-20261124.md) distinguish late results, cancellation, typed step errors and actual Lean close counts. | [PHP callbacks](php-wasm-retained-callback-packages-20261124.md) reenter a callback-taking task from Zend. A destroyed pthread heap cannot report a native owner count; it is not reported as zero. |
| `dotnet` | [NuGet](dotnet-tasks-20261122.json): CLR tasks, original cancellation token, demand-driven `IAsyncEnumerable` and owner-loop shutdown. | [Retained callbacks](dotnet-retained-tasks-20261122.json) reenter another callback on the host thread; retirement prevents a late callback from reviving the operation. |
| `java` | [Maven](jvm-tasks-20261123.json): Java subscriber requests, observes items and completion, cancels a blocked pull and sees typed failure. | [Java retained client](jvm-retained-tasks-20261123.json) reenters independently built packages and observes original exceptions and shared retirement. |
| `kotlin` | [Separate Kotlin executable](jvm-tasks-20261123.json): cold Flow, `take(1)`, full collection, typed step exception and cancellation of a blocked collector. | [Kotlin retained client](jvm-retained-tasks-20261123.json) awaits a nested relay and cancels a coroutine. A [late fatal callback](kotlin-callback-fault-20261126.md) retires both components without settling an already-cancelled coroutine a second time. |
| `ruby` | [MRI Fiber scheduler](ruby-fiber-tasks-20261122.json): cancellation wakes both waiters; overlapping pulls, block exceptions, early break and exhausted streams have distinct outcomes. | [Retained workers](ruby-retained-tasks-20261122.json) exercise nested dispatch, revocation and runtime retirement. |
| `python` | [CPython wheels](python-resource-leases-20261123.json): asyncio task and stream leases, cancellation with late results, early close and exhaustion. | [Python retained tasks](python-retained-tasks-20261122.json) call back into a second worker. [Peer wheels](python-worker-wheels-20261124.md) refuse reuse after retirement wins over the pending callback. |
| `rust` | [Offline Cargo install](rust-tasks-20261122.json): native futures, replaced waker, cancellation despite late completion and fused exhaustion. | [Retained task crates](rust-retained-tasks-20261122.json) exercise owner-thread reentry; [installed workers](static-host-workers-20261125.md#installed-rust-futures-and-streams) distinguish callback panic and peer retirement. |
| `c` | [C11 packages](c-task-streams-20261122.json): real `poll(2)`, immediate completion, backpressure, exhaustion, early close, error-as-item versus failed step. | [Retained packages](c-retained-tasks-20261122.json): inside the active callback, the application polls a peer's callback-taking task to completion; separate runs retire pending work. |
| `cpp` | [C++20 packages](cpp-task-streams-20261122.json): `co_await`, one outstanding demand, repeated exhaustion, pending pull cancellation and exactly-once close. | [Retained packages](cpp-retained-tasks-20261122.json) exercise nested waits and shutdown through installed pkg-config and CMake clients. |
| `wit-wasi` | [Installed pollable resources](wit-task-resource-world-20261123.md) and [canonical futures and streams](wit-canonical-async-20261124.md) are distinct. A cancelled parked canonical read does not deliver its late item. | [Installed retained callbacks](wit-task-retained-callbacks-20261123.md) drive another task on the store. Resource close and broker retirement are tested separately; this does not grant arbitrary same-instance Wasmtime reentry. |

## The Workshop replay

The [ordinary](threaded-terminal-delivery-20261125/ordinary.json) and
[reviewed](threaded-terminal-delivery-20261125/reviewed.json) records identify
the original package receipts, deployed Wasm and exact consumer source hashes.
The outer task waits for an inner task that calls the host and fails. It
recognizes the generated task-phase callback error **and the original JS error
object**, then awaits another inner task successfully before returning. In a
fresh binding, closing the runtime with the callback parked produces one
cancellation, zero successes and no remaining owned state after a late reply.
React also checks the finalizer's effect after natural exhaustion and after a
failed pull followed by explicit close. The latter does not distinguish
automatic cleanup on rejection from cleanup requested by the caller.
See the [replay command](typescript-react-threaded-delivery-20261125.md).

A later [ordinary](threaded-pull-cleanup-20261126/ordinary.json) and
[reviewed](threaded-pull-cleanup-20261126/reviewed.json) replay separates
those events. The TypeScript application and mounted React click handler
watch writes to their own meter. Neither program calls `return()` before
inspecting the failed pull. When the typed step error reaches the caller,
Lean has read the meter once and its finalizer has written zero exactly
once. A further pull reports exhaustion; two explicit closes produce no
further read or write. These observations use the same installed Workshop
archives as the earlier replay, with new consumer source hashes.

## Who closed the cursor after a failed pull?

The ordering of the observations matters. A finalizer counter read *after*
the caller disposes a cursor cannot tell us whether the failed pull already
closed it. These earlier installed clients counted the finalizer before
requesting another close:

| Client | What happened before the caller requested close |
| --- | --- |
| [Native PHP](../../tests/fixtures/php-task-resources/installed.php) | Advancing the generator threw `Depot.next`. The Lean close counter was already up by one while both the delivered item and the error payload were live. The application closed the item and read 9 through the error's last lease. Only then did it close the payload and cursor and check baseline. The [installed Composer record](php-task-leases-20261123.json) pins the client source and records 59 checks per process: two PHP versions, two package load orders and both author routes. |
| [Ruby](../../tests/fixtures/ruby-task-resources/consumer.rb) | After the typed step error the payload still referred to the expected resource. In the next assertion Ruby evaluated the Lean counter **before** `stream.close`: the counter was already up by one and close returned false. The same order was checked after natural exhaustion. The early-exit branch explicitly called close, so does not establish automatic cleanup. Both author routes and package load orders appear in the [installed gem record](ruby-resource-leases-20261122.json). |

The PHP and Ruby sources above match the consumer hashes in those original
reports. No new PHP or Ruby package run was needed for this distinction.
The earlier [CPython](../../tests/fixtures/python-task-resources/installed.py)
and [CLR](../../tests/fixtures/dotnet-task-resources/Program.cs) resource
clients checked their final count **after** leaving a context manager or
calling `DisposeAsync()`; don't infer the same ordering from those checks.

Separate installed replays now distinguish terminal cleanup from caller cleanup on both runtimes:

| Consumer | Before the caller disposed the cursor | Evidence |
| --- | --- | --- |
| .NET 8 | Natural exhaustion, typed `Depot.next` failure and a cancellation token set between pulls each incremented the Lean close counter **once**. The cancellation exception carried the original token. The next pull returned false. | [Client](../../tests/fixtures/dotnet-task-resources/Terminal.cs), [ordinary NuGet](dotnet-stream-terminal-20261126/ordinary.json), [reviewed NuGet](dotnet-stream-terminal-20261126/reviewed.json). |
| CPython 3.11 and 3.12 | Natural exhaustion and typed pull failure each incremented the counter **once**; another `anext` saw `StopAsyncIteration`. In the early-exit control, the counter did not move until the application called `aclose`. Python names the exported cursor factory, `Depot.tickets`, on the step exception. | [Client](../../tests/fixtures/python-task-resources/terminal.py), [3.11 wheels](python-stream-terminal-20261126/cpython-311.json), [3.12 wheels](python-stream-terminal-20261126/cpython-312.json). |

Each client kept the cursor and first item in scope and closed the original ticket. After a typed
failure, the delivered item still worked. Closing that item left the error payload usable by the peer;
the peer incremented the ticket to 42. Closing the payload restored the native identity and descriptor
counts **before** any caller-requested cursor disposal. Closing the cursor twice did not repeat the finalizer.

The replay authenticated the original component archives and installed the independent Desk and Depot packages
offline. Both authoring routes ran each package load order in separate processes: four .NET executions and
eight Python executions. Neither result claims a cancellation race with an in-flight pull: the .NET token was
cancelled before requesting the next item, and the new Python check tested early close, not cancellation.

To repeat the checks, point `LEAN_BRIDGE_DOTNET_STREAM_TERMINAL_ORIGINAL` at the original
[NuGet capture](dotnet-resource-leases-20261122.json) and run `node --test tests/helpers/dotnet-resource-installed.mjs`.
For each [CPython capture](python-resource-leases-20261123.json), set `LEAN_BRIDGE_PYTHON_STREAM_TERMINAL_ORIGINAL`
to that ABI's root and `LEAN_BRIDGE_PYTHON` to its interpreter, then run `node --test tests/helpers/python-resource-installed.mjs`.
Fresh captures also run the new clients; historical replay still verifies the original acceptance bytes.

### Cancelling a callback and registering the same function again

The Budget [ordinary](npm-callback-cancellation-20261126/ordinary.json)
and [reviewed](npm-callback-cancellation-20261126/reviewed.json) npm releases
passed in Node, executed strict TypeScript, a Chromium page, mounted React
and a dedicated browser worker. Cancelling before entry never invoked the
application callback. Cancelling after entry rejected the original task
once and drained the runtime **before** the application answered.

The [client](../../tests/fixtures/javascript-callback-cancellation/calls.mjs)
then passed the *same* JavaScript function to a second task. Neither a
late success (777) nor a late exception from its old invocation settled
the new task. A sibling task completed; the replacement waited for its
own reply, returned 42 once, and refused cancellation after settlement.
Frame, allocation, pending-operation, notification and native-owner counts
all returned to zero. This tests a stale callback reply, not an iterator.

Run `npm run test:javascript-callback-cancellation` with the [threaded
toolchain](threaded-task-probe.md), or set
`LEAN_BRIDGE_NPM_CALLBACK_CANCEL_REPLAY` to the retained Budget handoff
directory containing both routes to rerun the installations without a build.

### Cancelling a pull already waiting on Lean

The earlier npm [Jobs client](../../tests/fixtures/javascript-wasm-task-runtime/public-consumer.mjs)
cancels an outstanding JavaScript `next()` and sees one finalizer. Its
[Lean step](../../tests/fixtures/javascript-wasm-generated-tasks/Jobs.lean)
returns `Task.pure`: the client is awaiting delivery, but the item has
already been computed. The [Depot step](../../tests/fixtures/javascript-wasm-resource-tasks/Depot.lean)
likewise returns an already-completed task. Both packages have genuinely
gated *task* exports; those exports are not the iterator step. These runs
do not establish when cancellation settles a reader, runs the finalizer
or frees a native owner if the **iterator's own worker** is still parked.

The separate [Reader fixture](../../tests/fixtures/javascript-parked-reader/Reader.lean)
uses an entry signal and a gate. After entry its [Lean-side check](../../tests/fixtures/javascript-parked-reader/Check.lean)
observed that neither the pending pull nor its completion signal was ready.
Releasing the gate with 71 produced the item 73 (the cursor adds 2), and
closing the cursor ran one finalizer. To run the producer check, use
`lake build Reader` then `lake env lean --run Check.lean` in the fixture
directory. This checks the producer independently of the host scheduler.

Five installed npm clients then [cancelled the same reader](../../tests/fixtures/javascript-parked-reader/calls.mjs):
Node JavaScript, executed strict TypeScript, Chromium, a mounted React
handler and a dedicated browser worker. On both the [ordinary](npm-parked-reader-20261126/ordinary.json)
and [reviewed](npm-parked-reader-20261126/reviewed.json) packages, closing
rejected the outstanding read once. Before release there was one pull, **no**
finalizer and one live native owner. A sibling task completed while both
calls to `return()` waited for cleanup. Lean eventually produced 73 but the
client never received the item. Both closes completed, one finalizer ran,
and all five runtime counters returned to zero. An overlapping pull had been
refused; polling the closed iterator did not generate more demands.

Run `npm run test:javascript-parked-reader` with the [threaded npm author
inputs](threaded-task-probe.md), `LEAN_BRIDGE_TEST_TASK_INPUTS` set to the
prepared SDK, and Playwright Chromium installed. Set
`LEAN_BRIDGE_NPM_PARKED_READER_KEEP` to an existing directory to retain both
handoffs, or `LEAN_BRIDGE_NPM_PARKED_READER_REPLAY` to the reported handoff
directory to rerun the installs without rebuilding.

On CPython, the [Timers client](../../tests/fixtures/python-lean-tasks/cancel_pull.py)
waited until Lean had entered the pull, the reader was pending and two native
leases were live. Cancelling the reader preserved its cancellation message.
Before the caller used `aclose()`, the Lean finalizer had run once and the
event-loop descriptors had returned to baseline. A cooperative worker stopped.
A worker that ignored cancellation kept one lease until explicitly released,
computed the late result, and then released the lease. Neither delivered an
item or settled the reader twice. Repeated close did not repeat the finalizer.

| Linux interpreter | Ordinary wheel | Reviewed wheel |
| --- | --- | --- |
| CPython 3.11 | [Execution record](python-parked-pull-20261126/cp311-ordinary.json) | [Execution record](python-parked-pull-20261126/cp311-reviewed.json) |
| CPython 3.12 | [Execution record](python-parked-pull-20261126/cp312-ordinary.json) | [Execution record](python-parked-pull-20261126/cp312-reviewed.json) |

To reproduce, set `LEAN_BRIDGE_PYTHON_PARKED_PULL_ORIGINAL` to the original
Timers capture containing `tasks/` and `wheels/`, and `LEAN_BRIDGE_PYTHON` to
each interpreter in turn. Run `node --test tests/helpers/python-parked-pull-installed.mjs`.
The replay checks the original archive identities and installed files before
running the new client offline. This stream delivers copied items; the
resource-bearing Desk/Depot checks above are separate.

The [.NET Pulse client](../../tests/fixtures/dotnet-tasks/Program.cs) also
waited for Lean to enter a pull. A second concurrent pull was rejected.
Cancellation from another thread woke the reader with its original token;
the noncooperative worker later finished. Disposing a different cursor with
a parked reader also woke it. That [installed NuGet record](dotnet-tasks-20261122.json)
checked the close count **after** disposal, not before it.

A [second C# client](../../tests/fixtures/dotnet-tasks/Parked.cs) checked the count **before**
disposal. Once Lean entered the pull, another thread cancelled the token. The waiting reader
received the original token and the Lean finalizer had already run once, even though the
worker was still waiting. A separate installed package could still return an item. When
the worker was released, it finished without delivering a late item; native live owners
returned to zero. On a fresh cursor, disposing first woke the reader instead. Further
pulls stayed terminal and repeated disposal did not run the finalizer again.
Both package load orders passed on the [ordinary](dotnet-parked-pull-20261126/ordinary.json)
and [reviewed](dotnet-parked-pull-20261126/reviewed.json) NuGet packages.

To replay with the .NET 8 SDK, set `LEAN_BRIDGE_DOTNET_TASK_REPLAY` to the original
Pulse capture directory containing `acceptance.json`, `LEAN_BRIDGE_DOTNET_TASK_EXPECTED`
to `docs/evidence/dotnet-tasks-20261122.json`, and `LEAN_BRIDGE_DOTNET_PARKED_PULL=1`.
Run `node --test --test-name-pattern='both exact task packages' tests/helpers/dotnet-io-installed.mjs`.
The replay verifies the original installed package and assembly identities, builds the
second client separately, and runs it without the feed, project, package cache or build tools.

### The same blocked pull in Java and Kotlin

The [Java subscriber](../../tests/fixtures/jvm-tasks/Parked.java) waits until
Lean starts a pull that ignores cancellation. Cancelling its subscription
from another thread closes the Lean cursor exactly once and sends the
subscriber **no** notification. On a second cursor, requesting zero instead
closes it and signals **one** `IllegalArgumentException`. A peer package can
still run while the worker is waiting. Releasing the worker, requesting more
items, or cancelling again produces no further signal.

The [Kotlin collector](../../tests/fixtures/jvm-tasks/ParkedFlow.kt) cancels a
coroutine that is already collecting. It observes the application's cancellation
message, not normal flow completion. Its cursor closes once in both the
cooperative and noncooperative cases; the latter worker finishes only when
released. Neither emits a late item. Each Java and Kotlin process measured
zero live native owners and returned to its initial event-descriptor count.

Both clients ran in separate JVMs in both package load orders against the
[ordinary](jvm-parked-pull-20261126/ordinary.json) and
[reviewed](jvm-parked-pull-20261126/reviewed.json) Timers and peer Alarm JARs.
To replay, use the JDK, Kotlin compiler, offline Maven seed, and original
handoffs in the [Maven acceptance instructions](jvm-tasks-20261123.json).
Set `LEAN_BRIDGE_JVM_TASK_REPLAY` to that capture, `LEAN_BRIDGE_JVM_TASK_EXPECTED`
to `docs/evidence/jvm-tasks-20261123.json`, and `LEAN_BRIDGE_JVM_PARKED_PULL=1`.
Run `node --test --test-name-pattern='installed task JARs deliver' tests/helpers/jvm-tasks-acceptance.mjs`.

### Cancelling the pending Perl Future

The [installed Perl client](../../tests/fixtures/perl-tasks/parked.pl) waits until
Lean is inside the pull. A second request fails without advancing the stream.
Cancelling the first `Future` runs the Lean cursor finalizer **before** the
application closes the cursor or releases the worker. Closing the cursor first
also cancels the reader. Each path produced one cancellation and one settlement,
no value or failure, and no second finalization after the worker completed.
The independently installed Signals package delivered an item while Pulse was
still blocked; both live native owners and the descriptor delta returned to zero.

Both the [ordinary](perl-parked-pull-20261126/ordinary.json) and
[reviewed](perl-parked-pull-20261126/reviewed.json) packages ran on threaded
and unthreaded Perl 5.36.3 and 5.38.2, with both package load orders: 16
processes, each testing both ways of stopping. This uses prebuilt XS; it is
not a test of locally compiled XS.

What happens if the **callback** cancels its own task? In the separately
installed Retained package, self-cancellation prevented a second invocation.
Cancellation during reply conversion won over the value being converted and
left the runtime usable. Closing the registration *inside* a callback instead
allowed its in-flight reply to finish; the next invocation saw the closure.
Two concurrently failing owners each delivered their own error and settled
once. [Public callback TAP](perl-retained-tap-20261127/public.tap)
and [retirement TAP](perl-retained-tap-20261127/retirement.tap) distinguish
those outcomes from a queued callback rejected after runtime retirement.

The byte-identical transcripts are stored once per distinct result. Across
both author routes and four Perl ABIs, the public, registration and retirement
suites have **704 passed assertions and 16 explicit skips**. The four
[foreign-interpreter assertions](perl-retained-tap-20261127/registration-threaded.tap)
ran on threaded builds; the [unthreaded transcript](perl-retained-tap-20261127/registration-unthreaded.tap)
skips them. Set `LEAN_BRIDGE_PERL_CALLBACK_CAPTURE_AUDIT` to the original
Retained capture when running `node --test tests/helpers/perl-php-async-reconciliation.mjs`
to match all 24 original result files. This is task-owner evidence, not a
conclusion about a synchronous XS call or a fresh release.

To replay, set `LEAN_BRIDGE_PERL_PARKED_ORIGINAL` to the directory with the
[original pinned handoffs and acceptance record](perl-tasks-20261123.json),
`LEAN_BRIDGE_PERL_TASK_DEPS` to the installed Future and IO::Async library
directory, and `LEAN_BRIDGE_PERLS` to a JSON array of the four interpreter
paths. Run `node --test tests/helpers/perl-parked-pull-installed.mjs`.
Fresh full CPAN task captures run the same client; historical captures replay
only the clients they originally recorded.

### Interrupting a parked Ruby reader

In installed MRI 3.3.12, a [reader fiber](../../tests/fixtures/ruby-task-lab/parked.rb)
was waiting inside `stream.each` while a Lean pull ignored cancellation.
Raising the application's exception in that fiber preserved the original exception
object. Closing a second cursor from outside its reader instead woke the reader
with the package's `Cancelled` exception. In both cases a concurrent pull was
refused, the Lean finalizer ran once before the worker was released, and an
independently installed gem delivered an item while the worker was still parked.
No late item arrived; the scheduler, live owners and event descriptors returned
to baseline in both load orders on [ordinary](ruby-parked-pull-20261126/ordinary.json)
and [reviewed](ruby-parked-pull-20261126/reviewed.json) packages.

To replay, set `LEAN_BRIDGE_RUBY_PARKED_ORIGINAL` to the directory containing
the [original acceptance record and three handoffs](ruby-fiber-tasks-20261122.json)
and `LEAN_BRIDGE_RUBY` to the matching interpreter. Run
`node --test tests/helpers/ruby-parked-pull-installed.mjs`.

### Stopping a parked native PHP reader

The [Amp client](../../tests/fixtures/php-tasks/parked.php) starts a real
`foreach` against a [gated Lean pull](../../tests/fixtures/c-lean-tasks/Pulse.lean).
It waits until the worker has entered the gate, then attempts a second read:
PHP refuses it and the Lean pull count stays at one.

Cancelling the operation token wakes the reader with the token's original
`CancelledException`, including the application's cause. Closing the cursor
instead wakes it with the package’s closed-during-pull error. Both paths
increment the Lean finalizer counter once *before* releasing the worker.
An [independently compiled package](../../tests/fixtures/php-tasks/Signals.lean)
returns 42 while that worker is still waiting. Releasing it does not deliver an
item or replace the original failure. Re-reading and repeated close add no
pulls or finalizers. Native owners and descriptor counts return to baseline.

The [ordinary](php-parked-pull-20261126/ordinary.json) and
[independently reviewed](php-parked-pull-20261126/reviewed.json) packages ran
on PHP 8.2.35 and 8.5.10 with Amp 3.1.3 and Revolt 1.1.0. Each PHP version
ran in both package load orders: eight relocated applications and sixteen
blocked-read interruptions. These are native Composer installs, not PHP-Wasm.

Run `npm run test:php-parked-pull` with the native PHP publisher inputs
and the [pinned Amp and Revolt cache](php-host-task-packages-20261124.md#reproduce).
Use `LEAN_BRIDGE_TEST_PHPS` for a JSON array of PHP CLI executable paths.
Set `LEAN_BRIDGE_PHP_PARKED_HANDOFFS` to retain the archives. To repeat just
the offline install and client, unset that variable and point
`LEAN_BRIDGE_PHP_PARKED_REPLAY` at the reported handoff directory.

### Who owns a blocked native pull?

Closing a stream and discarding one waiter are different operations. The
November 22 installation records establish the following:

| Consumer action | What the installed program observed |
| --- | --- |
| C: close the cursor | The [C client](../../tests/fixtures/c-lean-tasks/consumer.c) waited for the worker and polled the still-pending cursor. Closing it immediately invalidated the borrowed file descriptor (`EBADF`). The Lean finalizer count rose from two to three **before** the client opened the gate. The worker then finished. [Ordinary and reviewed installs](c-task-streams-20261122.json) used both pkg-config and CMake. |
| C++: destroy the stream, keep the pending step | The [C++ client](../../tests/fixtures/cpp-lean-tasks/consumer.cpp) moved the stream onto a second thread and destroyed it there. Back on the owner thread, the outstanding step threw `Cancelled`. Lean reported exactly one extra finalizer before the client released the worker. [Both routes](cpp-task-streams-20261122.json) ran through pkg-config and CMake. |
| Rust: drop only the future returned by `next()` | In the [archived Rust client](https://github.com/seanmorris/lean-bridge/blob/bcce2f989b19f7e83247e19920b27c62429547d8/tests/fixtures/rust-task-lab/pulse_checks.rs), a replacement reader received an item from the **same** Lean pull. The client closed the stream *after* receiving that item. The [two-crate installation](rust-tasks-20261122.json) ran this particular check on the ordinary crate; using the reviewed peer elsewhere in that executable does not extend this result to that peer. |

### Replacing the Rust waiter versus closing its owner

A [new installed client](../../tests/fixtures/rust-task-lab/parked_stream.rs)
ran on the original Cargo archives in both package orders. It exercised
each package as the stream owner, with the other available as a peer. The
[execution record](rust-parked-pull-20261126.json) identifies the archives,
client and all twelve observations. Each recorded exactly one Lean pull and
one cursor finalizer.

- Dropping the pending `next()` future preserved the cursor. A replacement
  reader registered its own waker; the stream released the old waker. Opening
  the gate woke the replacement and returned the original item.
- Explicit `close()` finalized the cursor **before** the gate opened. A new
  waiter immediately returned `None`. Repeated close and eventual drop did
  not repeat the finalizer.
- Dropping the stream itself also finalized before the gate opened. There
  was no stream left to poll. Both stop paths released the last executor
  waker, and the other package completed a task while the first worker was
  still blocked. A later task on the original package succeeded.

To replay, set `LEAN_BRIDGE_RUST_TASK_REPLAY` to the original two-crate
handoff and `LEAN_BRIDGE_RUST_TASK_PARKED_OUTPUT` to an output directory.
Run `node --test tests/helpers/rust-task-installed.mjs` with the
[locked Cargo dependencies](rust-tasks-20261122.json) available. The harness
runs the historical client unchanged and the new client as a separate
relocated binary. Neither has the build tree or Cargo on its path.

## Count for managed task, cancellation and async-iterator signatures

On **.NET, Java and Kotlin**, the installed clients below exercise all
three signatures on both author routes. That is 18 profile/route/signature
combinations in addition to the 34 synchronous-iterator combinations
already qualified across all profiles: **52/136** before counting the
[native scripting clients](#count-for-perl-and-native-php) below.

| Consumer | What the installed application observed |
| --- | --- |
| .NET 8 | [Pulse and Signals](dotnet-tasks-20261122.json) awaited real Lean tasks, cancelled cooperative and noncooperative workers from another thread, preserved the original cancellation token, and enforced one outstanding pull. Both [parked](dotnet-parked-pull-20261126/ordinary.json) [replays](dotnet-parked-pull-20261126/reviewed.json) used those same NuGet packages. A [separate resource client](dotnet-stream-terminal-20261126/ordinary.json) observed terminal cleanup before disposing the cursor; [Feedback](dotnet-retained-tasks-20261122.json) exercised nested callbacks, original exceptions and shared shutdown. |
| Java 22 | The [Maven clients](jvm-tasks-20261123.json) exercised futures and subscriber demand in both package load orders. On the original [ordinary](jvm-parked-pull-20261126/ordinary.json) and [reviewed](jvm-parked-pull-20261126/reviewed.json) Timers packages, a blocked subscription stayed silent when cancelled and invalid demand signalled exactly once. The worker completed late without leaking an owner or descriptor. |
| Kotlin 2.2 | A separate compiled application on the same Maven installs awaited suspend functions, collected a cold Flow, stopped after the first item, and distinguished an error item from a typed step failure. Its parked collector received no late item after job cancellation. The [retained JVM clients](jvm-retained-tasks-20261123.json) separately invoked nested callbacks and observed exception identity, cancellation and retirement in each language. |

Run `node --test tests/helpers/managed-delivery-reconciliation.mjs` to
recheck the original capture digests, the clients that actually ran, both
author routes, both load orders, and the package identities in each replay.
This is a reconciliation of installed runs, not a new SDK build. The
evidence applies to the tested CLR owner loop and JVM schedulers on
Linux x86-64. It does not assume that results carry over to a different
scheduler, optional package feature, or release.

## Count for Perl and native PHP

Both source routes now qualify for tasks, cancellation and async iterators
in two more profiles. Four Perl ABIs and two PHP versions are **not six
separate profiles**. These add 12 combinations: **64/136 (47%)** including
the managed clients and synchronous iterators above.

- **Perl:** The [installed public and peer tests](perl-tasks-20261123.json)
  exercised IO::Async progress, terminal errors, one pull per demand,
  exhaustion and closing a pending cursor. The [parked-pull replay](#cancelling-the-pending-perl-future)
  matches those exact Pulse receipts and installed XS binaries across
  all four ABIs. An early close or cancelled Future finalized once and
  rejected the late item; its peer stayed usable. A [separate installed
  callback suite](perl-retained-workers-20261123.json) tested nested waits,
  registration and retirement. No claim here about a different event loop.
- **Native PHP:** The [Amp task clients](php-task-delivery-20261123.json)
  and [callback clients](php-retained-tasks-20261123.json) ran on PHP 8.2
  and 8.5. Cancellation during a callback suppressed its reply; shutdown
  left no owners. The [leased stream](php-task-leases-20261123.json) closed
  on step failure while the payload remained usable. The [gated Pulse
  build](#stopping-a-parked-native-php-reader) tested actual blocked reads
  in both package orders with both a token and explicit close. It is a
  separate build, not a replay of the scalar Pulse archive or a Zend result.

`node --test tests/helpers/perl-php-async-reconciliation.mjs` checks the
actual consumer source digests, original route records, runtimes, and
observations. This does not rebuild those packages or promote a release.

## Count for the five npm clients

All five clients qualify for Task, cancellation and async iteration on
both author routes. Combined with the earlier profiles, that is
**94/136 (69%)**: synchronous iterators everywhere, plus the three async
contracts in ten profiles. Each row below answers a different question;
the three fixtures are separate releases.

| Installed package | What the callers established |
| --- | --- |
| Workshop and peer | The [public client at the recorded revision](https://github.com/seanmorris/lean-bridge/blob/9431fd59c410a87e1b1ea72767b477f8f3c4805a/tests/fixtures/javascript-threaded-host/calls.mjs) ran in Node JavaScript, a Chromium page and a deployed module worker. It caught a typed step failure, observed exhaustion and early close, cancelled pending work, then distinguished closing a binding from retiring the runtime. The [separate TypeScript and React replay](#the-workshop-replay) on those Workshop archives checks the original callback error, automatic finalization and actual unmount. |
| Budget | All five clients ran the same [callback registration and cancellation races](#cancelling-a-callback-and-registering-the-same-function-again). An old reply did not settle a replacement or prevent an independent task from running. |
| Reader | All five [cancelled a genuinely parked Lean pull](#cancelling-a-pull-already-waiting-on-lean); a second demand could not take its result, and cleanup waited for the actual worker. |

`node --test tests/helpers/npm-async-reconciliation.mjs` checks the
observations and source digests. For the archive check as well, supply
`LEAN_BRIDGE_JS_DELIVERY_RELEASES` (Workshop and peer),
`LEAN_BRIDGE_NPM_ONCE_CALLBACK_REPLAY` (Budget) and
`LEAN_BRIDGE_NPM_PARKED_READER_REPLAY` (Reader). The check verifies seven
original package receipts and extracts the module bytes from each archive
to compare with the deployment records where those are available. The
Node worker control does not count as a sixth profile.

## Count for C and C++

The [C11 client](../../tests/fixtures/c-lean-tasks/consumer.c) and the
[C++20 client](../../tests/fixtures/cpp-lean-tasks/consumer.cpp) each ran as
the primary consumer of the ordinary package and, separately, the reviewed
package. Each release was installed two ways: pkg-config and CMake. Their
[C](c-task-streams-20261122.json) and [C++](cpp-task-streams-20261122.json)
records distinguish an error returned as an item from a terminal step
failure, check demand and exhaustion, and exercise disposal during a pull.
C verified that closing a pending stream invalidated its borrowed descriptor
and closed the cursor once. C++ destroyed the stream on another thread;
the outstanding read reported cancellation before Lean's late completion.

The [retained C](c-retained-tasks-20261122.json) and [retained C++](cpp-retained-tasks-20261122.json)
clients also drove a second component in a callback. Their isolated processes
covered retirement and cancellation during callback dispatch. These paired
tests exercised both packages together; they did not swap roles for every
fault. The callback suite and the plain task/stream suite used different releases.

`node --test tests/helpers/native-async-reconciliation.mjs` matches the
actual clients and the installed examples. To check all eight original
archives and their receipts, set `LEAN_BRIDGE_C_TASK_REPLAY_DIR` and
`LEAN_BRIDGE_CPP_TASK_REPLAY_DIR` to the plain release directories, and
`LEAN_BRIDGE_C_CALLBACK_RELEASES` and `LEAN_BRIDGE_CPP_CALLBACK_RELEASES`
to the retained-callback release directories. It reads the original
installation results and hashes the archives; it does not rerun the executables.

These two profiles add **12** combinations across the three async families
and two authoring routes: **106/136 verified**, with Rust, Python, Ruby,
WIT/WASI and PHP-Wasm still to qualify beyond synchronous iteration.

## Count for CPython and Ruby

Both profiles ran task settlement, cancellation and asynchronous iteration on
**each** authoring route. Those 12 combinations bring the verified count to
**118/136**. The remaining async profiles are Rust, WIT/WASI and PHP-Wasm.

- **CPython 3.11 and 3.12:** The original Timers packages ran the
  [task client at the recorded revision](https://github.com/seanmorris/lean-bridge/blob/db03667971f5303d56c10b07045647d91682ade3/tests/fixtures/python-lean-tasks/installed.py)
  and the stream client. Lookups by receipt and actual wheel hash match
  the [parked cancellation replay](#cancelling-a-pull-already-waiting-on-lean) on all four installs.
  Separate [callback wheels](python-retained-tasks-20261122.json) checked
  nested dispatch, exceptions and suppression after retirement. Desk and Depot
  exercised resource-bearing streams in both package orders. Their terminal
  and failure checks ran **before** explicit close; on early exit the caller
  had to request close. The third lookalike wheel was verified at install,
  not treated as a third stream producer.
- **Ruby 3.3:** The [Pulse gems](ruby-fiber-tasks-20261122.json) ran both as
  primary packages. The [parked reader](#interrupting-a-parked-ruby-reader)
  distinguished a caller-raised exception from external cursor cancellation.
  The separate [Feedback and Relay installs](ruby-retained-tasks-20261122.json)
  checked nested calls and cleanup in both load orders. In the
  [leased Depot streams](ruby-resource-leases-20261122.json) the cursor had
  already finalized when the caller inspected its returned error payload;
  later cleanup left no live identities.

`node --test tests/helpers/python-ruby-async-reconciliation.mjs` checks the
original terminal acceptance records against the recorded clients, package
identities and replay observations. It does not rebuild any package. Set the
following variables to the matching original captures:

| Profile | Direct tasks | Retained callbacks | Leased results |
| --- | --- | --- | --- |
| CPython | `LEAN_BRIDGE_PYTHON_PARKED_PULL_ORIGINAL` | `LEAN_BRIDGE_PY_ASYNC_RETAINED` (contains `cpython-311/`, `cpython-312/`) | `LEAN_BRIDGE_PY_ASYNC_LEASES` (contains `cp311/`, `cp312/`) |
| Ruby | `LEAN_BRIDGE_RUBY_PARKED_ORIGINAL` | `LEAN_BRIDGE_RB_ASYNC_RETAINED` | `LEAN_BRIDGE_RB_ASYNC_LEASES` |

### Rust: both authoring routes as the primary task owner

The [installed Cargo replay](rust-async-owners-20261126/owners.json) ran the
original downstream program twice. On the first run its `task_lab` import
resolved to the ordinary crate; on the second it resolved to the reviewed
crate. Cargo's locked, offline dependency graph identified both packages in
each run. Only the dependency aliases changed; the application, its callback
checks, the crates and the lock file did not. Each primary handled task
settlement, cancellation, stream exhaustion and typed errors, retained
callback invocation, and cleanup across the two crates.

The [parked-reader record](rust-parked-pull-20261126.json) is a separate
pair of releases. On each route the consumer replaced the pending reader's
waker, closed a pending stream and dropped its owner. Every case observed one
Lean pull and one finalizer; closing did not deliver the late item. Neither
test substitutes a mock executor for the installed Lean producer.

To repeat the dual-owner check, set `LEAN_BRIDGE_RUST_TASK_REPLAY` to the
original callback-capable release directory and `LEAN_BRIDGE_RUST_TASK_DUAL_OUTPUT`
to a fresh output directory, then run
`node --test --test-concurrency=1 tests/helpers/rust-task-installed.mjs`
with the offline [Cargo prerequisites](rust-retained-tasks-20261122.json).
This adds six combinations, for **124/136**. WIT/WASI and PHP-Wasm remain.

### Interrupting a parked reader in wasm32 PHP

The PHP-Wasm cursor now separates requesting cancellation from waiting for
cleanup. A PHP callback can call `$cursor->cancel()` without waiting for the
Lean worker. `$cursor->close()` still waits; call it outside the pending
read and after releasing any gate your application controls.

The [Zend state-machine control](../../tests/fixtures/php-wasm-task-owner/cursor-cancel-state.php)
checks that a cancelled reader does not deliver a buffered value, discards
an unclaimed leased value once and does not mask an existing terminal fault.
That control uses PHP fibers as the transport; it is not an installed Wasm run.

For the installed test, run `npm run test:php-wasm-parked-reader` with the
[threaded PHP-Wasm prerequisites](php-wasm-task-packages-20261124.md#reproduce),
including `LEAN_BRIDGE_JS_TASK_INPUTS` pointing to the verified pthread SDK.
The [PHP application](../../tests/fixtures/php-wasm-task-owner/parked.php)
receives a callback only after the Lean reader signals entry. It checks a
sibling task before releasing the gate and checks both late computation and
cleanup afterward. Set `LEAN_BRIDGE_ZEND_READER_KEEP` to an existing directory
to retain the handoffs; set `LEAN_BRIDGE_ZEND_READER_REPLAY` to the directory
containing both handoffs to rerun the consumer checks.

The [ordinary](php-wasm-parked-reader-20261126/ordinary.json) and
[reviewed](php-wasm-parked-reader-20261126/reviewed.json) releases each
passed this test in Node (bundled PHP and Composer) and Chromium. The
callback interrupted a `foreach` already waiting for its first item; a
second cancellation did nothing. Before opening the gate the PHP app saw
zero items, one Lean pull, no close, and an independent task delivered 42.
The noncooperative pull subsequently computed 73, but the cancelled reader
never delivered it. Cleanup closed that cursor once and left zero live owners.
Chromium separately verified that losing the worker rejected pending and new
PHP work; it cannot count native owners inside a destroyed Wasm heap.

The same executions cover the [Jobs terminal and failure cases](php-wasm-task-packages-20261124.md);
the [two-package callback runs](php-wasm-retained-callback-packages-20261124.md)
cover nested host callbacks on their own identified releases. PHP-Wasm's six
combinations bring the installed total to **130/136**. Only WIT/WASI remains
for task delivery, cancellation and async iteration on both author routes.

### WIT/WASI: both delivery interfaces and independently built peers

Four offline installs re-ran the same throwing Lean cursor: the pollable
resource ([ordinary](wit-async-installed-20261126/native-wit-task-v1-ordinary.json),
[reviewed](wit-async-installed-20261126/native-wit-task-v1-reviewed.json))
and the canonical stream ([ordinary](wit-async-installed-20261126/native-wit-canonical-task-v1-ordinary.json),
[reviewed](wit-async-installed-20261126/native-wit-canonical-task-v1-reviewed.json)).
Each consumer distinguished returned error data, an IO step failure, a
declared step failure and exhaustion. Dropping early was the fourth close:
each of four opened cursors finalized once. The records identify the actual
client, release archive and interface. The route comes from the compiler
metadata and reviewed interface inside the installed archive.

The [peer replay](wit-async-installed-20261126/peers.json) ran the ordinary
and reviewed Workshop and Gauge packages in all four pairings and both load
orders. With a real Gauge read parked, the guest cancelled that reader;
Workshop's pending callback future still returned the original box updated
to 73. The eight error runs observed one guest error issued and one destroyed.
Another 32 runs changed factory and read order: the surviving registration
was invoked once, the cancelled one never ran, and both released all their
acquisitions. The four negative controls rejected a trap, a private scheduler
import, a missing provider and a duplicate interface. The record contains
package order, guest digests and actual output or exit code for all 52 launches.

Retirement is a different observation: the [original Depot/Peer installs](wit-task-retained-callbacks-20261123.md#retire-the-shared-runtime-with-two-packages-installed)
refused further work both before observation and inside an executing callback
on each author route. Those are not the Workshop and Gauge archives.

For #1221, [two installed Tariff packages](wit-function-fields-20261126.md)
separately establish how a Wasmtime callback borrows a Lean-created function:
an explicitly retained function survives even when the callback fails;
the borrowed view expires at return. That synchronous result and the
Workshop/Gauge registration-destruction counts above answer different
questions. Neither establishes that a call-scoped borrow can be used later
by a pending task.

To repeat the new replays, set `LEAN_BRIDGE_WIT_CURSOR_REPLAY` to each
original Watch handoff and `LEAN_BRIDGE_WIT_CURSOR_OBSERVATIONS` to a fresh
output directory for `npm run test:wit-cursor-io`. For the pair, set
`LEAN_BRIDGE_WIT_ASYNC_PEER_REPLAY` to the [original four handoffs](wit-host-objects-20261125.md#two-installed-worker-packages-cancel-one-reader)
and `LEAN_BRIDGE_WIT_PEER_OBSERVATION` to a new JSON filename before running
`npm run test:wit-async-peer-packages`.

The six WIT combinations complete the installed signature count:
**136/136** (four families × 17 profiles × two authoring routes). That
does not complete the upstream ownership and error work or certify a
particular hosted release.

## Closure boundary

All 17 profiles have [separate installed synchronous iterator evidence](host-worker-qualification-20261125.md#checks-before-closing-the-nodes)
on both author routes. Do not use that count for tasks or async iterators.
The table locates actual execution evidence for each async profile; it does
not claim that every case ran on one archive, every optional scheduler is
supported, or that every source revision is interchangeable. Before marking
#1223 done, resolve the ownership and failure dependencies (#1221 and #1222)
and reconcile accepted runtime prerequisites and case-level gaps with those
results. The full exact-release matrix belongs to #1224.
