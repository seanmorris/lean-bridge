# PHP-Wasm: carry a PHP object through a Lean worker

A PHP application creates a box and gives it to a Lean task. When Lean calls
back, PHP receives the **original object**, not a copy or an object ID. The
callback awaits a second, independently compiled Lean component that returns
a different box. The next callback mutates that box, and PHP observes the
mutation on its original reference.

This is a transport test, not a new published PHP profile. It installs the
receipt-verified [JavaScript worker packages](javascript-threaded-host-callbacks-20261124.json)
offline and uses their actual pthread runtime and component Wasm binaries.
It runs the current owner adapter and [PHP application](../../tests/fixtures/php-wasm-task-owner/zend-objects.php)
on PHP-Wasm 8.4.1 in Node and in an isolated Chromium page. The selected
Lean methods have no direct calls to PHP class members. A PHP author still
cannot publish a PHP-Wasm package that declares these host imports.
The [PHP author-route test](php-wasm-zend-author-20261124.md) separately compiles
and executes workers whose source imports `LeanBridge.Host.Php`.

## Ownership and failure behavior

Zend owns application objects and exceptions. JavaScript recognizes an object
only through a capability minted for that interpreter and nominal kind.
Concurrent calls can share that identity; each pending delivery keeps its own
strong references in PHP. A completed or cancelled delivery releases those
references without closing another component. Lean-owned resources still use
their separate lease protocol.

The [execution record](php-wasm-zend-objects-20261124.json) lists four runs:
ordinary and reviewed Workshop builds, each paired with the peer in Node and
Chromium. Each passed 25 checks, including a callback that returns the exact
maximum `UInt32` from a PHP object and the reverse callback that returns a
PHP object for that number.

The test checks nested delivery, the exact thrown PHP exception across two
workers, wrong-class replies, cancellation from inside the callback, and
collection of an input while the completed awaitable is still held. A PHP
destructor can reenter Lean. If cleanup alone fails, repeated awaits report
the same error; if the callback already failed, cleanup preserves the original
exception. An awaitable that fails during cleanup also releases the result
it can no longer deliver. Every healthy run checks that the runtime has no outstanding
frames, allocations, tasks, notifications, native owners, host pins, or
retained host exceptions.

## Reproduce

Use Node 22, Chromium and the installed `php-wasm@0.1.0` package. Produce the
ordinary, reviewed and peer handoffs with the
[threaded callback package test](../../tests/helpers/javascript-threaded-host-installed.mjs)
(`npm run test:javascript-threaded-host-callbacks`, using its publisher SDK).
Then run:

```sh
export LEAN_BRIDGE_PHP_WASM_HOST=/absolute/path/to/node_modules/php-wasm
export LEAN_BRIDGE_JS_THREADED_HOST_EVIDENCE=/absolute/path/to/retained-handoffs
export LEAN_BRIDGE_CHROMIUM=/usr/bin/chromium
npm run test:php-wasm-zend-objects
```

Use a short writable `TMPDIR` for Chromium's Unix socket. The runner uses a
loopback server with cross-origin isolation; it installs the workers without
contacting a registry. The checkout supplies the JavaScript owner and PHP
adapter, not a substitute Wasm implementation.
