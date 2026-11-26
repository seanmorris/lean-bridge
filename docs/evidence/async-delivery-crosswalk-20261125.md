# Installed async delivery, by consumer

VO #1223 asks what an application actually observes when a task, callback or
iterator runs. This index maps the 17 [contract profiles](../type-surface.v1.json)
to ordinary-source and reviewed-interface **installed** results. The task and
stream package and the retained-callback package are often different: the
former proves demand and item delivery, not that callbacks can reenter. Dates
and package identities belong to the linked runs, not to this inventory.
These are local qualifications, not a promotion of today's release archives.

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

## Closure boundary

All 17 profiles have [separate installed synchronous iterator evidence](host-worker-qualification-20261125.md#checks-before-closing-the-nodes)
on both author routes. Do not use that count for tasks or async iterators.
The table locates actual execution evidence for each async profile; it does
not claim that every case ran on one archive, every optional scheduler is
supported, or that every source revision is interchangeable. Before marking
#1223 done, resolve the ownership and failure dependencies (#1221 and #1222)
and reconcile accepted runtime prerequisites and case-level gaps with those
results. The full exact-release matrix belongs to #1224.
