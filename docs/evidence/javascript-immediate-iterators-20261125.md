# Synchronous Lean iteration in installed npm packages

The [Pulls implementation](../../tests/fixtures/javascript-immediate/Pulls.lean)
was built twice: once from selected Lean exports and once from a reviewed
interface. Each release was verified and installed offline. There were five
independent downstream clients per release:

| Client | What actually ran |
| --- | --- |
| Node JavaScript | Two interleaved cursors, early break, exhaustion, a caller exception, and close before first demand. The complete exercise counted 13 pulls and 7 closes. |
| Node TypeScript | A strict TypeScript program compiled **and ran**. It used the declared factory and step error classes, and checked that neither a promise result nor async iteration typechecked. |
| Browser JavaScript | Chromium ran the JavaScript checks on its own heap. Removing a same-origin iframe closed two live cursors. A simulated cached-page event before removal left them usable. |
| React | A real DOM click ran a component handler, pulled 0 and 1, broke, updated the button text to `0,1`, and advanced the native counters by two pulls and one close. |
| Browser worker | A dedicated module worker independently imported the installed code, ran the 13-pull exercise, and sent its results back before termination. |

The ordinary package-set SHA-256 was
`4241d37a77e231b8344db86a89077e93856a3952eb21f0131a6eb08ba78af60d`;
the reviewed package set was
`8336a16e80dad9b6b828195c4f5f369479435ac0599e5eccca5f12404e2f0509`.

The Node process-exit test left two cursors live, pulled once, then returned
normally. A later exit listener saw two finalizations and two exhausted
iterators. Abrupt process death and forced worker termination are not
JavaScript finalization hooks.

The [shared consumer checks](../../tests/fixtures/javascript-immediate/calls.mjs)
distinguish a yielded unit from exhaustion, a returned `Except.error` from
an exception, and typed factory errors from later pull errors (including
Lean's IO message). The browser deployment verified the hashes of the
installed component and runtime Wasm files before deleting the consumer
tree and serving only the bundle.

The separate [frame fault tests](../../tests/javascript-wasm-sync-io.test.mjs)
inject bad replies, a duplicate live identity, a lost close, and a Wasm trap.
They check shared-heap retirement without another native call. They do not
count as installed consumer runs or as a test of a resource-valued npm cursor.

## Reproduce

With the [synchronous npm author SDK](../publish/npm.md#export-synchronous-lean-io)
and Chromium available, run `npm run test:javascript-immediate-cursor`.
Use `LEAN_BRIDGE_CHROMIUM` for a system Chromium executable. The [install
test](../../tests/helpers/javascript-immediate-installed.mjs) prints both
verified package-set digests. These are local builds, not a hosted release.
