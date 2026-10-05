# PHP CI regression repairs

Plan node: 1219. Baseline: `f61063252acf464ba4306885ddbf141b29bbdf73`.

[Downstream run 36127768373](https://github.com/seanmorris/lean-bridge/actions/runs/36127768373)
passed 16 jobs. Two checks inside the PHP job failed; the support summary then
reported that failure.

The native fault probe called `FFI::cast()` statically. PHP 8.5 emitted a
deprecation warning before its JSON output. The probe now passes its existing
FFI instance to the zeroed-memory check. It still rejects nonzero output and
checks the same 8,080 injected failures, 8,144 clears and 9,274 scope closes
per source path. Warnings remain enabled.

The PHP-Wasm live package comparison used the historical packager source hash.
New packages correctly recorded the current packager instead. Live comparisons
now use current source bytes. Historical receipt checks explicitly supply their
authenticated historical source. Neither check accepts unrelated source drift.

```sh
node --test tests/php-ci-regressions.test.mjs
LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_TEST=1 node --test tests/php-structured-callables.test.mjs
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test tests/php-wasm-ordinary.test.mjs
```

Set `LEAN_BRIDGE_PHP` to another PHP CLI to repeat the FFI regression tests. The
recorded supplemental PHP 8.5 run executes the full fault probe against a real
installed package; Composer installation and the ordinary public callers use
PHP 8.2. It is not a full PHP 8.5 Composer-installation claim.

The [execution record](php-ci-regressions-20260925.json) retains the reproduced
failures and corrected runs. The [source transition](php-ci-regression-integration-20260925.json)
authenticates the repairs without replacing historical receipts. Inventory
0.98.2 preserves all existing type cells. No shipped runtime code changes.
