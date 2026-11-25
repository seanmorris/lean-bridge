# Guest-owned WIT objects in compiled Lean workers

This is a local integration result, not an installed WIT package receipt. The [application](../../tests/fixtures/static-host-workers/guest-box.wat.in) defines a mutable resource; only the defining guest knows where it keeps the value. A [second, independently compiled guest](../../tests/fixtures/static-host-workers/guest-peer.wat.in) imports the resource via WIT and returns an independently droppable alias.

The [integration probe](../../tests/fixtures/static-host-workers/guest-box.c) runs the composed component under Wasmtime 42 and calls the actual compiled Lean library. A Lean task returns the original object. A retained callback re-enters Lean, changes its value, and leaves a second, equal-valued object untouched. Rebinding the same resource type preserves identity; a distinct defining instance in the same store and an instance in a different store are rejected.

The probe counts guest destructor calls, closes stores with outstanding references, and checks that dropping invalidated slots does not access a deleted store. A guest destructor that traps poisons the adapter: no further guest call is admitted, and closing the store still releases the remaining wrappers. No Lean compiler, Wasm tool or network access is required by the resulting probe executable.

To reproduce from the worktree, set `LEAN_BRIDGE_LEAN_PREFIX`, `LEAN_BRIDGE_WASM_TOOLS` and `LEAN_BRIDGE_WASMTIME_C_API` to the pinned toolchains, then run:

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

The worker in this run has SHA-256 `08cf10e2dcb54e7e2f6a29fa675ea2cf87dd15806dec96131aacb08b47f94c34` and 52 native exports. The owner domain and lease library digests are unchanged. This is a compiled integration with a fixture-specific two-operation facade, not an installed WIT release. The generated full operation facade, public object-bearing futures and streams, and install receipts are still outstanding.
