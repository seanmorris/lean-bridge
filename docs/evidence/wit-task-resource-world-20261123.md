# Check a typed WIT task interface

A caller that starts `Meter.parked` gets an owned `parked-task`, not an integer handle. Polling or cancelling borrows that task. The readiness observation distinguishes `pending`, `ready(s64)`, `cancelled`, and `closed`. The other tasks in the same package have distinct resource types and their own result types.

The [Lean fixture](../../tests/fixtures/wit-tasks/Meter.lean) declares a gated `BaseIO (Task Int64)`, a release operation returning `BaseIO (Task Bool)`, and an immediate `Task UInt32`. The [world generator](../../src/backends/wit/task-model.mjs) reconciles the original compiler evidence and the complete public contract before emitting the WIT and its canonical-ABI forwarding component. These three exports do not declare failures. The generator rejects ungranted external native effects.

## Reproduce

Set `LEAN_BRIDGE_LEAN_PREFIX` to the Lean 4.32.2 installation and `LEAN_BRIDGE_WASM_TOOLS` to the wasm-tools 1.245.1 executable. Run `npm run test:wit-task-world`. Set `LEAN_BRIDGE_WIT_TASK_WORLD_EVIDENCE` to a new directory to retain each route's checked inputs and outputs.

The [driver](../../tests/helpers/wit-task-resource-world.mjs) first builds from configured Lean exports. It then removes the explicit export list, supplies a reviewed Binding IR file, takes a new Lake snapshot, and compiles again. For each route it parses and validates the binary and runs `wasm-tools component targets world.wit component.wasm`. Swapping the borrowed task type in the advertised poll operation must fail that last check. Changing the reviewed scalar result or claiming a filesystem capability must also fail before emitting a new world.

| Artifact | SHA-256, ordinary and reviewed |
| --- | --- |
| Public Binding IR (semantic hash) | `267a646a1418db0fc51e481029dfbb75cb1bb1bc43c7284e92036d6cc1353277` |
| WIT world | `4a1f172c47d0e4e7fa56f2961679bd1fb9f033f0abd7dff2bec4cb26ce0cedda` |
| Binary component | `be64a9169ee1661ef2e8685a657ee051cb4ad6c0f40e0fb326ac6c32915f2334` |

## Run the task through Wasmtime

On Linux x86-64, set `LEAN_BRIDGE_WASMTIME_C_API` to the extracted Wasmtime 42.0.1 C SDK. With the same Lean and wasm-tools settings, run `npm run test:wit-task-host`. The test builds the shared native Lean runtime once. To reuse one, set `LEAN_BRIDGE_WIT_TASK_RUNTIME` to its directory containing `runtime.json`; the test verifies its contents and compiler commit before linking. The optional evidence directory also retains the compiled consumer, generated imports, and per-route hashes.

The [embedding test](../../tests/fixtures/wit-tasks/host.c) loads the component above and invokes its **exports** in a Wasmtime store. The [generated imports](../../src/backends/wit/task-host.mjs) start real Lean tasks. A second store can resolve the Lean promise but cannot borrow the first store’s task. The host waits on a borrowed Linux descriptor for either completion or runtime retirement; it does not spin, and Lean workers do not call into Wasmtime.

| Operation | Observable behavior |
| --- | --- |
| Poll a parked task | Returns `pending`; another poll reuses the same readiness descriptor. Resolving the promise wakes the host. |
| Poll a completed task | Returns `ready(value)` exactly once, then `closed`. The consumer checks signed 64-bit minimum and unsigned 32-bit wraparound. |
| Cancel before delivery | The first request returns `true`; a second returns `false`. Poll reports `cancelled` once, then `closed`. A late Lean result is not delivered. |
| Drop or shut down | Wasmtime’s resource destructor releases the native owner. Closing the store also releases outstanding tasks, even after a failed call. A descriptor borrowed from a disposed task is no longer valid. |
| Retire the runtime | A pending wait wakes even without a result. Poll fails; the host tears down the store and its readiness subscription. |

