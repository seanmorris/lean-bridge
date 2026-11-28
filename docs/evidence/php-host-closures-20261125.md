# Returned Lean functions in a native Composer installation

The [PHP client](../../tests/fixtures/php-host-closures/installed.php) uses
two different PHP objects: one is captured by the factory, and one is passed
to the returned function. It checks identity with `===`. A wrong-class
argument fails before Lean calls a member. If the member throws during the
factory or during invocation, PHP catches the original `Throwable`.

Several cases distinguish the function's lifetime from its binding's:

- A member re-enters a sibling function, closes its own function, and
  checks that new calls fail. The in-flight invocation still returns its
  captured object.
- While a member is suspended in one Fiber, another Fiber cannot call or
  close a function. Destroying a different function or binding during the
  suspension queues cleanup. Their captures become collectible when the
  original Fiber resumes. A forked child cannot consume the parent's lease.
- A PHP destructor throws after a successful factory creates a native
  ticket. The caller receives the destructor's exception and the
  unpublished function does not leak its capture.
- An abandoned binding revokes its live functions. Abandoning it from a
  member *during* invocation lets that one call finish. Reopening a binding
  cannot revive an old function.

A fresh process retires the native runtime during a member call. Both
bindings refuse more invocations; closing the first function releases only
its capture. The process finishes with zero private PHP reference entries.
The retirement injector is test code, not a consumer API.

The [Amp client](../../tests/fixtures/php-host-closures/worker.php) awaits
the original PHP object, observes a missing-file IO error and two successive
file contents through a returned function. Passing a returned function as
a callback preserves a thrown application exception. Of two pending tasks,
closing one binding skips its callback, revokes its function and lets the
sibling callback run exactly once.

| Native Composer package | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary Lean exports | `68befefa3f1742d6ab8712d70206e741fabf745aad0fceb99cb1df15444f97c1` |
| Reviewed public interface | `902c9583a0b57fd5acf4469016d5d2d4a410a872328e51aed9a0325afc4a9c78` |
| Amp callback and filesystem grant | `c4dac4481c19fe756acb0acd2ceb9eaada7fc8832bb43c6cec476ea4c167a78d` |

All three packages ran on both PHP 8.2.35 and PHP 8.5.10.

Run `npm run test:php-host-closures` with the native publisher tools,
`LEAN_BRIDGE_PHP_SCHEDULER_CACHE` pointing to the pinned Composer cache
for Amp and Revolt, and `LEAN_BRIDGE_PHP_HOST_INTERPRETERS` listing the
PHP CLI executables. The [install test](../../tests/helpers/php-host-closures-installed.mjs)
uses an offline-installed publishing CLI, verifies the package-set receipt
and Composer lock, relocates the install, and removes the handoff before
launching clients with publisher tools off their path. The publisher
rejects a missing filesystem grant and a reviewed interface naming the
wrong runtime owner. Native PHP and PHP-Wasm share a Lean namespace;
these installs exercise only the native FFI target.
