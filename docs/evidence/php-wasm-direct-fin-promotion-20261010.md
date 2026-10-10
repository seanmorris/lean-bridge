# Direct PHP-Wasm Fin coverage

The [direct-value archive](php-wasm-fin-direct-20261010/index.json) supplies four
additional installed evidence entries: scalar and container fixtures, each through
ordinary source and independently reviewed Binding IR. The producer is
`ccb44b24d17b96bd3327cb976b6d45921f7f3af2`. The archive index has SHA-256
`0584e1582db5f6afabf4f6509cc415ef1df0aa3bfca3581681a23ef67b1290ce`.

Each scalar execution performs 2,028 checks across seven exports. Each container
execution performs 14,089 checks across twelve exports, including the original
zero-bound and nested-position cases. Both fixtures run in twelve configurations
per source route: Node embedded/Composer, startup/lazy and weak/strict callers;
Chromium bundled, startup/lazy and weak/strict callers. All 48 executions passed.
Six fresh-Lean cases reject changed or omitted bounds before package output.

These runs used Node 22.23.2, Chromium 152.0.7977.75, PHP 8.4.1, php-wasm 0.1.0,
Lean 4.32.2 and Emscripten 3.1.68. They establish local execution, not hosted CI
acceptance. Source and adapter dispatch remain unmeasured. Checked Subtype,
refined callbacks and graph/owned refinement transports remain open under #1220.

## Inventory and documentation

The four entries supplement the existing ordinary/reviewed parameter and result
observations. They do not duplicate cells or change any acceptance state. The
four existing PHP-Wasm Fin observations have updated conversion guidance, covering
six parameter/result/field cells. Field observations retain their original
product/record evidence; direct-value reports do not become field evidence.

The inventory retains all 401 earlier evidence entries and all 507 observations.
Only 137 current-source hashes change in earlier entries. Their producer,
execution, artifact and scope data remain unchanged. The original reports and
earlier history ledgers are byte-identical.

The [source-history ledger](php-wasm-direct-fin-promotion-source-history-20261010.json)
records eleven exact transitions from
`4748e2c85700db76be65342b9de153b6f0adb14b`. Each reconstructed predecessor was
compared directly with Git. Its SHA-256 is
`edac06a7645178f71b0eb2231bf00adb52ec53955f02ae5332677346a9ddd203`.

The PHP guide and author table distinguish the new runtime versions from those
of the earlier product/field runs. The author table also now cites the already
completed [hosted native product/field matrix](fin-native-hosted-20261010/receipt.json)
for native and CPAN support. Those native reports do not establish PHP-Wasm
acceptance.

## Verification

The new promotion/history controls and earlier Core-history controls pass all
13 tests. Five focused historical promotion and guide checks also pass.
Controls authenticate every archived file, reject incomplete or duplicate
selections, preserve exact source-history stopping points and compare the complete
current inventory against the intended supplement. The independent Git audit
confirms all eleven transitions, the 137 source-hash changes and the four changed
observations.

Full lint, checked JavaScript and all sixteen generated reference pages passed.
The first broader regression found one stale evidence-list assertion. The corrected
assertion requires the direct scalar/container reports at parameter/result sites
and keeps field evidence unchanged. The original failed log is retained at
`build/vo1443-direct-promotion-integration-r1.tap`.

The repeated seven-root regression passed 208 tests, with zero failures and six
explicit compiler/installed-runtime gates skipped. Its log is
`build/vo1443-direct-promotion-integration-r2.tap`. These skips do not replace the
separately archived installed runs. The full Core contract profile is a separate
run against predecessor `4748e2c`.
