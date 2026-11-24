# Compile and run a PHP-authored host-object worker

[Workshop.lean](../../tests/fixtures/php-host-tasks/Workshop.lean) imports
`LeanBridge.Host.Php`. Its worker can pass a PHP application object back to
a PHP callable. The object stays on the Zend heap; the compiled Lean task
runs on a separate pthread Wasm heap.

We compiled the same source in two ways: once with an explicit export list,
and once from reviewed Binding IR without the export list. Both builds produced
the same public interface. Each side module ran in an actual PHP-Wasm 8.4.1
interpreter in Node and in cross-origin-isolated Chromium.

| Author route | SHA-256 of the executed Wasm | Node | Chromium |
| --- | --- | --- | --- |
| Ordinary | `b44a1dc9d55b7eb665e7216e64cad15214d94553c210c7c54b0efd0516f9c2da` | 21 checks | 21 checks |
| Reviewed | `692a2fab80b0177d23f63098f7cb66e38c2ee545f0130a97e5c5450fc51d6ef0` | 21 checks | 21 checks |

The [execution record](php-wasm-zend-author-20261124.json) identifies each binary and its final ownership counters.
The [PHP client](../../tests/fixtures/php-wasm-task-owner/zend-author.php) checks:

- A nested task receives the original PHP object, returns a subclass instance,
  and can pass the exact maximum `UInt32` in either direction.
- A returned `Except.error box` is a value. A callback-free EIO factory that
  throws the same box fails before returning a task. A callback-capable factory
  can suspend; its IO failure arrives through `await()` with the factory channel.
- A worker IO error, a typed iterator error, and a nested PHP callback exception
  remain distinguishable. Repeated awaits throw the original PHP exception.
- Breaking out of iteration or abandoning an unstarted iterator releases its
  input. Cancellation during a callback wins over a late result. The runtime
  finishes open, with no frames, allocations, pending calls, notifications,
  native owners, host pins or host errors in any of the four runs.

The compiler also rejects a worker that calls a PHP class member directly and
a synchronous PHP-Wasm entry that blocks its owner on `Task.get`. Accepting a
JavaScript callback contract in place of the authenticated PHP contract would
break PHP exception identity; the ABI check rejects that substitution.

## Reproduce

Run `npm run test:php-wasm-zend-author` with the pinned Lean toolchain. To
compile **and execute** the two Wasm binaries, use the threaded Wasm build
environment, set `LEAN_BRIDGE_TEST_TASK_INPUTS` to its verified SDK directory,
`LEAN_BRIDGE_PHP_ZEND_INTERPRETER` to the installed `php-wasm` package
directory, and `LEAN_BRIDGE_CHROMIUM` to Chromium. Without the SDK the test
checks source elaboration only. The recorded SDK manifest SHA-256 was
`9f9b2c252f457e4f77b1efb81a85cbd47eddee4ddfa312f68f8f8afc019ef2c1`.

This is compiler and runtime evidence. The client calls the internal adapter;
it does not install a generated PHP host-object package. The
[subsequent member run](php-wasm-zend-members-20261124.md) extends the
same command with synchronous PHP member dispatch and trap injection.
The [cross-component test](php-wasm-zend-objects-20261124.md)
covers sharing Zend objects between two JavaScript-authored components.
