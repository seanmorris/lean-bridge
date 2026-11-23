# Synchronous Lean IO in the PHP-Wasm host

PHP 8.4.1 in the installed `php-wasm@0.1.0` Node host ran 27 checks against
compiled Lean declarations using the shared wasm32 runtime. This tests the
private transport that a Zend extension can call. It does not qualify a
Composer package, PHP exceptions, Chromium, callbacks, or a task scheduler.

| Observation | Result |
| --- | --- |
| Stateful `IO` and `BaseIO` | Adding 4,000,000,000 changed the counter. Adding an out-of-range word returned an invalid-input status and left the counter unchanged. |
| Thrown `EIO` vs returned `Except` | Both inner tags survived on both paths, including an embedded NUL in the string. Only the thrown path received the typed-failure status. |
| `IO.Error` | The failure had its own status and retained the message `ledger offline`. |
| Width, bounds, and ownership | Signed 32-bit minimum, unsigned 64-bit maximum and a negative multiword Lean integer survived. Malformed inputs were rejected, buffers released, and calls after runtime retirement refused. |
| Effect audit | Adding an undeclared filesystem write to the in-memory function failed before target object emission. The source was never executed. |

Two separate builds produced the same 15,976-byte probe module
(`sha256:a4e4cbdb18f4215f10fa2ebc2ac2301654c66a65e354a56cb3d1347a2feadd7a`).
The runtime identity was `44535fd7b0e510b50f3aae5e2134970012d90e9f6be04048a04dce85bddbd966`;
the component identity was `02dab9ace23d182a2988aa1d03e1e9b07cd83e9600a55704dee3252b47e695b4`.

To reproduce, use the [pinned PHP-Wasm toolchain](../publish/php.md#build-an-ordinary-php-wasm-package).
Set `LEAN_BRIDGE_LEAN_PREFIX` to the Lean installation, `LEAN_BRIDGE_PHP_WASM_EMSDK`
to its Emscripten SDK, `LEAN_BRIDGE_PHP_WASM_HOST` to the installed `php-wasm`
package directory, and `LEAN_BRIDGE_PHP_WASM_IO_RUNTIME` to the prepared
runtime directory containing `runtime.json`. Run from the checkout:

```sh
node --test --test-concurrency=1 tests/helpers/php-wasm-io-core.mjs
```

The probe links [the compiled fixture](../../tests/fixtures/php-wasm-sync-io/Ledger.lean)
and [the test caller](../../tests/fixtures/php-wasm-sync-io-probe/check.c)
as an Emscripten side module. PHP reads its result from the host's virtual
filesystem. The expected output is `8.4.1:4:ok 27`; a skipped host test is
not a passing runtime check.
