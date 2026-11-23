# Nested PHP-Wasm callbacks and synchronous IO failures

Two independently compiled packages shared one PHP 8.4.1 Wasm runtime:
[Switchboard](../../tests/fixtures/php-wasm-io-callback-peer/Switchboard.lean)
called PHP functions and returned a Lean closure;
[Ledger](../../tests/fixtures/php-wasm-sync-io/Ledger.lean) held state and
returned or threw structured values. The test installed their npm archives
offline, moved the installation away from its package feed, then ran the
[PHP consumer](../../tests/fixtures/php-wasm-sync-io-probe/callbacks.php) in
Node and Chromium. Neither consumer used a compiler.

| Case | Observed in both hosts |
| --- | --- |
| First use inside a callback | Lazy loading failed before Ledger ran. Loading Ledger outside the callback allowed nested calls to add four times, in order. |
| PHP and Lean failures | The original PHP exception and the original typed `ChooseError` each survived two callback frames. The Lean payload retained its embedded NUL. Both packages remained usable after a bad callback return. |
| Ownership | A PHP callback capture became collectible when the call returned. A returned Lean closure stayed callable across a conversion-limit failure. |
| Malformed replies | An impossible pending status, malformed UTF-8 in a typed failure, and nonzero unused sum-tag padding each retired the runtime in a fresh instance. Both packages and the existing closure then refused calls. Closing the closure twice left zero live identities; previously copied values and errors stayed readable. |

Only the three malformed envelopes and the oversized conversion input were
injected, at the generated PHP decoder after copying. All callback calls,
exceptions, closure operations, and runtime-state transitions used the
installed packages. A [read-only test extension](../../tests/fixtures/php-wasm-sync-io-probe/snapshot.c)
observed two initialized components, one shared runtime, and the live handle
count; it is not part of either release. This tests synchronous callbacks,
not scheduling, cancellation, or retained host callbacks.

The independent install matrix also passed 30 PHP assertions in each of
eight configurations (Node/Chromium × npm-mounted/Composer-autoloaded PHP
× startup/first use). The fault test printed `callbacks:FAULT:retired:0`
for each of the three faults on each host.

Separately, the [32-bit codec vectors](../../tests/fixtures/php-wasm-sync-io-probe/codec.php)
round-tripped 21 valid encodings, rejected 22 malformed ones, and classified
a canonical oversized integer as a recoverable conversion limit. A replay
of Ledger's unpacked component without build tools passed the same vectors
in both loading modes. Its internal IO receipt SHA-256 was
`aa9b8583228fca5245a483d830f5eb215988714869237c201dc9eed51aebb6d4`.

| Local build artifact | SHA-256 |
| --- | --- |
| Ledger package-set receipt | `649dc9c40512dc4407f952f1db375d29350f95f94f11572aba42afd5ac0e4b45` |
| Switchboard package-set receipt | `9534a6fe2582f6d6bd0c5676364fcb9e0e4dc8071bbd43e0569be641841c7c0c` |
| Shared runtime npm archive (identical in both builds) | `6d2ed5a1b38b056bff932f85d6ba1cb3c93b32147b58baa5a8fa301df81e5a7a` |
| Ledger npm / Composer | `988f1dda44d97af3e783b14c86c882f7d3c9d73c6ab7fc6bf72c0aa48f163c64` / `765d6a59b2c180f67e1df97b603cd2dd3871671704d4b0ef397365190b980493` |
| Switchboard npm / Composer | `cc305c047d29bcf2c8f534c3bee5a9c27723b36e26a7e5f8df3ec40b2d912581` / `509cb45d1591191bbc432a56999deb273bf903281732eaf308fda2e27cb52002` |

## Reproduce

Use the [PHP-Wasm author toolchain](../publish/php.md#build-an-ordinary-php-wasm-package)
and the installed `php-wasm` host, npm, Composer, unzip and Chromium from
the [consumer setup](php-wasm-installed-sync-io-20261123.md#reproduce).
From the repository root, use two new build paths:

```sh
export LEAN_BRIDGE_PHP_WASM_IO_RELEASE="$PWD/build/ledger-io"
export LEAN_BRIDGE_PHP_WASM_IO_CALLBACK_PEER="$PWD/build/switchboard"
node scripts/lean-bridge.mjs build --target php-wasm \
  --project tests/fixtures/php-wasm-sync-io --output "$LEAN_BRIDGE_PHP_WASM_IO_RELEASE"
node scripts/lean-bridge.mjs build --target php-wasm \
  --project tests/fixtures/php-wasm-io-callback-peer --output "$LEAN_BRIDGE_PHP_WASM_IO_CALLBACK_PEER"
```

Set `LEAN_BRIDGE_PHP_WASM_IO_HEADERS` to the prepared PHP header directory,
`LEAN_BRIDGE_PHP_WASM_IO_RUNTIME` to its companion runtime directory, and
`LEAN_BRIDGE_PHP_WASM_EMSDK` to the pinned Emscripten SDK. The harness uses
these only to compile the test observer before starting the consumers.
Alternatively, set `LEAN_BRIDGE_PHP_WASM_IO_TEST_PROBE` to a matching
prebuilt observer; the replay then needs no build toolchain.

```sh
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test --test-concurrency=1 tests/helpers/php-wasm-io-installed.mjs
```
