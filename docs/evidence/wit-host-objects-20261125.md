# Guest-owned WIT objects in compiled Lean workers

This is a local integration result, not an installed WIT package receipt. The [application](../../tests/fixtures/static-host-workers/guest-box.wat.in) defines a mutable resource; only the defining guest knows where it keeps the value. A [second, independently compiled guest](../../tests/fixtures/static-host-workers/guest-peer.wat.in) imports the resource via WIT and returns an independently droppable alias.

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

The clean run produced 53 native exports; the worker SHA-256 is `8c3ac7651f0f42c794096e4551248a7e311da31fb01193e260391c175fffc64e`. This is still a locally composed integration. The public object-bearing asynchronous interface, ordinary and reviewed package installations, and their release receipts remain outstanding.

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

This is a private build and runtime result, not an installation receipt. `Task.pure` makes the test deterministic; dropping before native take is **not** evidence that a long-running computation stopped. The build inventory still lists `Jobs.outcome` (returned `Except`), `Jobs.reject` (factory error), `Jobs.relay` (retained callback), and `Jobs.series` (iterator) as outstanding on this Wasm interface.
