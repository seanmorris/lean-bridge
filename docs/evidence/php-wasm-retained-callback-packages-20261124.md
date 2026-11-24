# PHP-Wasm retained callback packages

The [Relay module](../../tests/fixtures/javascript-wasm-retained-tasks/Relay.lean) calls a PHP closure from a Lean task. The PHP closure runs on the interpreter that started the task. The [PHP application](../../tests/fixtures/php-wasm-task-owner/callbacks.php) also starts a task in an independently packaged [Jobs module](../../tests/fixtures/javascript-wasm-generated-tasks/Jobs.lean). Jobs cannot finish until Relay's PHP callback releases it. The application awaits Jobs first and needs no scheduler of its own.

| Case | What the installed application checks |
| --- | --- |
| Nested invocation | The worker calls PHP; PHP awaits another worker whose callback calls synchronous Lean. Each callback receives its own value. |
| Retained identity | Two callbacks throw distinct exceptions with identical messages. Rethrowing the original Lean error yields the corresponding PHP object, even on a second await. Catching or replacing that error in Lean changes the outcome. |
| Cancellation and disposal | Self-cancellation rejects the await once and discards the late reply. Closing a callback registration allows the current reply but refuses its next invocation. Dropping an unobserved owner releases its PHP callable. |
| Failed conversion | An invalid PHP return fails the submitting task. The shared executor remains usable. |
| Malformed private reply | The [installed worker probe](../../tests/fixtures/php-wasm-task-owner/malformed.mjs) sends both an invalid return and an invalid exception packet. Each task drains its native owner. A subsequent Lean worker on the same executor returns 2. |
| Lost worker | In Chromium a real pthread fails with a callback in flight. The pending task and new calls fail; the retired executor reports no live host frames, allocations, operations or notifications. |
| PHP engine trap | A PHP `Error` is not a Lean-recoverable callback exception. The [fault application](../../tests/fixtures/php-wasm-task-owner/trap.php) checks original object identity and refusal of pending and new work in the peer package. |

The application's `awaitCleanup()` waits for one operation to finish releasing its native owner. Cancellation itself does not wait. The browser's pthread pool permits two concurrent callback waits; an exhausted pool reports an error, not another queued worker. No measurement from a destroyed heap is used as a native-owner count.

The [archive fingerprints](php-wasm-retained-callback-packages-20261124.json) record the public interface, side module, npm host, Composer API and package receipt for each of the three handoffs. They all install the same runtime archive.

## Reproduce

Use Node 22, Composer, PHP-Wasm 0.1.0 with PHP 8.4, Chromium and the [pinned pthread author SDK](../publish/npm.md#build-a-threaded-npm-handoff). Set `LEAN_BRIDGE_TEST_TASK_INPUTS` to the verified callback-capable SDK directory, `LEAN_BRIDGE_LEAN_PREFIX` and `LEAN_BRIDGE_JS_EMSDK` to its matching tools, and `LEAN_BRIDGE_PHP_WASM_HOST` to the installed php-wasm package. Run `npm run test:php-wasm-task-callbacks`. A new `LEAN_BRIDGE_PHP_TASK_EVIDENCE` path retains the releases with a `-callbacks` suffix. The older SDK for copied tasks lacks `lean_bridge_wasm_callback_acquire_v1` and cannot link this component.

The [author gate](../../tests/helpers/php-wasm-task-cli.mjs) installs the packed CLI, builds Jobs and Relay separately, rebuilds Relay against an independent PHP review, and refuses a review that changes the callback to promise delivery. The [consumer gate](../../tests/helpers/php-wasm-task-installed.mjs) installs the npm and Composer packages offline, removes the feed and relocates the app. Its Node and Chromium applications exercise the real workers. PHP receives synchronous callables and PHP exceptions; the worker's private JavaScript binding is not the reviewed public interface.
