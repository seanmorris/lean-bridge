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

### Where PHP object identity is checked

The first call in the [synchronous Composer client at qualification](https://github.com/seanmorris/lean-bridge/blob/cb279b9/tests/fixtures/php-host-members/compiled.php)
passes an application-created meter to `identity` and compares the immediate
result to that same PHP object with `===`. The original
[ordinary](php-host-object-positions-20261126/ordinary.sync.json) and
[reviewed](php-host-object-positions-20261126/reviewed.sync.json) client
reports each record 22 checks per interpreter. The package identities match
the [native import receipt table](php-host-imports-20261124.md#installed-composer-checks).

The [worker client at qualification](https://github.com/seanmorris/lean-bridge/blob/54f1a93/tests/fixtures/php-host-tasks/installed.php)
checks a different contract. The first `relay` callback receives `$a` and
returns `$b`; the second receives that exact `$b` and returns `$a`.
The future delivers the original `$a` after both visits. Both source routes
passed on PHP 8.2.35 and 8.5.10 with zero live PHP references. Combined with
the separate [record-field client](php-host-record-fields-20261126.md), these
checks cover all five application-object positions for native PHP. PHP-Wasm
uses a different runtime and is not counted here.

## Filesystem access during a task and cursor

The [effects client](../../tests/fixtures/php-host-tasks/effects.php) ran on
PHP 8.2.35 and 8.5.10 against both builds: four relocated, offline executions.
Lean reads the startup environment once. A synchronous call and an Amp future
read a file; two successive cursor pulls see different contents after PHP
changes the file. Breaking out of `foreach` writes the Lean finalizer's
marker. A later close and iteration leave the replacement marker untouched.

Without the filesystem grant, the producer identifies the task, pull and close
that require it and emits no release. With both grants, it still refuses an
owner-blocking `IO.wait` in the finalizer. To repeat both refusals and the
installed clients, set the scheduler cache and `LEAN_BRIDGE_PHP_HOST_INTERPRETERS`
as below, then run `npm run test:php-worker-effects`.

| Effects build | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary | `956f97227d3ed71de578f6277584eaadecc63e8b2d05914a33e533f195b71338` |
| Reviewed | `887949a37e6a6866dcd14755b277a2da24df7ba13f7e7bf2b63aa4a91cc12a80` |

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
