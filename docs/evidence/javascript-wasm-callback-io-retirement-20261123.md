# A guest trap during a synchronous npm callback

Two separately built Lean packages, `owned-aggregates` and `@example/ledger-io`,
ran in one offline npm install with exactly one copy of `@lean-bridge/runtime`.
The host invoked a returned Lean closure, borrowed a ticket, and re-entered
both packages through nested callbacks. Throwing a JavaScript exception
preserved the original object, even when it was a `WebAssembly.RuntimeError`.
Ledger's declared `EIO` and `IO.Error` kept their generated classes and payloads.
The counter still read 4 and the original ticket was usable after those failures.

To distinguish a real guest trap from JavaScript throwing an error with the
same name, the test also links a [test-only C side module](../../tests/fixtures/javascript-wasm-callback-io/fault.c).
Its sole operation executes Wasm `unreachable`. It is not part of either
application package. The normal bridge loader checks its digest and calls it
through the same scalar trampoline. A test observer forwards the callback
adapter's real finish import and counts invocations without reading heap
memory after the trap.

Before the fix, every public call after the trap was rejected, **but the
suspended callback still resumed its native finish hook**. The callback
adapter only knew about its own retirement flag. Rechecking the shared
runtime before returning a recovery status stops the foreign frame instead.

The same ordinary callback package was tested against both the ordinary
Ledger handoff and a separate reviewed Ledger handoff. Counts below are
per handoff.

| Host | Import orders | Callback behavior | Checks | Native finish hooks per run |
| --- | --- | --- | ---: | --- |
| Node.js | IO first, callbacks first | Catch and return; rethrow | 4 × 23 | 8 before trap, 0 afterward |
| Chromium | IO first, callbacks first | Catch and return; rethrow | 4 × 23 | 8 before trap, 0 afterward |
| Node worker | Callbacks first | Rethrow | 1 × 23 | 8 before trap, 0 afterward |

The rethrown trap retained its identity. Swallowing it did not allow the
outer call to succeed. Later IO calls, callbacks, ticket methods, closure
calls, and the fault component all rejected use of the retired runtime.
Both leases and the owning component could still be closed idempotently.

The Node `worker_threads` run kept a ticket and counter alive in
the parent while the worker exercised the 23 checks and retired its own heap.
After the worker exited, the parent could read the ticket and advance its
counter from 20 to 21. Retirement applies to one runtime instance, not to
the entire process. Across the two handoffs the nine realms each ran 23
checks (414 total, excluding the parent assertions).

| Archive | SHA-256 |
| --- | --- |
| Ordinary Ledger | `b41d2ffa5cfa561d0e1207e95481056316d166e29af67366d0cde6c9140e47ed` |
| Reviewed Ledger | `16abc68d14c8257140981daa365f373b51865db359b57151c04d69e84cc04df0` |
| Owned callbacks | `e438fcdbf305e735d4b9527cf883aa8dd13c54a2fe3a3bfcf635d733c829a89b` |
| Shared runtime | `6a39b125175cf52d9c725bf672b0e59c6ad6202b19b5c33942a5493ef817ba3b` |

The separate `test:javascript-sync-io-package` gate reproduced the ordinary
archives with an offline-installed author CLI. Each Ledger handoff also
passed 45 IO checks in each of Node and Chromium, strict TypeScript, and
the gate's five negative build cases.

To reproduce, set up the [npm author SDK](../publish/npm.md#export-synchronous-lean-io),
including `LEAN_BRIDGE_LEAN_PREFIX`, `LEAN_BRIDGE_JS_EMSDK`,
`LEAN_BRIDGE_JS_TARGET_RUNTIME`, and `LEAN_BRIDGE_RUNTIME_ROOT`. Install the
repository's Playwright Chromium or set `LEAN_BRIDGE_CHROMIUM` to the system
binary. Run `npm run test:javascript-callback-io`. To check existing handoffs
instead of rebuilding, set `LEAN_BRIDGE_JS_IO_RELEASE` and
`LEAN_BRIDGE_JS_CALLBACK_RELEASE` to their npm package-set receipt directories.
The test rejects different runtime archives. No registry or browser network
service is needed. This evidence covers synchronous callbacks in Node,
Node workers, and a Chromium page. It does not cover asynchronous settlement
or browser workers.
