# One call per registration in PHP-Wasm

The same PHP closure can be registered with two parameters or two tasks.
Each registration marked `once` admits one invocation. A second request
fails before the worker argument is lifted or the PHP closure runs.

Both the [ordinary](php-wasm-once-callback-20261126/ordinary.json) and
[reviewed](php-wasm-once-callback-20261126/reviewed.json) packages ran the
[PHP client](../../tests/fixtures/php-wasm-task-owner/budget.php) against
the [compiled Lean program](../../tests/fixtures/javascript-once-callback/Budget.lean).
The review changes the public documentation, not the callback allowances.
Each route has distinct Composer and npm component archives. The npm
runtime archive is byte-identical across routes.

Each installation ran with the embedded autoloader and Composer in Node,
and in a threaded PHP guest in Chromium. The client observed one call to
`f`, two calls to the unrestricted `g`, and a successful nested task. A
second await on the failed job returned the same policy exception. When
Lean caught an application exception and retried the same registration,
the retry was refused without re-entering PHP. An application exception
with the policy message, or even a previous policy exception thrown by
application code, retained its original object identity. Independent slots
and a fresh task still worked. The guest exited with zero live owners.

Run `npm run test:php-wasm-once-callback` with the threaded PHP-Wasm build
inputs and Chromium used by the other installed PHP worker tests.
`LEAN_BRIDGE_PHP_BUDGET_KEEP` names an existing directory for new handoffs;
to install the originals again, set `LEAN_BRIDGE_PHP_BUDGET_REPLAY` instead
to the directory containing `ordinary/` and `reviewed/`. This test covers
retained callbacks on the PHP-Wasm task owner, not native PHP.
