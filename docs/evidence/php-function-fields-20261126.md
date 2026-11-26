# Keeping a Lean function from an installed Composer package

PHP 8.2.35 and 8.5.10 each ran a [native PHP application](../../tests/fixtures/structured-types/tariff-fields.php)
against two relocated `example/tariff-quotes` installs. The [ordinary
record](php-function-fields-20261126/ordinary.json) and [reviewed
record](php-function-fields-20261126/reviewed.json) identify the archives,
checked interfaces, installed lockfile, PHP interpreters and client sources.
The probe used FFI from the installed package; no Lean build tool was on the
consumer's path.

On all four runs:

- A field retained through a record, unpacked and repacked, still answered
  after the original wrappers closed. A PHP callback could return that
  function to Lean, which invoked it and got 44.
- A call-borrowed PHP closure did not escape in a returned record. Both
  direct invocation and invocation through Lean refused it with status 10;
  the closure did not run. A closed function supplied as a field was
  refused with status 4.
- A nested callback threw its original PHP exception after allocating
  another Lean function. The caller caught the same exception object and
  an independent call still returned 42. The installed native broker
  reported **1 → 9 → 1** live identities. After request shutdown it
  reported **zero**. The read-only observer attaches after ordinary
  package initialization, so it does not preload the broker.

Run `npm run test:php-function-fields` with the native PHP publishing
toolchain, Composer, and `LEAN_BRIDGE_PHP_HOST_INTERPRETERS` set to the
comma-separated paths of the PHP CLI executables with FFI available.
`LEAN_BRIDGE_PHP_TARIFF_KEEP` retains the original handoffs in an existing
directory. Use `LEAN_BRIDGE_PHP_TARIFF_REPLAY` instead to repeat the offline
installs without compiling again. This is native PHP evidence, not Zend
running inside WebAssembly.
