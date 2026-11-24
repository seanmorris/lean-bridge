# JavaScript host objects: compiler and WebAssembly checks

Lean called a JavaScript constructor, instance method, getter and setter from
compiled WebAssembly. This is a producer integration check, not an installed
npm example. The C provider in the check implements one test contract; it is
not a general-purpose adapter.

| Check | What it establishes |
| --- | --- |
| `npm run test:javascript-host-imports` | The ordinary and reviewed Workshop sources compile against the generated `LeanBridge.Host.Javascript` module. Analysis identifies the actual extern symbols, alias result and mapped EIO error. An outdated review, a foreign symbol or scheduler, and a shadow module are rejected. |
| `node --test tests/javascript-host-members.test.mjs` | The host dispatcher calls the supplied class, respects the receiver, and rejects invalid member arguments and results. |
| `npm run test:javascript-host-wasm` | Lean 4.32.2 compiles Workshop and a caller; Emscripten 6.0.6 links them into a side module. The test loads it into the prepared single-threaded runtime and calls an application-owned class in Node. |

In the Wasm check, Lean writes through an alias, reads through the original
object and gets **42**. On the second call the JavaScript method throws; the
test provider returns an IO error and Workshop maps it to `"host read failed"`.
A third call returns the unsigned value `4294967294`, showing the runtime
still works. All six object leases are released, including both on the error path.

The compiler check produced public IR SHA-256
`01527484acdfc11ada86f0bb94d52fbf6bed0de60d4c92a549d3523595735b57`
and generated host C SHA-256
`b9eb13acd9f8e911f63e87b2a4437f06527934d3d9ded6e991b9f9b3fabd1714`.
For a local rerun, set `LEAN_BRIDGE_LEAN_PREFIX` to the pinned host Lean
prefix. The Wasm check also requires `LEAN_BRIDGE_JS_EMSDK` (pinned SDK),
`LEAN_BRIDGE_JS_TARGET_RUNTIME` (patched browser Lean tree with its target
headers), and `LEAN_BRIDGE_RUNTIME_ROOT` (directory containing the prepared
`main.mjs` and `main.wasm`). Neither check downloads a toolchain.

These results do not establish cross-package canonical identity, preservation
of a JavaScript exception through an unchanged Lean IO error, or installation
in Node, browser and Worker consumers. Those require a generated provider and
tests against separately packaged components.
