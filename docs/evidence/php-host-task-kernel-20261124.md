# PHP objects in compiled Lean tasks

The native PHP worker kernel can carry an application object through a Lean
task without calling PHP from a worker thread. In the [Workshop fixture](../../tests/fixtures/php-host-tasks/Workshop.lean),
`relay` takes a `Box` and two callbacks. The first callback receives the
original PHP instance and returns a different one. The second receives that
exact instance and returns the first. PHP checks identity with `===` after
the task completes. A synchronous export can still call a method on the
same box during callback handling.

## What crosses the boundary

The PHP owner checks the class and resolves the object in its existing
canonical registry. A temporary lease holds the resulting Lean wrapper
while the task or callback needs it. The worker receives that wrapper, not
a Zend pointer or a PHP reference-table entry. The native callback queue
delivers the value back to the PHP owner. Only the owner resolves the
wrapper to a PHP instance or invokes user PHP code. The build rejects a
task that invokes an imported member directly, including a call hidden
inside a cursor step.

The [PHP client](../../tests/fixtures/php-host-tasks/kernel.php) drives real
compiled tasks through the native byte-buffer interface. In addition to
object identity, it distinguishes an ordinary returned `Except`, a typed
factory or cursor error carrying an object, Lean IO errors raised before
and after worker startup, and the origin ticket of a rejected PHP callback.
It closes a task with
an outstanding callback, attempts a late reply, and checks that reopening
a binding cannot revive a lease from the old one. It counts PHP reference
tokens after shutdown.

Both the ordinary and reviewed builds passed 72 checks on PHP 8.2.35 and
8.5.10, with zero live PHP reference tokens in each of the four runs. The
[execution record](php-host-task-kernel-20261124.json) identifies the client,
public interface, and native binaries for each route.

## Reproduce

Use the pinned Lean toolchain, the matching verified Linux x86-64 native
runtime SDK (the directory containing `runtime.json`, `include/`, and
`lib/`), and PHP CLI with FFI. Run from the repository root:

```sh
export LEAN_BRIDGE_PHP_HOST_TASK_SDK=/absolute/path/to/native-sdk
npm run test:php-host-task-kernel
```

The test compiles ordinary exports, repeats from a reviewed Binding IR, and
checks a rejected Lean application separately. Set
`LEAN_BRIDGE_PHP_HOST_INTERPRETERS` to a comma-separated list of PHP
executables to run each build on several interpreters. Set
`LEAN_BRIDGE_PHP_HOST_TASK_OUTPUT` to an existing directory to retain the
two native builds and their `execution.json` files. For the compiler-only
check, leave the SDK variable unset and run `npm run test:php-host-task-imports`.

This record tests the private native kernel. The
[installed Composer client](php-host-task-packages-20261124.md) tests the
public Amp binding above it. The [synchronous host-object profile](php-host-finalizers-20261124.md)
and the [PHP-Wasm task profile](php-wasm-task-leases-20261124.md) are separate.
