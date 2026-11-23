# Synchronous Lean IO from installed PHP-Wasm packages

The public CLI built [Ledger](../../tests/fixtures/php-wasm-sync-io/Ledger.lean)
with the pinned Lean 4.32.2 compiler and prepared PHP 8.4.1 Wasm inputs.
The CLI verified all three archives against the `php-wasm-sync-io-v1`
package-set receipt. Its SHA-256 was
`94f7a8fe229a57ec4fff5ced5a463d335d07af47cfbc825561d43eeb6e6df7a3`.
This verifies local consistency, not a publisher signature.

| Installed artifact | SHA-256 |
| --- | --- |
| npm shared runtime | `6d2ed5a1b38b056bff932f85d6ba1cb3c93b32147b58baa5a8fa301df81e5a7a` |
| npm Ledger descriptor and extension | `9cf04ff2c0251209c9d59b5716d5f9a6b25b3554930b9ce7d88de62c6b6d10f6` |
| Composer Ledger API | `1dfe6c0879f118603e2b79315868915622ad066dad31aea73d7be2abb6631d96` |

npm and Composer installed the local archives with network access disabled.
The test moved the consumer and its package feed to different directories
before making any PHP calls. Node ran with no build tools on `PATH`.
Chromium loaded package assets from a loopback server serving the installed
files. Both used the `php-wasm` 0.1.0 host.

| PHP source | Node startup | Node first call | Chromium startup | Chromium first call |
| --- | ---: | ---: | ---: | ---: |
| Mounted by npm descriptor | 30/30 | 30/30 | 30/30 | 30/30 |
| Loaded by Composer autoloader | 30/30 | 30/30 | 30/30 | 30/30 |

The [same PHP program](../../tests/fixtures/php-wasm-sync-io-probe/consumer.php)
checked state across calls, wide integer values, invalid inputs, an `IO.Error`,
and both a thrown `EIO` and a returned `Except` with structured payloads. An
invalid first call did not load the lazy extension or change state.

We also built the pure Willow package and installed its npm adapter beside
Ledger. Both builds produced byte-identical runtime archives. With Ledger
loaded at startup and Willow loaded on demand, a single PHP instance called
Ledger, then Willow, then Ledger again. Willow returned `17` and Ledger kept
its total of `7`. Reversing the loading order gave the same result. Each host
loaded one runtime and two extensions.

A second build used a reviewed Binding IR in place of the export list and
retained the author's license file in the Composer package. Changing the
reviewed result of `Ledger.add` from `USize` to `Bool` failed the build and
wrote no release. Selecting `filesystem` failed before tool lookup.
There are no tasks, host objects or retained callbacks in this IO profile.

## Reproduce

Use the [PHP-Wasm author toolchain](../publish/php.md#build-an-ordinary-php-wasm-package).
From the checkout, select a new output directory whose parent already exists:

```sh
export LEAN_BRIDGE_PHP_WASM_IO_RELEASE="$(pwd)/build/ledger-io"
node scripts/lean-bridge.mjs build --target php-wasm \
  --project tests/fixtures/php-wasm-sync-io --output "$LEAN_BRIDGE_PHP_WASM_IO_RELEASE"
node scripts/lean-bridge.mjs verify \
  --receipt "$LEAN_BRIDGE_PHP_WASM_IO_RELEASE/package-set-receipt.json"
```

Set `LEAN_BRIDGE_PHP_WASM_HOST` to the installed `php-wasm` package directory.
The consumer test uses npm, Composer, unzip and Playwright Chromium.
Set `CHROMIUM_PATH` if using an existing Chromium executable.
To repeat the mixed-package check, set `LEAN_BRIDGE_PHP_WASM_IO_PURE_PEER`
to a Willow release built by the same CLI from the
[ordinary PHP-Wasm fixture](../../tests/helpers/php-wasm-ordinary.mjs).

```sh
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test --test-concurrency=1 tests/helpers/php-wasm-io-installed.mjs
LEAN_BRIDGE_PHP_WASM_IO_REVIEW_FROM="$LEAN_BRIDGE_PHP_WASM_IO_RELEASE" \
  node --test --test-concurrency=1 tests/helpers/php-wasm-io-source-project.mjs
```
