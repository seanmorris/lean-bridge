# Application-owned objects in native PHP records

The [Station library](../../tests/fixtures/php-host-record/Workshop.lean)
declares its own `Panel`. Two fields are imported application classes, one
is a string, one a UInt32 and one a Nat. The compiler inspects the actual
Lean constructor and ordered projections. A native Composer consumer sees
read-only PHP properties: the meters are its original objects, while the
string and numbers are values. No object IDs or FFI handles are public.

The [PHP application](../../tests/fixtures/php-host-record/consumer.php)
checks the following through the installed package:

- Two records can be borrowed in the same call. A wrong meter class or
  out-of-range number in the second record is rejected **before** the first
  meter is read. A meter that throws after entry reaches the caller as the
  original exception; the next valid call succeeds.
- Swapping the meters preserves PHP object identity, a multibyte caption and
  a Nat larger than UInt64. Cloning the result does not clone the meters.
  Each record closes independently; the application can read the fields
  after the binding closes. When the last reference goes away, its
  `WeakReference` clears.
- The two captions in a `Banner` share one native output budget. If the first
  copy and the meter export succeed but the second copy exceeds 16 MiB in
  aggregate, the partial result and its meter are released. A small banner
  on the same binding still works.
- `chooseMeter` returns a Lean function capturing the borrowed panel. After
  the input closes, invoking the returned function still gives the caller
  the original PHP meters. Closing the function clears both weak references
  while the binding remains open.

The [test harness](../../tests/helpers/php-host-record-installed.mjs) installs
the author CLI offline, builds ordinary and reviewed packages, verifies the ZIP
contents during an offline Composer install and relocates the application.
The consumers run after the source and package handoff are removed, with no
tools on PATH. A review can edit the field description; reversing the ordered
fields must fail without producing a package.

Linux x86-64 PHP 8.2.35 and PHP 8.5.10 each passed the complete program on
both package routes. The [ordinary execution](php-host-record-20261126/ordinary.execution.json)
and [reviewed execution](php-host-record-20261126/reviewed.execution.json)
name the same client SHA-256 and their respective
[ordinary package receipt](php-host-record-20261126/ordinary.package-set.json)
and [reviewed package receipt](php-host-record-20261126/reviewed.package-set.json).
These are local installed results; the existing native PHP consumer lane
also runs the qualification and retains its own records.

To repeat on Linux with the supported Lean toolchain, Composer and PHP CLI
with FFI available:

```sh
LEAN_BRIDGE_PHP_HOST_INTERPRETERS=/path/to/php-8.2,/path/to/php-8.5 npm run test:php-host-records
```

This is the synchronous **native PHP** API. It does not qualify a PHP-Wasm
record, a record in an async stream or a record-shaped EIO error.
