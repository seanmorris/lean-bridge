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

The package builder currently refuses retained WIT callbacks. The remaining integration is to dispatch owned requests through the live Wasmtime store, handle cancellation and re-entry there, and run the generated public callback API from relocated packages. The [installed WIT lease checks](wit-task-resource-world-20261123.md#count-live-borrows-before-store-shutdown) cover mutable object ownership, not that callback path.
