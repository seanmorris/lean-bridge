# PHP-Wasm: pass a Lean object between installed packages

The [Depot](../../tests/fixtures/javascript-wasm-resource-tasks/Depot.lean) and [Peer](../../tests/fixtures/javascript-wasm-resource-tasks/Peer.lean) packages both import [Shared.Ticket](../../tests/fixtures/javascript-wasm-resource-tasks/Shared.lean). They have different component binaries, but agree on the identity of that Lean type and install one shared worker runtime. The [PHP consumer](../../tests/fixtures/php-wasm-task-owner/leases.php) uses only generated public classes and functions to handle resources.

| Case | Observable result |
| --- | --- |
| Independent handles | After the original ticket closes, both its retained handle and the result from the peer see the same mutation. Closing twice has no effect. A badge, a closed ticket and a constructor-bypassing reflection object cannot substitute for a live ticket. |
| Results and failures | Repeated awaits return one PHP object. A synchronous factory error and a later iterator-step error each carry their own ticket. A yielded ticket outlives its cursor. Exhaustion, exception and early break close exactly three cursors. |
| Cancellation | Cancellation stops delivery. Releasing the already-running worker still changes the shared value from 19 to 26. Its late result is reclaimed. Dropping a ready, never-awaited task does not leak its ticket. |
| Retained callback | [Mutate.usingCallback](../../tests/fixtures/php-wasm-task-owner/Mutate.lean) sends the current count to PHP. PHP adds 7; Lean writes 33 and returns a ticket for the same object. A thrown PHP exception is delivered as the original object. |
| Worker loss | A browser pthread fails with a ticket held and another result pending. PHP cannot start new work, the ticket reports closed, and the executor stays retired. |

The author test packs and installs the CLI, builds the peer, and builds Depot twice: once from source and once against a separate reviewed interface. Changing the resource identity in that review must fail before creating a handoff. The consumer installs the archives offline, removes the feed, moves the app, then runs it using the embedded PHP API, Composer autoload, and isolated Chromium. On healthy shutdown it checks zero live native owners, frames, pending operations, allocations, and notifications. On worker loss only the surviving host state is measurable.

To reproduce, use the matching compiler, Emscripten, callback-capable pthread SDK, PHP-Wasm host and Chromium described in the [retained callback setup](php-wasm-retained-callback-packages-20261124.md#reproduce). Run `npm run test:php-wasm-task-leases`. Set `LEAN_BRIDGE_PHP_TASK_EVIDENCE` to a fresh path to retain the three handoffs with a `-leases` suffix. The [fingerprints](php-wasm-task-leases-20261124.json) identify their source, reviewed interfaces, worker binaries, and installable archives.
