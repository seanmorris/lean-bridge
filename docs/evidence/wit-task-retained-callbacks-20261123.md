# Trace a retained callback from Lean to the WIT store owner

[Meter.through](../../tests/fixtures/wit-task-package/retained-phase.lean) calls a supplied `UInt32 → IO UInt32` with 11. One branch calls it before returning a task; the other calls it inside `IO.asTask`. The host must be able to reply 42, decline the call, or cancel without blocking a Lean worker on a Wasmtime frame.

The compiled contract places the callback on the Wasmtime store owner. The WIT factory returns an owned task immediately. A later poll can yield `call-transform(own<callback-through-p3>)`. Reading the argument borrows that request; replying or failing consumes it. Each callback parameter of each declaration has its own nominal request type, even when signatures match.

## What runs

The [driver](../../tests/helpers/wit-task-callback-wire.mjs) compiles the ordinary application, then independently recompiles it against its reviewed Binding IR. On each route it runs two distinct checks:

- **Component contract.** `wasm-tools` validates the binary and checks it against the advertised world. A world that lets a reply borrow the request instead of consuming it does not match. Another host's callback scheduler or a changed failure contract cannot stand in for the Wasmtime owner's.
- **Native worker and owner transport.** A [C probe](../../tests/fixtures/wit-task-package/retained-wire.c) calls the generated native wire and waits on real readiness descriptors. This executes the compiled Lean factory and worker. It does **not** dispatch a callback through a running Wasmtime store or an installed package.

| Owner action | Before the factory returns | Inside the worker |
| --- | --- | --- |
| Reply 42 | Task delivers 42 | Task delivers 42 |
| Reject with `same message` | Original host failure and bytes, tagged as factory | Original host failure and bytes, tagged as worker |
| Let Lean throw `same message` instead | Lean factory IO failure | Lean task IO failure |
| Close with a request outstanding | Late reply rejected | Late reply rejected |

Both routes finish with zero broker identities and one runtime initialization. Their semantic Binding IR SHA-256 is `d22366d7b7c0259daf93e3138d73ec46155bc7880e96796e80772f66eaafac0f`; their binary WIT component SHA-256 is `33f0ff1ff609e0f479d37af8db9933b55ff0b2ee48f00b86327fccab4699ddf0`.

## Reproduce

Set `LEAN_BRIDGE_LEAN_PREFIX` to Lean 4.32.2 and `LEAN_BRIDGE_WASM_TOOLS` to the wasm-tools 1.245.1 executable. Run `npm run test:wit-task-callback-wire` on Linux x86-64. Optionally set `LEAN_BRIDGE_WIT_TASK_RUNTIME` to a verified matching native runtime and `LEAN_BRIDGE_WIT_CALLBACK_WIRE_EVIDENCE` to a new directory for both routes' contracts, components, probes and result hashes.

## Dispatch through a live Wasmtime store

Set `LEAN_BRIDGE_WASMTIME_C_API` to the Wasmtime 42.0.1 C SDK and run `npm run test:wit-task-callback-host`. This adds a [store consumer](../../tests/fixtures/wit-task-package/retained-store.c) that enters the binary component's public exports. When a worker requests a callback, one descriptor wakes the store owner for either completion or callback work. The poll returns an owned request before any caller code runs. Reading it borrows the argument; replying, rejecting or dropping it settles the invocation.

The ordinary and reviewed consumers each opened a second task in the same store with the first request outstanding. After cancelling and dropping the first task, they could read the captured argument, but its reply was rejected and could not settle a new job. A host failure containing an embedded NUL survived both the factory and worker paths. Dropping a request produced a declared callback failure instead of stranding a worker. Each client also completed 260 calls without accumulating store slots and closed the store with a request still outstanding. Late replies were rejected immediately; after workers quiesced, the broker count was zero.

With all 256 store slots occupied, requesting a callback delivered a declared capacity error to the Lean factory. After the other tasks were dropped, the same store could open and settle a new request. The ordinary and reviewed store consumer executables had SHA-256 `badef1ca894949b5d54b73118c1f26b7ad1c44f0d4b68e3482436e5857b80fff` and `f63c6c48bd7ebb98d54877a519144ecaadd093d74aac9244ec051f09fdeec3bb` respectively.

