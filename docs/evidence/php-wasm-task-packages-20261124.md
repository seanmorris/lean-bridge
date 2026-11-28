# Installed PHP-Wasm task and iterator packages

The [Jobs project](../../tests/fixtures/javascript-wasm-generated-tasks/Jobs.lean) compiles to a pthread-enabled Lean worker and a typed PHP API. The host module registers the transport through the PHP-Wasm descriptor passed to the constructor. The [PHP consumer](../../tests/fixtures/php-wasm-task-owner/installed.php) uses generated PHP functions and classes. It has no JavaScript scheduler, FFI calls, or handles.

| Consumer action | Observation |
| --- | --- |
| Start a parked task, run synchronous IO, and await twice | Both awaits return the same PHP object holding 4294967295. |
| Cancel a pending task, then let its worker finish | The first cancellation succeeds. Both awaits throw the same PHP cancellation exception. |
| Fail while starting a task | The call throws the factory's `IOError` or declaration-specific EIO exception before returning an awaitable. |
| Fail inside a worker, or return a Lean `Except.error` instead | The former throws `TaskIOError` from `await()`; the latter delivers an `Err` value. |
| Iterate, break early, or drop an unopened cursor | Lean's close counter advances once per cursor. A failed pull names the step declaration and carries its `UInt16` payload. |
| Pass copied values through 32-bit Zend | Negative arbitrary-precision integers and UTF-8 with an embedded NUL survive. Invalid PHP types and out-of-range `UInt32` values fail without releasing the parked task. |

## Reproduce

Set `LEAN_BRIDGE_TEST_TASK_INPUTS` to the verified [pthread author SDK](../publish/npm.md), `LEAN_BRIDGE_LEAN_PREFIX` to Lean 4.32.2, `LEAN_BRIDGE_JS_EMSDK` to the matching Emscripten installation, and `LEAN_BRIDGE_PHP_WASM_HOST` to the installed `php-wasm@0.1.0` directory containing `PhpNode.mjs` and `PhpWeb.mjs`. The gate uses Node 22, npm, Composer, and Chromium. `LEAN_BRIDGE_CHROMIUM` can select the browser executable.

Run `npm run test:php-wasm-task-packages`. Set `LEAN_BRIDGE_PHP_TASK_EVIDENCE` to a new directory to retain the handoffs. The [author gate](../../tests/helpers/php-wasm-task-cli.mjs) packs and installs the CLI, builds the ordinary source, then independently rebuilds against a reviewed interface. It verifies the package-set receipts. Changing the result of `Jobs.exact` from `Int` to `Bool` must invalidate the old review before the CLI writes a handoff.

For each release the [installed consumer gate](../../tests/helpers/php-wasm-task-installed.mjs) installs the npm archives and Composer ZIP offline, removes the local feed, and moves the application before running it. Node exercises both the npm-bundled PHP API and Composer's autoloader. Chromium runs the same PHP consumer in a cross-origin-isolated page. At the end of normal operation the executor reports zero frames, allocations, pending operations, notifications and live native owners.

In a separate [browser fault test](../../tests/helpers/php-wasm-task-browser.mjs), PHP starts a pending task and a Lean pthread raises an uncaught error. The PHP caller catches `LeanBridgeError` from both the pending await and a new call. The executor remains poisoned and retains the original worker error. Host frames, allocations, pending operations and notifications return to zero. The destroyed heap cannot report its native owner count.

The synchronous Zend profile uses a different heap. The Jobs archives below contain copied-value operations, not live Zend objects or PHP callbacks. The later [Relay package checks](php-wasm-retained-callback-packages-20261124.md) cover retained PHP callbacks.

## Tested archives

SHA-256 of the files in each `packages/php-wasm/` handoff:

| Artifact | Ordinary build | Reviewed build |
| --- | --- | --- |
| Package-set receipt | `2fa37ca92510af44b217e3719ba5e6e004adf6a0c06dfbb2b647862770434cc8` | `267ed8f683530e3c69128caa0f0b778be44e540be6933bd4115aa903493b5dcb` |
| npm host module | `e135fae94ab450bba5fbb447925f5908355e0a0a0db0399e8e62cd450301d648` | `0c765d3c5c501054763f70f91163d82e11bc17afb5475db6805781b5c41b4390` |
| Composer API | `3a08f35e4f06c9b18947d5721ca4f7641ecc09d1ae544dfb6d5fe63b7a6c368c` | `16329b29ace54f4db5f619537822bbe51537e339b0c22fce76706df717e066cf` |

Both builds use the same npm runtime archive: `dd863a24c06233d0c8d916c7db9d612aebf00b25e46784316fea9835dd5e9e50`.
