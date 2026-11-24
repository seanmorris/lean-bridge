# PHP-Wasm can await a worker in a separate Lean runtime

The Node host from `php-wasm@0.1.0` runs 32-bit PHP 8.4.1 with an unshared Wasm heap. The [PHP probe](../../tests/fixtures/php-wasm-task-owner/await.php) starts a [compiled Lean worker](../../tests/fixtures/javascript-wasm-retained-tasks/Relay.lean) in a separate, pthread-enabled Wasm runtime. PHP executes another statement before awaiting the result. The owner waits for both that statement and the Lean worker's callback before scheduling its reply on the next event-loop turn.

| Observation | What PHP received |
| --- | --- |
| Worker waited for a reply | 42 |
| Owner cancelled while the callback was waiting | A caught exception with code string `operation-cancelled` in its message |
| Lean threw after receiving the reply | A caught exception with `error:TaskIO.Error` in its message |
| Another worker ran after both failures | 42 |

The cancelled callback's subsequent reply did not settle the operation again. The installed runtime reported zero frames, allocations, pending calls, notifications and native owners. Each case entered the callback and settled once.

In a separate negative check, passing a rejected JavaScript promise directly to `vrzno_await` terminated Node 22.23.5 even inside PHP's `catch (Throwable)`. The [owner adapter in this probe](../../tests/fixtures/php-wasm-task-owner/probe.mjs) fulfills the promise with a tagged result for either outcome. PHP reads the tag and throws on the PHP stack.

## Repeat the check

1. Run `npm run test:javascript-task-callbacks` with `LEAN_BRIDGE_JS_TASK_CALLBACK_EVIDENCE` set to a new directory, or reuse the verified release sets from that command.
2. Set `LEAN_BRIDGE_PHP_WASM_HOST` to the installed `php-wasm@0.1.0` directory containing `PhpNode.mjs`.
3. Run `npm run test:php-wasm-task-owner`. The driver verifies each release set, installs its archives offline in a fresh directory, and runs each PHP process with a 30-second deadline.

The ordinary component archive had SHA-256 `d38b0bd6c9c6dd35eeeca5630e548066746f6c118275322103ac1fe7acbf5e72`; the reviewed archive had SHA-256 `80844eed23bd6c5d4a4996e6db00a507609bd3811e2d822b0336f7501af3b581`. Both used runtime archive `5289ef2c9c3435f259b1bb2e15b934bf65b08a6dd12bd8d95065bf302884ead3`.

The installed task packages in this experiment target JavaScript. The later [prepared PHP-Wasm task releases](php-wasm-task-packages-20261124.md) supply the owner adapter and typed PHP awaitable and exercise both Node and Chromium. Neither test exchanges a live Lean object with the [in-process PHP-Wasm extension](php-wasm-sync-io-zend-20261123.md).
