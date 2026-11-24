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

### Host identity while a Lean worker holds the object

`npm run test:javascript-threaded-host-identity` compiles a Lean task and
links two separate Wasm components against the pthread SDK. Set
`LEAN_BRIDGE_LEAN_PREFIX` and `LEAN_BRIDGE_JS_EMSDK`. Supply a freshly
built SDK with `LEAN_BRIDGE_TEST_TASK_INPUTS`, or set
`LEAN_BRIDGE_JS_THREAD_CORE` (and `LEAN_BRIDGE_JS_THREAD_INIT` for a
separate Init archive) to build it during the test.

One component parks a real worker holding an application object. The other
component gets the same Lean wrapper when given the same JS object. Across
65 runs, dropping the completed task or closing the last binding leaves no
host pins. The test also checks 128 short-lived weak wrappers, strong
retention until retirement, wrong-kind lookups, rejected worker-side host
access, and cooperative cancellation. The worker confirms the cancellation
flag and can return a late result after the nominal kind has been rebound.

The private index owns one multithreaded Lean reference per wrapper. Only
the runtime owner touches the index and JS domain; the worker finalizer
frees native storage. The owner evicts a weak row when its reference is the
last one (MT count -1 on pinned Lean 4.32.2). Before announcing completion,
the notification adapter maps the typed result to `Unit`. Without that
step Lean's map closure can still retain the original task when JS handles
readiness: the previous adapter failed the zero-pin assertion on this test.

This verifies wrapper identity and retirement on Node with actual Wasm
pthreads. The exported package interface for threaded host objects is a
separate step from testing these runtime primitives.

### Calling application methods from a Lean pthread

For the threaded profile, the generator emits the same typed Lean externs
but dispatches their calls on the JavaScript agent that owns the component.
The worker marks its Lean arguments as shared and lends them to the owner
until the synchronous method returns. The owner uses the existing scalar
codec and class checks. Emscripten's system queue can run inside runtime
locks, so each request uses an application queue instead. The owning JS
event loop never waits for the worker to return from the host method.

A thrown JS value is associated with the exact Lean `IO.Error`. This
works even when concurrent tasks use the same class or throw errors with
identical messages. Catching or replacing an error in Lean releases the
ticket once the last Lean reference is gone and the owner collects.
Returning the original error copies a delivery ticket before dropping the
native result. This preserves thrown `undefined` and keeps invalid
returned values distinct from application exceptions.

The pthread host test compiles the generated Lean declarations and C shims
into separate components. It exercises constructors, properties, methods,
nested owner reentry, overlapping failures collected in reverse order,
and a member queued before its binding closes. This is compiler/runtime
evidence, not an installed public API: project analysis still rejects that
combination until the task packager and public result adapters support it.

All 70 assertions passed on each of three owners: Node, a cross-origin
isolated Chromium page, and a Chromium module worker. Each owner started
its own Lean pthread runtime. The Lean oracle round-tripped all 19 copied
scalar types, including a string containing a BOM, emoji and NUL, a
copied `ByteArray`, and signed and unsigned 160-bit magnitudes. Chromium's
`TextDecoder` rejects views backed by shared Wasm memory, so that path
snapshots the string bytes first. Non-shared heaps still decode directly.
Set `LEAN_BRIDGE_CHROMIUM` if the Playwright default binary is unavailable.

The final case injects an unexpected exception inside the owner bridge.
The proxy returns to Emscripten so the waiting worker wakes and fails; the
owner receives the original infrastructure exception, refuses new bindings
and retains no JS object pins or error tickets. This is separate from a
declared host method throwing, which leaves the runtime usable.

The test applies the package verifier's dynamic import check before linking
each side module. In particular, the wasm32 minimum `ISize` exercises
pinned Lean's `lean_isize_of_big_int`: compiling the signed integer
declarations alone does not make that runtime function available to a DSO.