The embedding test exercises nominal task resources, not canonical Component Model `future<T>` or `stream<T>`, async iterators, or typed terminal errors. The separate [release test](../../tests/helpers/wit-task-package.mjs) exercises the [prepared package](../consume/wit-wasi.md#await-a-lean-task): run `npm run test:wit-task-package` with the same producer tools. It builds the ordinary and reviewed archives with an offline-installed CLI, verifies the receipt, relocates the installation, compiles a consumer with just the installed header and `pkg-config`, and runs with no producer tools on `PATH`.

### Installed package receipts

At [the first installed milestone](https://github.com/seanmorris/lean-bridge/commit/744f1a69f21f6299bba0e5827f5eb99d3a331a46), the release test extended Meter to 13 exports, including text with an embedded NUL, a Unicode scalar, fixed-width signed and unsigned integers, and both floating-point widths. This larger package has semantic Binding IR hash `4c334f37fb578f50245fea8f6775beb873ab167e776eb098c6ff6ab7f52867b7`. The prepared `lean-bridge@0.1.0-rc.1` CLI and the development CLI produced identical receipts for each route. These are local Linux x86-64 results using the glibc 2.36 test floor; they do not record a hosted build or a public release.

| Build | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 59,212,002 | `8c34b4f1197cd485c3d2adeef33821faee1aee8d20b5ec0e4fd5e136b6c7bc90` | `7840679f6c54ee80cadf0877960d37b0d11d13bb634a843f7629e54611384d8c` |
| Reviewed | 59,213,246 | `eada7ff2f979790ddd979862482407f1b55a1edba61fe8bbaf432e436825fac9` | `175d3ef79965f8ed1bf8b4ac6b3e54e615245c89b2eb68470c19e7da4ec6cd7a` |

The [consumer](../../tests/fixtures/wit-task-package/consumer.c) uses only the generated header and the standard C/POSIX library. It checks that a dropped reference cannot act on a new task, cancellation wins before delivery even if Lean already computed the value, a foreign session cannot borrow the task, and returned text survives store shutdown. A separate [fault-injection process](../../tests/fixtures/wit-task-package/retire.c) retires the runtime while the owner is waiting on a parked task and checks that closing the failed session releases its descriptor. The reviewed-result mismatch and the forbidden capability must each leave the release directory absent.

### Factory errors, returned values and worker failures

The [effect declarations](../../tests/fixtures/wit-task-package/effects.lean) extend the installed example to 16 exports. `Meter.phase` can throw the same `IO.userError` either before returning a task or inside its worker. Its WIT factory returns `result<own<phase-task>, string>`; the task's observation has a separate `failed(string)` case. `Meter.checked` instead returns nested `Except` values, including errors, as `ready(result<result<u32, string>, u32>)`. `Meter.branch` can throw either arm of `Except String UInt16` at startup.

| Route | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 59,230,016 | `647bc1932eb9b75e91b431dd38f2e8ac99e6d6a65a77319a076b9eb54a2ca21a` | `f4cc5fb72ebd86e7a1dece5a07b2a2cce7a93d081297480bab91360a3c0daccd` |
| Reviewed | 59,231,618 | `ffabfbe48b4ac02b1d85a74b4e2803f7800962f7d7a79aa419249b1177029d18` | `dde8c14eac1b7dffac40d977315286447982b7c763a90fa684d9ccc730442ced` |

Both receipts identify the same semantic Binding IR (`46bc5aa19c03ed457250b2b7e67192147800ce1e92897508e600c2f789f931c6`). Both archives contain the same validated binary component (`50b19e3201b5ed29757181a4e1fbfa6a0e26b9cac67221245d7dda6ebedb5750`). Run `npm run test:wit-task-package` to compile and execute the [installed C consumer](../../tests/fixtures/wit-task-package/effects.c) against each archive. It checks 260 rejected starts without exhausting a 256-slot store, embedded NUL and UTF-8 in owned errors, exactly-once delivery, and recovery. Cancellation can win before delivery even if the worker would have reported an error. The package gate passed both clean installs and rejected three altered reviews (value type, startup error type, missing worker failure) and an ungranted filesystem capability before producing an archive. These tests do not establish callback or stream support.

### Pull cursors

Run `npm run test:wit-cursor-package` with the same producer tools. The standalone CLI builds [two Lean cursors](../../tests/fixtures/wit-task-package/cursors.lean) without any `exports` or `taskExports` list. The reviewed build also supplies the public Binding IR. Both receipts identify `ae8d45e08125820920ac17dd8a01ef55c9d5cd66c3503331ef829177bb8e049c`. Both components target the same WIT world: an owned resource per factory and a borrowed cursor on each request, poll or cancellation.

| Route | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 59,202,727 | `cc693cd8eb6311d5df611fd3a59be2b3bff244f05f1200fb354539befa6af6f7` | `e07b39108ade9183525009dc7ff3179ffb1ad99835f38ab0aaa7b194cbc41ab0` |
| Reviewed | 59,203,749 | `db9a9bd9e4c0a7b473eed7e094da57e3e1d0cd8bbfe3207537a5c2091d93a268` | `fca94870b846ff775de7c547d15bb0da77be13d6cc5b1c04d6520a68cd2e03aa` |

The [installed consumer](../../tests/fixtures/wit-task-package/cursors.c) observes Lean's own pull and close counters through a second cursor in another store. It checks eight pulls and seven closes across normal exhaustion, early drop, typed pull failure, cancellation and session shutdown. Opening a cursor or observing it while idle leaves the pull count unchanged. An outstanding request retains its item until observation. A rejected factory creates no cursor. A returned text-error item outlives its owner, and a pending pull interrupted by runtime retirement wakes without publishing a value or failure.

The ordinary and reviewed archives contain the same component (`eedfdec63a824aeffdfec1c711576c0076033b221580a43716b1915d49d442e5`). The gate rejected reviews that changed the item width or pull-error width, and rejected substituting a different close declaration with the same Lean type. A filesystem capability grant also stopped packaging. Each refusal left the requested output path absent.

### Tasks and cursors in one store

`npm run test:wit-mixed-package` combines 16 task factories and three cursor factories. The ordinary and reviewed installs ran the task and cursor consumers and compiled the [guide example](../consume/wit-wasi.md#pull-an-asynchronous-sequence). An immediate task returned `42` without waking a parked cursor. A cursor named `outcome` exported `request-outcome` without colliding with its WIT result type.

| Route | Archive SHA-256 | Receipt SHA-256 |
| --- | --- | --- |
| Ordinary | `dadd7e6eb20df803f492a2ea3891693fdc485788f27e1e07403ad72318816a93` | `278dea192a7d8eb3fd86c3f0f7cb5b2c34a7afe1dc6a36bb2374fdd836c7c24b` |
| Reviewed | `02c6048b951ab4b5944153d7a4fb6b39b29810dfd48b6d03ec4bb8265b163b46` | `32012eb25280e2fce504473db6a15e3d2e4ba0df8bf912137f570fc10914d2e3` |

The [retirement probe](../../tests/fixtures/wit-task-package/retire.c) measured three broker identities during a pending pull: the session, its native owner and the worker notification. Dropping the owner closed its descriptor and left two identities. After resolving the promise and closing the session, the count returned to zero. In a separate run the probe retired the runtime while the promise was parked. Session close released the owner and descriptor; the one intentionally unresolved worker retained its safety lease. The same two cases passed for tasks.

### Lean objects through a WIT task or cursor

Run `npm run test:wit-task-lease-host` with the producer tools above. This exercises the binary Component Model exports through a native Wasmtime embedding. The [installed-package test](#exchange-a-ticket-between-installed-packages) checks the public CLI and consumer API separately.

The [Lean source](../../tests/fixtures/javascript-wasm-resource-tasks/Shared.lean) defines two object types, Ticket and Badge, with the same fields. The [consumer](../../tests/fixtures/wit-tasks/heap.c) creates two Tickets with equal field values and checks that they are different objects. It retains one, drops the original owner, passes the surviving Ticket by borrow, then drops that owner too. The task result, the first cursor item, and the cursor's typed failure still identify the same Ticket. A rejected task factory also returns an owned Ticket. A Badge cannot stand in for any of these Tickets.

The public name is `lease-ticket`. The private import includes the identity of its Lean declaration. The [four-build test](../../tests/helpers/wit-task-lease-world.mjs) recompiles an independent Peer against the same declaration, then modifies the defining module without changing its field layout and recompiles Peer. Each component validates against its own world; `wasm-tools component targets` rejects the changed Peer against the original Peer world.

| Build | Ticket identity | Component SHA-256 |
| --- | --- | --- |
| Ordinary and reviewed Depot | `552d91582ffe8f1eae4f005addd6d79dc8d0e82411e2f2710d9d2dc8c746d940` | `8d3269ad3e023a8440de19a059f915c37ef6f5ee5b133a126453ed96b6b178c0` |
| Independent Peer | Same as Depot | `eb87fa6d74502da302326bd9a2d83d66869e4182b59aaa3df7f33e141e851ca4` |
| Changed Peer | `264ab3263dc5eaff8177defa24b11ac8f1d7f2f0bf02a0c12b8e51151c5e19df` | `22f6bfb046ffff2723a449cce4abb446a9ddd5d5153e63f6f03e6489ee7823a0` |

Store shutdown releases the last outstanding native lease. The test also forces allocation of an outgoing result to fail after Lean delivers a Ticket. Wasmtime can keep the task borrowed after that trap, so the embedding shuts down the store rather than calling it again. No orphaned Ticket appears, and the live-identity count returns to zero.

### Exchange a Ticket between installed packages

Run `npm run test:wit-task-lease-package`. The [driver](../../tests/helpers/wit-task-lease-package.mjs) installs the author CLI offline, builds Depot and Peer separately, verifies their receipts, removes the producer projects and handoffs, and relocates both installs. It compiles the [consumer](../../tests/fixtures/wit-task-package/leases.c) with the two packages' headers and pkg-config files and runs it without producer tools on its path.

Peer changes Depot's Ticket from 11 to 42. Depot sees the new count after its original owner has been dropped. A stale Ticket and a same-layout Badge are rejected before entering Lean. Factory failures, successful tasks, cursor items and terminal pull failures return independently disposable owners of the same Ticket. Owners remain usable after both sessions close. Disposing the last owner leaves zero live broker identities and one runtime initialization.

| Independent build at `b76c483` | Archive SHA-256 | Receipt SHA-256 |
| --- | --- | --- |
| Ordinary Depot | `aa40a6152acc6c291f1beaf2a68ee229153b15e2fe7575c6660ba50ec0dfc010` | `ff0da22e33c0afe4ae224456c6eecde434cab073350d2fdc96f1b9db3c07f19e` |
| Ordinary Peer | `0597f558a4d9f7717a15f76b35d5d0552a670cd60858603e311ae35e68aeef45` | `d521630e6d30ab87a6990b71666c0067236055e3b01d32ffed63365fab68039d` |
| Reviewed Depot | `d52348f96e293f925500675eeddc0217d4d1f85243c1dd165052673970f0161a` | `5e89820c49bede4b62851dc8bae25eb600f1870ce7fcabf5bbf7fa38de428460` |
| Reviewed Peer | `689a6da09f0ac044f5f712936a624ecc06e87c3e31ac91ff7751f1ce44916ec7` | `00b853701842f9a40ba10bbdabd56c3e72bb90501a78e98400306a877ab238ab` |

All four archives contained the same shared lease library (SHA-256 `39f751ace1626f07fe8ef74b757428d6c4fc7e7b87739ab252107122d2018381`). Reusing Peer's review after changing the Lean module defining Ticket failed before creating an output archive.

### Count live borrows before store shutdown

Run `npm run test:wit-task-lease-lifetime` with the same producer tools. Set `LEAN_BRIDGE_WIT_PARKED_LEASE_EVIDENCE` to a new directory to keep the ordinary and reviewed Depot releases. The [Lean worker](../../tests/fixtures/wit-task-package/parked-leases.lean) waits on a real promise before mutating a Ticket. The [installed consumer](../../tests/fixtures/wit-task-package/parked-leases.c) drops its last input owner, then lets a second store release the worker. It checks three outcomes: one result delivered; cancellation followed by a late mutation but no result; and shutdown of the originating store before the mutation. In all three, a completion witness reads 42 from the worker.

The consumer also fills the store to its 255-task limit, delivers a result from the reserved slot, and recovers capacity by dropping tasks. In a fresh store it makes 260 calls with a valid first Ticket and stale second Ticket; in another, 260 successful calls borrowing the same Ticket twice. After **every call**, the live count must be exactly two: the session and the external Ticket. Closing each session and dropping its last owner brings the count to zero.

At `b76c483`, teardown still returned the count to zero. While the store was open, the 254th rejected call returned `LIMIT` instead of `STALE`, and the first successful two-borrow call left four identities instead of two. The native host now takes back each temporary Wasmtime owner after a normal return or argument rejection and explicitly releases its native slot. If the component traps with a borrow still active, the failed store tears down without re-entry.

| Parked-worker release | Archive SHA-256 | Receipt SHA-256 |
| --- | --- | --- |
| Ordinary Depot | `a2e8ffc2991eb51f1e8a4f7fc42a96c86cdb94d43c1daddcaa7f03710c08b517` | `1a9b95b40cf1a78a5ff535596d814ca0b4fa001e63c41b5dfdd9e65c5d3d8483` |
| Reviewed Depot | `246faae47d97dfbb804f51033dc8b99a91cf201bfc9f7f6757cafa8104862b76` | `aad72e35b5b4a8753b95998bbacde772ebe5f8de79cb53239cf1bfb24488e2b9` |
