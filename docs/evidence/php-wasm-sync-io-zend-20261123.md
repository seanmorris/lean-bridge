# Calling Lean IO from 32-bit PHP

The generated Zend extension and PHP functions ran inside the pinned
`php-wasm@0.1.0` Node host (PHP 8.4.1, four-byte PHP integers). No native
FFI, Lean pointers, transport words, or promises appear in the consumer code:

```php
use Brick\Math\BigInteger;
use function LeanLedger\{add, choose, read_total};
use LeanLedger\ChooseError;

add(BigInteger::of('4000000000'));
$total = read_total(); // BigInteger, not a truncated PHP int
try {
    $value = choose(true, true, "a\0b");
} catch (ChooseError $error) {
    // $error->declaration is 'Ledger.choose'; its payload is Ok("a\0b").
}
```

The [same consumer file](../../tests/fixtures/php-wasm-sync-io-probe/consumer.php)
passed 30 assertions with the extension loaded at startup and 30 with it
loaded on first use. Invalid arguments neither loaded a lazy extension nor
changed the counter. A returned `Err` remained a value, a thrown `EIO`
became a declaration-specific exception, and an `IO.Error` retained its
message. Separately, [21 byte vectors](../../tests/fixtures/php-wasm-sync-io-probe/codec.php)
checked both conversion directions in 32-bit PHP, including signed and
unsigned 64-bit endpoints, larger Lean integers, and a non-BMP character.

To reproduce, use the [core setup](php-wasm-sync-io-core-20261123.md).
Also set `LEAN_BRIDGE_PHP_WASM_IO_HEADERS` to the configured PHP 8.4.1
wasm32 source or prepared header directory. Run:

```sh
node --test --test-concurrency=1 tests/helpers/php-wasm-io-core.mjs tests/helpers/php-wasm-io-codec.mjs
```

The run must print `8.4.1:4:zend`, `startup: php-api:30` and
`lazy: php-api:30`; a core-only or skipped run does not check the PHP API.
The 26,933-byte extension had SHA-256
`d915dbbdc07bc74a41da0df19e9aba4f88f7821b8dba3bdc8f71bcf306d8e36b`
with header inventory
`88bd389705bb36281f9d4a4f6355d8cfd800fa26cd359ad4e882b94642f11e20`.

This run loaded the generated files through the shared host descriptor.
It did not install a generated npm or Composer archive, run in Chromium,
or exercise async calls or resource leases.

### Replay the saved component without a compiler

Set `LEAN_BRIDGE_PHP_WASM_IO_WORK` to an existing private directory before
running the core test above. Inside its new `php-wasm-io-core-*` directory,
`io-payload/` contains the compiled extension, three PHP wrappers, the
Binding IR, Lean export evidence, and a receipt. The receipt SHA-256 for
this fixture run was `110bf6e58b345c69a1c2cad17e90110a3c3be6e6e189eb7d60c77c64668472bf`.

Set `LEAN_BRIDGE_PHP_WASM_IO_REPLAY` to that `io-payload` directory.
Keep the pinned runtime and installed `php-wasm` host paths from the
core setup. No toolchain paths are needed:

```sh
node_bin=$(command -v node)
env -i PATH=/no-build-tools \
  LEAN_BRIDGE_PHP_WASM_HOST="$LEAN_BRIDGE_PHP_WASM_HOST" \
  LEAN_BRIDGE_PHP_WASM_IO_RUNTIME="$LEAN_BRIDGE_PHP_WASM_IO_RUNTIME" \
  LEAN_BRIDGE_PHP_WASM_IO_REPLAY="$LEAN_BRIDGE_PHP_WASM_IO_REPLAY" \
  LEAN_BRIDGE_PHP_WASM_IO_RECEIPT_SHA256=110bf6e58b345c69a1c2cad17e90110a3c3be6e6e189eb7d60c77c64668472bf \
  "$node_bin" --test --test-name-pattern='relocated PHP-Wasm IO' tests/helpers/php-wasm-io-core.mjs
```

The replay copies the payload to a fresh directory, regenerates the
bindings from the recorded Lean interface, and checks the extension digest
and shared runtime identity. Both loading modes passed the same 30 PHP
assertions there. The producer test also rejects changes to the runtime,
configuration, headers, PHP wrapper, extension, receipt, and file list.
The digest pins this particular build; it is not a publisher signature.

The [public CLI and installed consumer run](php-wasm-installed-sync-io-20261123.md)
checks the npm and Composer archives in Node and Chromium.
