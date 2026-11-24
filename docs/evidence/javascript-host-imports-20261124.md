# JavaScript host objects: compiler and WebAssembly checks

Lean called a JavaScript constructor, instance method, getter and setter from
compiled WebAssembly. This is a producer integration check, not an installed
npm example. Three checks exercise the import boundary: a hand-written C
provider, generated member calls, and two separately compiled components that
share the runtime's object registry.

| Check | What it establishes |
| --- | --- |
| `npm run test:javascript-host-imports` | The ordinary and reviewed Workshop sources compile against the generated `LeanBridge.Host.Javascript` module. Analysis identifies the actual extern symbols, alias result and mapped EIO error. An outdated review, a foreign symbol or scheduler, and a shadow module are rejected. |
| `node --test tests/javascript-host-members.test.mjs` | The host dispatcher calls the supplied class, respects the receiver, and rejects invalid member arguments and results. |
| `npm run test:javascript-host-wasm` | Lean 4.32.2 and Emscripten 6.0.6 compile the providers and a shared identity broker. Node runs the probes in the prepared single-threaded runtime, including two independent components loaded in both orders. |
| `npm run test:javascript-host-public` | Capture a Lake project, elaborate its public functions and generate the caller-facing entry. Call all eight source-derived methods from JavaScript on the prepared Wasm heap. |

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

The third check loads the shared broker once per heap. Alpha and Beta compile
independently and bind the same application classes. When given the same
instance they receive the same **Lean wrapper**, checked inside Wasm rather
than inferred from matching JavaScript values. Distinct live objects have
distinct wrappers. A weak object is released when its last Lean reference
goes away; an explicitly admitted strong result survives until the last
binding closes. One component can call back into the other without mixing
bindings or exceptions. Closing one binding leaves the other usable. Closing
the last invalidates even a reference retained by Lean; rebinding does not
revive it.

The public-entry check removes the hand-written call entry. It binds the
application's `Box` class, calls `make(41)`, writes `42`, and receives the
same instance from `identity`. An invalid constructor argument fails before
the application constructs an object. Returned `Except` branches appear as
nested `{ok: …}` / `{error: …}` values. A typed EIO failure carries its
declared error identity and payload (including an actual host object);
ordinary Lean IO errors carry their message. An unchanged JS throw is
delivered as-is, even when the thrown object looks like a Lean declared
failure. After `dispose()`, subsequent calls fail. This eight-function test's
public IR SHA-256 is
`ddd893093c382f5ebf8c3da754fcfc115dfb7d65c010b1018fe13fd6a2c6cbe7`.

The ordinary IO error in this fixture uses a fixed message. Formatting its
unsigned argument into the message reached `Array.mk` (`lean_array_mk`),
which the current effect checker does not admit on that call path. The test
does not establish support for that formatting path.

These are compiled side modules loaded directly, not installed npm packages.
The npm release writer, shared package loader and installed Node, browser
and Worker checks remain.