This gate exercises the public WIT exports from an embedding program. The [installed WIT lease checks](wit-task-resource-world-20261123.md#count-live-borrows-before-store-shutdown) separately cover mutable object ownership.

## Reproduce the installed callback API

Run `npm run test:wit-task-callback-package` with the same producer tools. Set `LEAN_BRIDGE_WIT_TASK_RELEASE_EVIDENCE` to a new directory to keep both package-set receipts and archives. The harness installs the author CLI with npm offline, builds an ordinary package, and uses its public Binding IR as the independent input to a second build. It verifies each package-set receipt, extracts the archive, and relocates it before compiling a [C consumer](../../tests/fixtures/wit-task-package/retained-consumer.c) using only the release's pkg-config flags. Neither the source nor the handoff is at its original path during execution. The [documentation example](../consume/wit-wasi.md#give-a-task-a-host-callback) is compiled and run separately.

- **Identity and lifetime.** Two parameters with the same signature call different C functions in the declared order. A task retains its registration after the caller drops it. Self-revocation lets the active invocation return and rejects the next one. Stale registrations, foreign stores, another loaded host image, and foreign threads cannot dispatch. Context destructors run once, off the invocation stack.
- **Failure origin.** The client distinguishes factory IO, factory EIO carrying `3737844653`, worker IO, host rejection and a returned `Except.error`. A string callback echoes or rejects a UTF-8 span containing an embedded NUL. An invalid UTF-8 reply first returns an API error, then settles the worker with a declared callback failure.
- **Scheduling and cleanup.** A callback drives another task on its store; observing the active task instead returns `BUSY`. Each nonblocking poll runs at most one callback, and a real readiness descriptor wakes the next poll. Cancellation, dropping the active task and closing its session from inside the callback all preserve the context until invocation returns. The ledger observer waits for outstanding native work to finish and requires zero remaining identities. The public consumer does not use the broker to schedule or settle callbacks.

Both installed clients passed with Binding IR SHA-256 `df62612e03e8ce16b2cc765f07fb39b4165c66f831ebafd5f3aca563edf21efc`.

| Verified archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary Lean source | 59,214,645 | `04621b4e95558fa404dff926bf953461724032fdd9a49676ec797df85d714e3f` |
| Independently reviewed Binding IR | 59,216,190 | `add7d2962fa89e9dffee4b7ed486786b7db632e6d4da1a1161cf931e625c6a97` |

## Retire the shared runtime with two packages installed

Run `npm run test:wit-task-retained-lease` with the same toolchains. Set `LEAN_BRIDGE_WIT_LEASE_PACKAGE_EVIDENCE` to a new directory to keep all four releases. The driver builds Depot and Peer independently for each route, verifies their receipts, removes the producer directories, relocates the installs, and compiles the consumer against both installed headers and libraries.

The [cross-package client](../../tests/fixtures/wit-task-package/retained-leases.c) receives a Ticket from Depot, then drops its last external owner inside a Peer callback. Peer still updates that Ticket twice, from 11 to 42 to 73. A separate case revokes the callback after the first update and observes 42. A failed EIO factory returns a separately owned reference to the original Ticket.

Before the fix, retiring the broker left an untouched session able to register a callback and a new session able to open. Both returned `OK`. The [regression client](../../tests/fixtures/wit-task-package/retained-lease-retire.c) retires the runtime before observation in one process and inside a running callback in another. On both routes the pending observation and both packages' attempts to open new sessions returned `UNAVAILABLE`. Retirement also refused a new registration, lease comparison and lease retention. Cleanup destroyed the callback context once and left zero live broker identities after one initialization.

| Installed package | Archive SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| ordinary peer | `43c27acec4331b7af1c0f9259fbc799792b8d0d3c3480ed6d56e398ac25d1783` | `9b3241e47316fccd2036dbbbf882672ffa5a1d420bb146a5b4258bb6dde5fc9a` |
| ordinary depot | `32a1ec197b0b0fbeec72d22b38a20b026a5dce88c9836e19e249e6ff683c8dca` | `b407a4e150ffb97c916e3ed8b47c29cc813d434863e454438a8efb6b5b0275e2` |
| reviewed peer | `adcfbd214b8d021738fc58709e054e0ef8af110ab94f885aed8328b7ec116cdf` | `133969aa8a0fdde8e141959193a312f7fc08e79d4d303dfc61c6c735b22284f6` |
| reviewed depot | `df73ec336bfba2815f47465c8a3421be24397123388cc1f46804b341a9556d9f` | `752d11adf88b0deeac957c1d575e6df988483dfd932292f373722e080292c115` |
