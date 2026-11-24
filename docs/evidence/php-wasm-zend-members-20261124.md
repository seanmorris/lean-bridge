# Call PHP object members from compiled Lean on Wasm

An immediate Lean `IO` export can call synchronous PHP code on the interpreter
that owns the object. The [Lean client](../../tests/fixtures/php-wasm-task-owner/ZendMembers.lean)
constructs a box, calls a static factory, reads and writes a property, and asks
the box to return itself. The [PHP implementation](../../tests/fixtures/php-wasm-task-owner/zend-author.php)
receives the original receiver. A subclass can override a member and re-enter
another compiled Lean export before the first call returns.

| What happened | What the PHP caller observed |
| --- | --- |
| A member returned a PHP object | The constructor returned a real PHP instance, the static factory returned its subclass, and a receiver-anchored method returned that same object by identity. |
| Lean passed the maximum `UInt32` | PHP received an exact `BigInteger`, including through the constructor and property accessor. |
| The override threw an application exception | Lean could handle it as an IO failure. When it propagated, PHP caught the original exception, including across a nested member call. |
| A member returned the wrong type | PHP received a validation error even when Lean handled the IO failure. A subsequent valid call still worked. |
| An injected interpreter transport trap interrupted a call | The shared executor rejected pending work, refused new calls, and retired its frames, allocations, notifications, pins, and error tickets. |

The [execution record](php-wasm-zend-members-20261124.json) covers both the
ordinary and reviewed author routes, each in Node and cross-origin-isolated
Chromium on PHP-Wasm 8.4.1. Each run passed 34 checks before fault injection,
including the [callback, cancellation and cursor cases](php-wasm-zend-author-20261124.md).
The subsequently injected trap exercised the real compiled call path, not a
claim that ordinary application errors crash PHP.

To reproduce the four runs, use `npm run test:php-wasm-zend-author` with the
Lean toolchain, verified pthread SDK, PHP-Wasm interpreter, and Chromium
[described here](php-wasm-zend-author-20261124.md#reproduce).

This tests the internal PHP owner adapter. It does not yet establish that a
consumer can install a matching host-object package from npm and Composer.
The compiler still rejects worker-side direct PHP calls and blocking the PHP
owner on `Task.get`.
