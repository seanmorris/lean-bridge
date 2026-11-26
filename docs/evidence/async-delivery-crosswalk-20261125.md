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
| `kotlin` | [Separate Kotlin executable](jvm-tasks-20261123.json): cold Flow, `take(1)`, full collection, typed step exception and cancellation of a blocked collector. | [Kotlin retained client](jvm-retained-tasks-20261123.json) awaits a nested relay, cancels a coroutine and retires the runtime while a callback is blocked. |
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

## Closure boundary

All 17 profiles have [separate installed synchronous iterator evidence](host-worker-qualification-20261125.md#checks-before-closing-the-nodes)
on both author routes. Do not use that count for tasks or async iterators.
The table locates actual execution evidence for each async profile; it does
not claim that every case ran on one archive, every optional scheduler is
supported, or that every source revision is interchangeable. Before marking
#1223 done, resolve the ownership and failure dependencies (#1221 and #1222)
and reconcile accepted runtime prerequisites and case-level gaps with those
results. The full exact-release matrix belongs to #1224.
