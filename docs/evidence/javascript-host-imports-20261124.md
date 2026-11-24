# JavaScript host objects: compiler and WebAssembly checks

Lean called a JavaScript constructor, instance method, getter and setter from
compiled WebAssembly. This is a producer integration check, not an installed
npm example. Two checks exercise the import boundary: a hand-written C
provider for one class and a provider generated from the authored contract.

| Check | What it establishes |
| --- | --- |
| `npm run test:javascript-host-imports` | The ordinary and reviewed Workshop sources compile against the generated `LeanBridge.Host.Javascript` module. Analysis identifies the actual extern symbols, alias result and mapped EIO error. An outdated review, a foreign symbol or scheduler, and a shadow module are rejected. |
| `node --test tests/javascript-host-members.test.mjs` | The host dispatcher calls the supplied class, respects the receiver, and rejects invalid member arguments and results. |
| `npm run test:javascript-host-wasm` | Lean 4.32.2 and Emscripten 6.0.6 compile both providers. Node loads each side module into a prepared single-threaded Lean runtime and calls a real JavaScript class. |

In the hand-written check, Lean writes through an alias, reads through the original
object and gets **42**. On the second call the JavaScript method throws; the
test provider returns an IO error and Workshop maps it to `"host read failed"`.
A third call returns the unsigned value `4294967294`, showing the runtime
still works. All six object leases are released, including both on the error path.

The generated check sends all 19 scalar types in both directions. It checks
160-bit integers, wasm32 word bounds, subnormal floats, embedded NUL and
leading BOM characters, and a modified byte array whose Lean input stays
unchanged. The generated externs borrow from the specified receiver or
parameter, pass transferred receivers, and permit synchronous reentry.

If a method throws, the call frame associates the thrown value with the exact
`IO.Error` sent to Lean. The test recovers that value, including `undefined`,
when Lean passes the error back unchanged. Lean can catch two errors with
the same message and rethrow the first. A newly constructed error with the
same text does not recover either JavaScript exception. A host method that
*returns* an invalid value produces a boundary failure; *throwing* that
boundary error from another method is an application exception. At the end
of these calls there are no live error tokens or object leases.

The compiler check produced public IR SHA-256
`01527484acdfc11ada86f0bb94d52fbf6bed0de60d4c92a549d3523595735b57`
and generated host C SHA-256
`b9eb13acd9f8e911f63e87b2a4437f06527934d3d9ded6e991b9f9b3fabd1714`.
For a local rerun, set `LEAN_BRIDGE_LEAN_PREFIX` to the pinned host Lean
prefix. The Wasm check also requires `LEAN_BRIDGE_JS_EMSDK` (pinned SDK),
`LEAN_BRIDGE_JS_TARGET_RUNTIME` (patched browser Lean tree with its target
headers), and `LEAN_BRIDGE_RUNTIME_ROOT` (directory containing the prepared
`main.mjs` and `main.wasm`). Neither check downloads a toolchain.

The generated test still supplies the object registry and public call entry.
It does not establish cross-package canonical identity or installation in Node,
browser and Worker consumers. Those require a shared identity implementation
and checks against separately packaged components.
