# Guest-owned WIT objects in compiled Lean workers

The [application](../../tests/fixtures/static-host-workers/guest-box.wat.in) defines a mutable resource; only the defining guest knows where it keeps the value. A [second, independently compiled guest](../../tests/fixtures/static-host-workers/guest-peer.wat.in) imports the resource via WIT and returns an independently droppable alias. The worker checks below use private integrations. The [synchronous](#run-the-installed-synchronous-object-package) and [mixed async](#run-the-installed-mixed-object-package) release checks use ordinary and reviewed archives.

The [integration probe](../../tests/fixtures/static-host-workers/guest-box.c) runs the composed component under Wasmtime 42 and calls the actual compiled Lean library. A Lean task returns the original object. A retained callback re-enters Lean, changes its value, and leaves a second, equal-valued object untouched. Rebinding the same resource type preserves identity; a distinct defining instance in the same store and an instance in a different store are rejected.

The probe counts guest destructor calls, closes stores with outstanding references, and checks that dropping invalidated slots does not access a deleted store. A guest destructor that traps poisons the adapter: no further guest call is admitted, and closing the store still releases the remaining wrappers. No Lean compiler, Wasm tool or network access is required by the resulting probe executable.

To reproduce from the worktree, set `LEAN_BRIDGE_LEAN_PREFIX` and `LEAN_BRIDGE_WASM_TOOLS` to the project toolchains. Set `LEAN_BRIDGE_WASMTIME_C_API` to the Wasmtime 42 C SDK and `LEAN_BRIDGE_ASYNC_WASMTIME_C_API` to the Wasmtime 51.0.0 C SDK, then run:

```sh
npm run test:wit-host-object-source
node --test --test-concurrency=1 --test-name-pattern='wit-wasi workers' tests/helpers/static-worker-elaboration.mjs
npm run test:wit-host-object-workers
```

The synchronous source check compiled ordinary and independently reviewed Lean source to binding IR `4554b3af605c60788485c71cd38438c762e292d9e43cd27b42ebaf34ad90bf40`. The worker source check produced `05d5d67c6a46aa2358c6ffedf69cb9274a7bf373dbd594a89a4919bf9ed27e32` on both routes. It rejected indirect member calls off the owner, both in the task body and in the cursor pull.

The worker integration passed with 43 exported native symbols. The SHA-256 digests were `ad76ddd8dd1a943ed544bc3a7e5565311eec1b3739530135d0daff15a5af9fac` (worker), `87cf27a7501b8595987b5e067d408cfbb582909af302ccde098a7a6508e258f2` (WIT owner domain), and `39f751ace1626f07fe8ef74b757428d6c4fc7e7b87739ab252107122d2018381` (task lease library).

The follow-up [member binder](../../src/backends/wit/application-member-bindings.mjs) resolves the actual guest methods before creating a Lean binding. The probe invokes the named entries from that table. Three separately validated Wasm components use the expected interface and method names but change the getter's signedness, the identity method's success resource, or the read method's error resource. All three fail to bind without executing a member or poisoning the store. The rebuilt worker SHA-256 is `ec44bd8bdae1625f80cff83acc74ded602d915ed5eab4fa3e085e95b92476665`; the owner domain and lease library are unchanged.

The [generated member adapters](../../src/backends/wit/application-member-dispatch.mjs) connect Lean to guest methods without a handwritten member table. They compare object identities through the defining guest and retain an independent guest owner when passing an owned argument. The expanded probe passed a leased parameter, a transferred parameter, a receiver-anchored alias, UTF-8 text, binary data containing zeros and a negative 385-bit integer through real guest member calls. A foreign native object was rejected before guest entry without making the binding unusable.

Two distinct guest constructor failures can occur inside [one Lean call](../../tests/fixtures/static-host-workers/wit-members.lean.in). In both call orders the consumer recovered the original error Lean selected, not the last error the guest produced. The other error's destructor ran before the consumer received its result. Mapping a guest error to a Lean `EIO String` instead returned the mapped string and released the original guest error. This extended private build had 52 native exports and worker SHA-256 `c54542ba06ac8e693f6a314068fc285ad6ffb213120e7c1e800a9877bb895d60`.

The [Wasm consumer](../../tests/fixtures/static-host-workers/lean-consumer.wat.in) now calls two compiled Lean operations through its own imported WIT interface. It has no access to the native embedding or its [private resource exchange](../../src/backends/wit/application-exchange.mjs). The defining guest, exchange, operation facade and consumer are compiled separately and connected by their WIT types. No native substitute destructor is registered. The consumer asks Lean to change a box, reads the new value through the defining guest, and drops the box itself. The guest records exactly three drops: the native binding’s owner, the independent lease for the update, and the consumer’s owner.

On failure, the consumer calls the original error’s WIT message method and drops that error itself. Both failure orders run in the same store. Each produces exactly two guest destructor calls — one for the error Lean caught and one for the error the app received. A subsequent successful call checks that a declared failure did not poison the binding.

The exchange rejects wrong-type owners and occupied destinations without consuming them; two owners of the same type come back in stack order with their identities intact. An empty take traps and retires the binding. A separate fault-injection case arms the original guest destructor during duplicate interning: the tentative native reference is rolled back, the destination stays empty, and no native box remains registered after the caller releases its original ticket.

The worker in this two-operation run has SHA-256 `08cf10e2dcb54e7e2f6a29fa675ea2cf87dd15806dec96131aacb08b47f94c34` and 52 native exports. The owner domain and lease library digests are unchanged.

### Generated synchronous consumer interface

The [operation generator](../../src/backends/wit/application-operation-files.mjs) replaces the two handwritten operation adapters. It stages a public `api.wit`, a Wasm facade and a native linker from the compiler-checked exports and their Binding IR failure declarations. The test builds the independent app with only the public API and the defining guest’s object types as WIT dependencies. It compares the imports in the app’s compiled core module with the generated operation inventory, then calls all 17 synchronous exports.

The Wasm app distinguishes a returned `Except` value from an `EIO` failure; an object returned by either carries the original guest identity. An ordinary `IO.Error` delivers the exact message `meter disconnected`, while the declared `EIO String` delivers `host read failed`. Only operations whose Binding IR admits an escaping guest exception expose the original guest error as another failure case.

The app passes binary data with embedded zero bytes, UTF-8 text, a 385-bit natural and a negative 385-bit integer through the facade. It also passes two distinct boxes in both orders. A 17-argument Lean operation exercises the canonical ABI’s indirect argument record; changing its last scalar selects a different original box.

Passing a borrowed box alongside an integer with a zero high limb produces a boundary-validation error, not a Lean `IO` or `EIO` failure. The defining guest notifies a test-only observer from its destructor: the staged box owner is released exactly once before the trap retires the binding. The test does not reenter the poisoned graph to read the counter. It also rejects a changed `EIO` payload and an invented failure on a pure function before generating a facade.

The clean run produced 53 native exports; the worker SHA-256 is `8c3ac7651f0f42c794096e4551248a7e311da31fb01193e260391c175fffc64e`. That milestone tested a local composition, before the public task interface and installed packages below.

## A canonical future returns the original guest object

For `Jobs.echo : Box → Task Box`, the [generator](../../src/backends/wit/application-future.mjs) emits `echo: func(box: borrow<box>) -> future<own<box>>`. Both occurrences of `box` refer to the defining guest's resource type. A [separate Wasm consumer](../../tests/fixtures/static-host-workers/lean-future-consumer.wat.in) imports the generated interface; `wasm-tools component targets` checks it against the WIT world. The consumer calls the compiled Lean task under Wasmtime 51. Its own instructions read or drop the canonical future.

The [probe](../../tests/fixtures/static-host-workers/lean-future-consumer.h) checks:

| Ordering | What the probe observes |
| --- | --- |
| Reader first; writer first | In each order the guest receives an independently droppable owner. The defining guest's equality operation reports that it is the original box. |
| Reader drops before native take | The embedding closes the job without taking the value. |
| Reader drops after a write blocks | The guest destructor releases the unread result exactly once. |
| Store shutdown before native take; shutdown with a blocked write | For each ordering the probe leaves the reader live. The defining guest reports the object drops **before** the Wasmtime store is deleted. |

The [Canonical ABI](https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md) distinguishes dropping a reader from dropping an unwritten future writer. During teardown, the producer detaches a blocked writer from its wait set before cancelling it. If the reader never accepted the object, the producer releases the object while its defining component is still callable.

The clean build produced 53 native exports; its worker SHA-256 is `f37ad26ce0868d6889a1a77d43d0c0c9aa2ec9154e93ea79fd29203aded102aa`. The owner-domain and task-lease library hashes are unchanged.

This is a private build and runtime result, not an installation receipt. `Task.pure` makes the test deterministic; dropping before native take is **not** evidence that a long-running computation stopped.

## Does the caller get an error or a future?

The order of the Lean types determines when the Wasm caller can observe the error:

| Lean return type | WIT return type | What the independent guest receives |
| --- | --- | --- |
| `EIO Box (Task UInt32)` | `result<future<u32>, own<box>>` | `Jobs.reject` returns the original box immediately, with no reader. `Jobs.accept` returns a reader that delivers `UInt32.max`. |
| `Task (Except Box UInt32)` | `future<result<u32, own<box>>>` | Both calls return a reader. Reading `Jobs.outcome` yields the error branch with the original box; reading `Jobs.completed` yields the success branch with zero. |

The [guest](../../tests/fixtures/static-host-workers/lean-failure-consumer.wat.in) checks the tags and compares each returned object using the defining component's equality operation. The [embedding test](../../tests/fixtures/static-host-workers/lean-failure-consumer.h) observes its destructor and runs 65 failed factories against 64 available writer slots. The store remains usable and every slot stays free. It also drops unread results in all three delivery cases: the error owner is released once, and neither copied integer is treated as a resource.

Two independent guest instances also have `Jobs.outcome` futures outstanding at the same time. Their boxes hold the same number but have distinct identities. In both read orders, each guest gets its own box, and the probe accounts for every destructor.

Generation rejects a different declared error ID, a changed payload type, copy ownership on the error object, and a factory failure relabeled as a task failure. This clean build produced 62 native exports and worker SHA-256 `e08b632f01ea0dbbf2d799bd5a0ee0cbde7a1f143bf533f0df0c2b33fc080cae`.

## A Lean task calls back into its Wasm application

The [registration generator](../../src/backends/wit/application-callback.mjs) projects a checked `Box → IO Box` callback to a nominal WIT resource. The [guest](../../tests/fixtures/static-host-workers/guest-callback.wat.in) defines the registration and its destructor; the embedding cannot manufacture a compatible object by copying its numeric representation. `wasm-tools component targets` checks its exported callback interface without relying on the fixture-only constructor.

The [native integration probe](../../tests/fixtures/static-host-workers/lean-callback-consumer.h) starts the compiled `Jobs.relay` task with this registration. On the Wasmtime store owner, the callback re-enters compiled Lean to change the original box from 42 to 73. In a separate call it returns an owned exception from the defining object guest. Lean propagates that failure; the caller reads “other error” from the original exception and its destructor runs exactly once.

The probe also checks two jobs sharing one registration, releasing the caller's reference before either job completes, and revoking a registration from inside its active Wasm callback. Revocation defers destruction until that callback returns. A separate test waits for a real callback request on the combined notification descriptor, then cancels without invoking it. The registration is destroyed without a guest visit. A detached Lean task may briefly retain its box; closing the last binding accounts for every box destructor before the store is deleted.

The clean build checked the standalone callback interface and linked 63 native exports (worker SHA-256 `a1d29f0a86957373e892016e54613ab842a8036636d2cdc6a77f30d0bd38e424`). This probe initiates the call through the typed native facade; the next check starts it from Wasm.

The [registration client](../../tests/fixtures/static-host-workers/guest-registration.wat.in) also creates and transfers registrations entirely within Wasm. A private exchange imports the defining guest’s resource type and moves ownership to the native factory; it exposes no numeric registration to application code. The client queues a failing registration and then a successful one. The two actual Lean jobs observe success and failure in reverse order. Handing the exchange a box instead is rejected without poisoning the store. This clean build produced worker SHA-256 `9f8d97bb04c9f8a931b713e7a13dc7ded9f24454cdf65777bf93d0c170f257e7`.

## The Wasm caller starts the Lean task

The [downstream guest](../../tests/fixtures/static-host-workers/lean-relay-consumer.wat.in) starts a compiled Lean task by calling `relay(box, f)` and immediately drops its own callback registration. It reads a canonical `future<result<own<box>, callback-failure>>`. It imports no native handle, scheduler function, or result adapter.

| What the compiled Lean task does | What the Wasm caller observes |
| --- | --- |
| Returns the callback’s box | The defining guest confirms this is the original box. |
| Propagates the callback’s exception | The `callback` arm owns the original guest exception. Its method returns `other error`. |
| Throws a new IO error after running the callback | The `io` arm contains the exact UTF-8 text `late λ`, even when Lean first caught a callback exception. |
| Invokes a callback that traps | The session is poisoned. There is no ordinary result; shutdown releases native wrappers without calling into the trapped guest. |

The [integration test](../../tests/fixtures/static-host-workers/lean-relay-consumer.h) reads both before and after the writer is ready, abandons unread results, and cancels with a callback request already queued. Two independent guest instances share one producer and consume different result arms in reverse order. On non-trapping paths the test accounts for every box, exception and registration destructor before deleting the store. On cancellation it checks that the guest callback was never invoked.

The callback build contained 68 native exports; worker SHA-256: `95d5dd589ee27505465e9f359d94830c99037d1b3e183c789cc8b862496b5daa`. It selected all seven task factories. The next check covers the object-valued iterator.

## A Wasm reader pulls guest-owned objects from a Lean cursor

`Jobs.finite` returns a `stream<own<box>>`: the first read yields the original box and the second reaches EOF. `Jobs.series` returns a `stream<result<own<box>, own<box>>>`: it delivers a box, then one declared error carrying the original box, then ends. The [Wasm caller](../../tests/fixtures/static-host-workers/lean-stream-consumer.wat.in) checks both the result tag and object identity. It reads a standard Component Model stream; it does not advance the Lean scheduler.

| When the reader stops | What the [host test](../../tests/fixtures/static-host-workers/lean-stream-consumer.h) measures |
| --- | --- |
| Before requesting anything, or after withdrawing demand before the producer runs | No Lean pull. Dropping the reader closes the cursor once. |
| With a Lean pull waiting on a promise | Cancellation closes the cursor without waiting for the promise. The fixture releases the promise afterward; no late item is delivered. |
| After signaling readiness without accepting an item | The producer drops the unread guest owner. The test repeats this with a typed error as the unread frame. |
| With two readers alive at shutdown | One writer holds an item and the other holds an error. Both readers see EOF; all original guest destructors are counted before deleting the store. |

The fixture counts real calls to Lean’s `nextFinite` and `closeFinite`: pumping without demand does not prefetch. Separate guest instances can advance different cursors without exchanging boxes. Generation rejects changes to the close declaration, error channel, payload type or ownership, and input mutability.

This private integration selects seven task factories and two cursor factories with no missing asynchronous exports in the fixture. The clean build checked 75 native exports; worker SHA-256: `5faf5fdf54f58e220b12d1a5c78d1f221176c92ae7b350768241314a55ab737d`. Async object-package installation is a separate gate.

## Run the installed synchronous object package

The [install test](../../tests/helpers/wit-installed-object-packages.mjs) builds the same Lean project twice. The ordinary build derives the public API from Lean; the reviewed build checks it against the supplied Binding IR. Both releases embed Wasmtime and the same native Lean runtime as their compiled library. Each release exposes two WIT worlds: the object provider defines its own resources; the application imports those original resource types and calls Lean.

| Workshop 1.0.0 release | Archive bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary | 60,970,294 | `ea160d0404ec128899364ff6c04776c49316a3de7468d11208b34c5e1822b813` |
| Reviewed | 60,972,808 | `a61daae3f1e91d1f2df15658906242d76a971e885718ccd47bd9fdc8aa071159` |

For each archive the test validates the receipt schema and file hashes, extracts it under a path with spaces, and builds the two consumer components against its public WIT. It deletes the source and original release directory before running the installed command with no tools on `PATH`. The application checks the original boxes, mutation, object and error ownership, UTF-8, binary buffers, and wide integers. The defining guest counts three destructor calls on the successful path and two more on the error path. Swapping the components or importing the bridge's private exchange prevents the application from starting. Run `npm run test:wit-host-object-packages` with the publisher toolchains.

The synchronous profile does not advertise canonical task or cursor factories. A separate composition experiment reached `Jobs.series` from a real guest’s **async** `run`; Wasmtime 51 rejected the native adapter’s blocking re-entry into the same store. The [Wasmtime call documentation](https://github.com/bytecodealliance/wasmtime/blob/v51.0.0/crates/wasmtime/src/runtime/component/func.rs) distinguishes this case from entering the same guest from a synchronous host call. This failure motivated the owner-thread transport used in the mixed release below.

## A synchronous Lean update inside an async guest

The [scheduling regression](../../tests/helpers/wit-application-turn.mjs) calls the original compiled `Workshop.update` from an async Wasm entry point. Lean sets a property, then reads it. The process main thread owns the Lean binding; a separate thread owns the Wasmtime store. When Lean asks for a property, its owner waits on a condition variable. The synchronous Wasm facade calls the defining guest’s method and replies before the Lean call returns. The guest’s resource handle never crosses the thread boundary. A nested Lean call uses the same native owner.

The guest verifies that updating one box from 42 to 73 leaves a second box unchanged. It also forces the getter to return an owned error, receives that original error and checks its destructor in the defining guest. A second Wasm module traps immediately after Lean asks for a setter. The native frame unwinds once before store teardown. Separate checks reject a reply to a suspended parent, a foreign ticket and a replayed reply.

The native binding receives a private lease ticket, not a Wasm resource representation. For both the setter and getter the driver resolves the ticket supplied by the native call and acquires the original object from the defining guest. It holds the original error in the same table until Lean selects the error to return. The two calls finish with no table entries. The [lease audit](../../tests/fixtures/static-host-workers/guest-lease-audit.wat.in) also checks out-of-order moves, rejected stale, foreign and wrong-kind tickets, slot reuse and capacity exhaustion. Closing the full table twice produced no double drops: the original guest counted exactly 70 destructors across the audit.

The property-call regression exercises one borrowed-object signature. The [release launcher check](../../tests/helpers/wit-application-command-client.mjs) links an independent object provider, registration provider and async application using the compiler's complete task inventory, then runs that application. A guest importing the private scheduler function `turn-series` fails validation.

## Canonical streams read by an async guest

The [downstream reader](../../tests/fixtures/static-host-workers/turn-cursor-client.wat.in) imports standard Wasm streams and the defining guest's box methods. Both ends of the [cursor adapter](../../src/backends/wit/application-turn-cursor.mjs) come from the checked Lean declaration. The guest never sees the private lease tickets, readiness descriptors or native handles.

The reader opens four cursors, including two on the same box. It abandons one before requesting an item. It reads the two typed streams out of order and compares each item and final error with the original box. The finite cursor retains a third box after the caller drops it. Its first pull waits on a real Lean promise while the other streams complete. Resolving the promise makes the native descriptor readable; the guest receives the box and then EOF. The normal run counts **four opens, six pulls and four closes**.

A second run cancels the finite read while the promise is unresolved. Lean's own counters show one pull and one close for that cursor while another stream is still active. Releasing the promise later produces neither a guest item nor a second close. Across all four cursors this run counts **five pulls and four closes**. On clean exit, the native binding shuts down and the store thread drains its deferred destructor notifications; both the native object registry and the defining guest's lease table are empty.

A separate native protocol test opens a third cursor while the second is waiting for the owner to compare two objects. Before the fix both opens chose the same free slot. The factory now reserves its slot before invoking the owner. All three cursors close independently and each original lease is released once.

These are private executions with a real async Wasm application and compiled Lean. The next check uses a stream and a retained callback together.

## A stream feeds a retained callback

The [downstream application](../../tests/fixtures/static-host-workers/installed-application.wat.in) creates a box with value 42. It reads the box from `Jobs.series`, checks the original identity on both the item and terminal error, and starts `Jobs.relay`. It drops its registration handle before awaiting the canonical Wasm future. The defining guest's callback re-enters compiled `Workshop.update`, changing the box to 73. The future delivers the original box; the application checks its identity and returns **73**. The source opened one cursor, pulled twice, closed once and invoked the callback once. Both ownership tables ended empty.

The [generated callback adapter](../../src/backends/wit/application-turn-callback.mjs) calls the defining Wasm guest on the store thread, while the native owner keeps the Lean task and its callback alive. A registration extends the existing object table rather than creating a second identity for its box. The [canonical reader](../../tests/fixtures/static-host-workers/lean-relay-consumer.wat.in) checks four outcomes: the original object, the original callback exception with message `other error`, a later Lean IO failure, and that same IO failure after Lean catches a callback exception. The IO message is `late λ` in both cases.

The reader exercises each outcome four ways: receive after the write blocks, drop the blocked result, drop before callback invocation, and request before settlement. A separate guest traps inside its callback. Its parked native frame unwinds before the store is destroyed; the host does not re-enter the trapped store to inspect it.

## Check all nine task and cursor factories together

The [generated task interface](../../src/backends/wit/application-turn-task-graph.mjs) links seven future factories and two stream factories from the source inventory to the same native owner. Two independent Wasm readers start `Jobs.echo` with distinct boxes of equal value. While both are pending, the guest calls `Jobs.reject` 65 times, exceeding the native table's capacity of 64. Each call returns its original box as a factory error, leaves no active row and has no future to await. The echo readers then receive their own boxes in reverse order. A third reader requests its box before settlement.

The [result reader](../../tests/fixtures/static-host-workers/lean-failure-consumer.wat.in) distinguishes three other cases: `Jobs.accept` successfully creates a future of `4294967295`; `Jobs.completed` delivers `ok 0`; and `Jobs.outcome` delivers an error containing the original box **inside** a successfully created future. The driver repeats each case with a reader that drops before delivery and one that drops while the write is pending. The native and guest ownership tables return to zero after shutdown.

The clean integration build with the generated native scheduler checked 75 native exports; worker SHA-256: `7ced87285a8a76291da8f9100740236d1d7aa36d5181ccdfc1a3ae76d9b16c8d`.

The [native scheduler](../../src/backends/wit/application-turn-task-host.mjs) derives its linker, dispatch and teardown tables from those same declarations. A pending finite cursor leaves no readable descriptor until the test opens its Lean gate. The scheduler then observes the wakeup, without manufacturing an item or firing a timer in Lean. During teardown it also closes two open echo futures together: one write holds an unread box and the other factory has started but has not been polled. The guest has already dropped its original handles. Both ownership tables finish empty.

## Calls into the defining guest

The [member adapter](../../src/backends/wit/application-turn-members.mjs) generates calls for every member in the defining guest's checked contract. The async fixture uses it for the actual setter and getter inside compiled `Workshop.update`. The [11-member test](../../tests/fixtures/static-host-workers/guest-turn-members.h) also calls the constructor, read, identity, anchored, keep-other, take-other, echo-text, echo-bytes and shift methods. It distinguishes two boxes both initialized to 42, checks which one each method returns, and mutates only one. Text including NUL and Unicode, 257 binary bytes, and a negative integer with 13 limbs survive the round trip. Two failed constructors produce different original exceptions, which the test retrieves in reverse order. No leases remain. The clean combined worker rebuilt with 75 exports; SHA-256: `61f2d4fc21c57f17070d367fffb6d125e976462ecc9b8cc92a6fc3d3833235e2`.

The [mixed worker test](../../tests/helpers/wit-application-turn-callbacks.mjs) also runs the other direction: **the guest calls all 19 public operations on Lean**. The [generated Wasm adapter](../../src/backends/wit/application-turn-sync-graph.mjs) and [native dispatcher](../../src/backends/wit/application-turn-sync-host.mjs) use the same owner as the nine task and cursor methods. The independent WIT consumer changes a box from 42 to 73, selects either of two boxes through a 17-argument operation, and asks Lean to catch two different constructor errors and rethrow the first. Reversing the inputs reverses which original exception reaches the consumer. A separate run makes the guest destructor trap while Lean is waiting for it. The native frame unwinds and its copied values are released without calling the trapped guest again.

The fresh build checked 75 native exports; its worker SHA-256 is `cdc5a758babd32a3110d50ab247e8bea2d47c87e864dfae2d4b0ca6982342a80`. The installed synchronous package has its own checks above.

## Run the installed mixed object package

The [mixed install test](../../tests/helpers/wit-installed-mixed-packages.mjs) builds the complete Workshop project through the public CLI, once from ordinary Lean source and once against independently supplied Binding IR. It verifies the package-set receipt and its file hashes, relocates the extraction under a path with spaces, and builds the three guest components from the installed WIT. With the source project and original release directory gone, the installed launcher returns `73` from the stream → retained callback → synchronous update → future application. In the same two installations a second application exercised all 19 public sync operations, including the two possible original error objects; a third returned `17` after releasing a stream reader early. A trapping callback made the command exit nonzero with the original `unreachable` diagnostic. A private scheduler import and a missing component were both rejected. Neither route needs Lean, wasm-tools or Wasmtime on the deployment machine.

| Workshop 1.0.0 mixed release | Archive bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary | 61,040,557 | `3e167a7c4f6596b8a3c40d4b92f1b38b82c1aae7319dfbdb391a00f1db14a19e` |
| Reviewed | 61,044,375 | `6f612f39d7574a65f95246774abd25dfe75f9b47bedc4400aacc74a677a7037f` |

Run `npm run test:wit-host-object-packages` with the publisher toolchains specified above. The receipts are from local Linux x86-64 builds with the test glibc floor of 2.36, not hosted CI or a registry release.

## One object future, no synchronous API or callback provider

The [task-only install test](../../tests/helpers/wit-installed-object-task-only.mjs) selects only `Jobs.echo`. Both package receipts identify the object-task profile and both launchers require exactly two inputs: the defining object guest and the application. The reviewed build takes its public selection from the Binding IR with no `exports` list in the project configuration. The [independent consumer](../../tests/fixtures/static-host-workers/installed-echo.wat.in) awaits the future, compares the returned box with the original by guest identity, drops the original, and reads **83** through the surviving owner. It runs after the producer source and release directory have been removed, with no tools on its search path.

| Workshop 1.0.0 task-only release | Archive bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary | 60,966,846 | `b9599f691dcb4906f85cc759cb1d9e0351726d0f8b94aaaea32a5edf7fbc7bce` |
| Reviewed | 60,966,826 | `6407cffe7783d24d13dac3024418f71928bd83bd0c98adffecd48b7c21b223fe` |

## Malformed synchronous arguments inside an async application

The installed consumer passes a borrowed box followed by a noncanonical Lean integer (one zero limb) to `shift`. The earlier launcher reported only `synchronous Lean frame failed to resume`. Both rebuilt releases now report `invalid WIT argument or conversion limit: shift`, before entering the Lean function. The original member failures, Lean IO errors, and callback traps still follow their separate paths.

The [native fault probe](../../tests/fixtures/static-host-workers/guest-turn.c) observes a destructor without calling back into a trapped store. It counts exactly one release for the staged receiver. In a second run the defining guest traps during that release: the store reports the original `unreachable`, not an argument error. Both runs retire their frames and leave the native reference table empty.

| Workshop mixed release with argument diagnostics | Archive bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary | 61,041,889 | `5265125efe9205efb46938fbba8e572d1647caa570f9365621d219b3e60f64ee` |
| Reviewed | 61,045,848 | `9cfdf9fe174bc2fface6516dfa4e8e61efe0b7d66b1aa869b1e62ab49d1ecc9e` |

For the other runtimes, see the [installed host-worker evidence by target](host-worker-qualification-20261125.md).

The synchronous-only regression was rebuilt at `0ec2035` because its launcher also includes the shared marshalling header. Both relocated installs returned `1` after checking object identity, mutation, original IO/EIO errors and destructor counts; neither admitted the private exchange import. These are new archive bytes: ordinary 60,970,873 (`e87f60c1fa289ad65799bc137c0e7fde8794a07a767fe8b4ef5aadc851288bea`), reviewed 60,974,555 (`30886cbfb92011eda43736bbd04aab146151ea420144bc8c9996a57ca81a234d`).

## Copied and guest-owned workers in one release

The [install test](../../tests/helpers/wit-installed-object-task-only.mjs) builds five declarations from one Lean project. `Jobs.echo` returns a guest-owned box. `PacketCompose.packet` copies its inputs and returns a future. `Packet.chunks` yields copied byte arrays, `Packet.release` opens the worker's gate, and `Packet.closed` counts closed cursors. The reviewed build selects the public declarations from the supplied Binding IR without an `exports` list.

| Relocated archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary | 60,976,349 | `2a9d6b223a4014b15ac7e44faf68654d398664e5775f013c3a06043d42abcd49` |
| Reviewed | 60,977,904 | `e98ad3109c8c07fe102a01ce904780a0766bced3abeb39fe11c2041507f09766` |

Three applications ran from each verified archive with the producer source and release directory removed and no tools on the search path:

- The object consumer compared the two guest identities, dropped the original and read **83** from the remaining box.
- The [packet consumer](../../tests/fixtures/wit-canonical-bytes/application.wat) distinguished an immediate factory rejection, a returned `Except.error`, and a terminal stream error. It checked empty and non-UTF-8 byte arrays after overwriting the input, dropped a pending future and an unread stream, and observed **2** cursor closes.
- The [interleaved consumer](../../tests/fixtures/static-host-workers/installed-overlap.wat.in) kept a packet future pending while it awaited the box. It checked the original identity, dropped both box owners, released the packet and recovered the original error byte **253**.

The negative build moved an `IO.getEnv` call into `Packet.finish`, the cursor finalizer. The compiler identified the exact finalizer and missing environment capability. Adding an explicit `nativeEffects` grant also failed: the guest-object WIT profile admits no external OS capabilities. Neither build created a release directory.
