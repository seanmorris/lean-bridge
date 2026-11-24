# Native PHP object tasks through Composer

The [Workshop client](../../tests/fixtures/php-host-tasks/installed.php)
installs the publisher’s Composer archive and passes its own PHP objects and
closures to a binding. It uses Amp futures and `foreach`; it neither loads a
shared library by hand nor exchanges object handles.

The producer builds the [Lake application](../../tests/fixtures/php-host-tasks/Workshop.lean)
once from its export selection and again from a reviewed Binding IR with
the explicit export list removed. The consumer verifies each package receipt,
installs local checksum-verified Amp, Revolt, and Brick Math distributions
with Packagist disabled, relocates the project, and runs with no compiler on
its search path.

## What the client checks

- A retained callback gets the application’s original object. It can await
  another Lean task before returning a different object to the first task.
- A returned `Err` remains a value. Typed factory and cursor errors preserve
  their object payloads. A factory IO error and terminal worker IO error
  have different exception classes. A propagated PHP callback exception is
  the original exception instance; an unexpected PHP `Error` retires the
  runtime.
- Cancelling during a suspended callback prevents a late reply from being
  used. Closing one binding settles its pending futures and cursors without
  closing another binding.
- Closing the last cursor that holds a weak-canonical object releases it
  without another application call. A destructor can reenter a healthy
  binding after the native close returns. A cleanup error is observable on
  explicit close and does not replace an earlier cancellation.

The [two-component client](../../tests/fixtures/php-host-tasks/peer.php)
uses two distinct native worker libraries and one shared, runtime-matched
registry and lease library. It checks nested calls, original exception
identity, incompatible class tables, survivor behavior after peer shutdown,
and weak-object release. A task that accepts both an object and copied bytes
reports the correct length for 9 MiB; a payload above 16 MiB is rejected before
the operation starts. The consumer repeats with both native load orders.

## Installed results

| Installed packages | PHP interpreters | Executions | Client checks |
| --- | --- | ---: | ---: |
| Workshop, built from source or reviewed interface | 8.2.35 and 8.5.10 | 4 | 170 |
| Each Workshop ZIP with an independently built peer, in both load orders | 8.2.35 and 8.5.10 | 8 | 112 |

All 12 executions ended with zero live PHP references. The single-package
client also exercised fork rejection where the PHP installation provided
`pcntl_fork` (8.2.35). The [execution record](php-host-task-packages-20261124.json)
includes archive and worker hashes, the shared registry and lease library,
and per-interpreter results.

## Reproduce

Use Linux x86-64, the pinned Lean toolchain, a C compiler, Composer, and
PHP CLI (NTS) with FFI. Set `LEAN_BRIDGE_PHP_SCHEDULER_CACHE` to a Composer
cache with the [two pinned scheduler ZIPs](../../tests/helpers/php-task-feed.mjs)
under `files/amphp/amp/` and `files/revolt/event-loop/`. The consumer checks
their SHA-256 digests before installing. Use an existing output directory:

```sh
export LEAN_BRIDGE_PHP_HOST_TASK_OUTPUT=/absolute/path/to/results
export LEAN_BRIDGE_PHP_SCHEDULER_CACHE=/absolute/path/to/composer-cache
npm run test:php-host-task-installed
```

The test prints the directory containing `ordinary/` and `reviewed/`.
Reuse those actual archives for the independent peer:

```sh
export LEAN_BRIDGE_PHP_HOST_TASK_MATRIX=/absolute/path/to/results/php-amp-host-ID
npm run test:php-host-task-peer
```

`LEAN_BRIDGE_PHP_HOST_INTERPRETERS` accepts a comma-separated list of PHP
executables. Set `LEAN_BRIDGE_PHP_HOST_TASK_REPLAY` to the retained matrix
directory to replay the single-package consumer without rebuilding Lean.
For a paired replay, keep the primary matrix selected and set
`LEAN_BRIDGE_PHP_HOST_TASK_PEER_REPLAY` to the retained directory containing
`peer/`. The consumer still verifies both receipts and installs both ZIPs.
This profile is native PHP CLI; it does not change PHP-Wasm.
