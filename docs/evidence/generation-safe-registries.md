# Generation-safe registry evidence

Status: measured architecture POC evidence.

The POC implements a registry kernel on each side of the language boundary. The Lean registry retains Lean objects that JavaScript wrappers own. The JavaScript registry is ready to retain host objects for Lean. Both registries issue opaque 32-bit tokens with the same layout:

| Bits | Field | Purpose |
|---:|---|---|
| 31 | side | `0` identifies a Lean value. `1` identifies a host value. |
| 30 through 24 | nominal kind | Identifies the declared resource type. |
| 23 through 12 | generation | Changes whenever a slot is reused. |
| 11 through 0 | slot plus one | Locates the registry entry. Zero remains invalid. |

Tokens do not contain Wasm pointers. A consumer cannot read or write them through the generated API.

The Lean registry lives in the one main Wasm module. Each slot stores a `lean_object *`, but only after the registry validates the token's side, kind, slot, and generation. A release clears the pointer before decrementing the Lean reference count, then advances the generation. A slot retires instead of wrapping generation 4095 back to generation 1. The POC allocates 1,024 Lean slots. Exhaustion fails instead of returning an unchecked pointer.

The host registry lives in the JavaScript runtime context shared by every library loader for one Emscripten module. It assigns the same live token when the bridge retains the same JavaScript object under the same nominal kind. Each retain acquires a lease. Each release removes one lease. The final release clears the strong reference and advances the slot generation. A token from another runtime cannot resolve against an empty or incompatible registry. The callback registry applies the same layout to JavaScript functions and adds the generated signature identity, invocation count, active frame count, and self-disposal policy. A callback borrowed for one call releases its final lease before the public function returns.

## Native wrapper behavior

`await libraries.load(alpha)` returns a native `Box` class. Construction obtains a private Lean token and records one retained lease. Instance methods borrow the token for the duration of the call. `box.identity()` returns the same JavaScript object because the registry finds the existing canonical wrapper:

```js
const box = new alpha.Box(42);

box.read();              // 42
box.identity() === box;  // true
box.dispose();
```

Calling a method after disposal raises `LeanBridgeError` with code `resource-disposed`. Applying a class method from another runtime raises `cross-runtime-handle`. Applying a method from another declared resource class raises `wrong-handle-kind`. The error reaches JavaScript before the Lean function runs.

Every module instance has a private runtime identity and epoch. `libraries.shutdown()` releases live Lean wrapper leases, clears retained host values, asks the main module to finalize the Lean runtime, advances the epoch, and rejects later calls. Multiple loader objects created for the same module share the context, registry, and projected class constructors.

## Ownership matrix

| Direction and value | Boundary ownership | Normal release | Fallback |
|---|---|---|---|
| copied Lean value to JavaScript | no retained identity | call arena ends | none required |
| Lean object retained by JavaScript | one Lean registry lease | generated `dispose()` or runtime shutdown | `FinalizationRegistry` queues a release for the next safe bridge entry |
| Lean object borrowed by an instance method | call-scoped borrow | generated call frame ends | `finally` unwinds the borrow counter |
| JavaScript object retained by Lean | one host registry lease per retain | generated Lean-side release or runtime shutdown | no GC shortcut while Lean still owns the value |
| JavaScript object borrowed by Lean | call-scoped borrow | generated call frame ends | `finally` unwinds the borrow counter |

`FinalizationRegistry` never invokes Wasm from the garbage collector callback. It only queues a holding record. The next bridge entry checks that the wrapper is unreachable, the token still names the same entry, and the runtime epoch is current before releasing it. Explicit disposal unregisters the fallback. Correctness does not depend on garbage collection timing.

The POC does not collect JavaScript to Lean cycles automatically. An API that retains values in both directions needs an explicit ownership cut.

## Counters and tests

The loader exposes a read-only diagnostic snapshot with live wrapper counts, wrapper reuse, rejected operations, total and active borrows, acquired and released leases, queued finalizations, and host registry activity. It does not expose tokens or pointers.

The tests establish:

- Lean token layout and nominal kind;
- rejection of forged side and kind bits;
- stale generation rejection after slot reuse;
- double-release rejection;
- fail-closed behavior at the declared Lean registry capacity;
- canonical wrapper identity;
- nominal and cross-runtime JavaScript rejection;
- call-scoped borrow counters returning to zero;
- deterministic disposal cancelling fallback finalization;
- queued finalization releasing an unreachable wrapper at a safe entry;
- canonical host-object tokens and balanced retained leases; and
- terminal runtime epoch shutdown.

## Architecture lens result

1. Shared runtime: all libraries in one main module use the same Lean registry and JavaScript runtime context.
2. Native API: users construct, call, compare, and dispose normal JavaScript objects. Tokens remain private.
3. Assurance identity: diagnostics distinguish checked registry invariants from unverified application behavior.
4. Reproducibility: the registry kernel is built in both locked browser and threaded profiles.
5. Host neutrality: side, kind, slot, generation, borrow, and lease semantics do not depend on a JavaScript class layout.
6. Verified reuse: nominal resource kinds can become stable binding IR identities rather than handwritten numbers.
7. Adoption: the safe ownership path is the ordinary class path. Consumers do not learn Lean reference counting.
8. Composition: independent libraries preserve one Lean identity without pointer translation or per-library registries.
