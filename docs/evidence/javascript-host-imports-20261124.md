# JavaScript host objects: compiler and WebAssembly checks

Lean called a JavaScript constructor, instance method, getter and setter from
compiled WebAssembly. The producer probes isolate the import and ownership
rules. A separate package check builds with an offline-installed author CLI
and exercises the generated public API from a downstream npm install.

| Check | What it establishes |
| --- | --- |
| `npm run test:javascript-host-imports` | The ordinary and reviewed Workshop sources compile against the generated `LeanBridge.Host.Javascript` module. Analysis identifies the actual extern symbols, alias result and mapped EIO error. An outdated review, a foreign symbol or scheduler, and a shadow module are rejected. |
| `node --test tests/javascript-host-members.test.mjs` | The host dispatcher calls the supplied class, respects the receiver, and rejects invalid member arguments and results. |
| `npm run test:javascript-host-wasm` | Lean 4.32.2 and Emscripten 6.0.6 compile the providers and a shared identity broker. Node runs the probes in the prepared single-threaded runtime, including two independent components loaded in both orders. |
| `npm run test:javascript-host-public` | Capture a Lake project, elaborate its public functions and generate the caller-facing entry. Call all eight source-derived methods from JavaScript on the prepared Wasm heap. |
| `npm run test:javascript-host-package` | Build ordinary Workshop, ordinary Peer, and separately reviewed Peer. Verify their handoffs and install Workshop and reviewed Peer with the same runtime. Exercise the installed exports in Node and Chromium; type-check a downstream program. |

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

The original fixed-message fixture hid two dependencies of `s!"reading {value} refused"`.
In pinned Lean 4.32.2, [`Array.mk`](https://github.com/leanprover/lean4/blob/f3b06c705e6c85f5314019d5d3baab0fec5b580c/src/runtime/object.cpp#L490)
delegates to [list-to-array conversion](https://github.com/leanprover/lean4/blob/f3b06c705e6c85f5314019d5d3baab0fec5b580c/src/Init/Data/List/ToArrayImpl.lean#L35).
[`System.Platform.getNumBits`](https://github.com/leanprover/lean4/blob/f3b06c705e6c85f5314019d5d3baab0fec5b580c/src/runtime/platform.cpp#L12)
returns the target pointer width. The checker recognizes each exact Lean
declaration, defining module, and external symbol. Neither grants OS access
or admits other array or platform operations by name.

Workshop's packaged compiler audit identifies 18 native leaves for this
function, with no OS grants. Inputs `7` and `4294967295` produce
`IOError` messages containing their decimal values. The next call, with
input `9`, succeeds on the same heap. Node (both load orders), the Chromium
page and its module worker all observed these results. A separate source
export combined the same formatting with `IO.getEnv` and `IO.FS.readFile`.
The packed CLI reported both undeclared capabilities in one build and
created no release directory.

The shared loader reconstructs the public ABI from both IR documents and
checks both Wasm binaries before linking either. The public-entry test counts
links: bad integrity, a modified control symbol and a broker substituted for
the component all leave the count at zero. The valid descriptor links exactly
one broker and one component, even with simultaneous requests for the package.

For the installed check, supply the same SDK variables as for the public-entry
test. Set `LEAN_BRIDGE_CHROMIUM` to an installed Chromium binary if Playwright's
default is unavailable. The test verifies the separately reviewed interface
and the original host contract from the archives. It installs the exact
runtime dependency offline. Only the producer sees the author toolchain;
the consumer imports its package and supplies its own `Box` class.

The 2026-11-24 local handoffs contain these npm archive bytes:

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Shared runtime (identical across all three builds) | 1,662,308 | `d6bbf3f381933da59c6033f45d0b97b6681667cce1abfd63193fbd4cc95c43fe` |
| Workshop, ordinary | 17,137 | `73a2b29b77468ae2b8efe2b8c286e42e0a1e70cd8addbd41d6417fd4be0f73cf` |
| Peer, ordinary | 14,462 | `f83fa2354420d2aa9e70f36f48383ffddc0905f0226a4246b552b21c6b0055ea` |
| Peer, reviewed | 15,671 | `29cdbf0504b45fcb81dcb9932e8f7934e738a933f2dab94f64b5b7ba9e2de4ab` |

Node passed in both load orders. The Chromium page (Workshop first) and a
separate module worker (Peer first) returned the same observations. An object
created in one package remained the same object in the other; nested calls
observed the same mutation. The consumer caught the original JavaScript
throw, the declared Lean IO error, and the typed EIO carrying the original
object on their respective paths. A conflicting live class was rejected.
Disposing one binding left its peer usable. Strict TypeScript retained the
consumer class's extra method and rejected a wrong instance or integer type.
No package was published to a registry.
