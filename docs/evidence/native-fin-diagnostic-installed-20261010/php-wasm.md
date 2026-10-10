# PHP-Wasm diagnostic acceptance

Producer: `af1dcbf8fe5e96dada23948b545c063b3e251dcc`, frozen for both tests.
The [original TAP](php-wasm.tap) records two passing installed tests, zero
failures or skips, in 757.4 seconds.

| Fixture | Ordinary executions | Reviewed executions | Checks per execution |
| --- | ---: | ---: | ---: |
| Products and result branches | 12 | 12 | 2,039 |
| Records and variants | 12 | 12 | 2,053 |

Each fixture runs Node with both embedded and Composer-installed loading,
plus Chromium with the bundled browser package. Every arrangement runs
startup and lazy loading with weak and strict PHP callers. These are 48
execution variants across the two source routes. Reports retain repeat
execution, unchanged deployment, empty caches and offline installation.
Both build roots reproduce the same archives, and the harness removes the
author/build roots before installation.

The public callers require complete nested Fin diagnostic paths. Archive
tests bind their exact frozen source identities to the adapted weak/strict
PHP callers, all refinement trees, package hashes, actual loading phases,
browser requests and installed file identities. Reviewed builds also bind
the independently authored contract and reconciled source model.

Runtime selections were Node v22.23.2, Chromium 152.0.7977.75, PHP-Wasm
0.1.0 with PHP 8.4.1, Emscripten 3.1.68 and Lean 4.32.2. The reports contain
the compiler/runtime pins and Node/browser executable hashes. The prepared
copied runtime had identity
`44535fd7b0e510b50f3aae5e2134970012d90e9f6be04048a04dce85bddbd966`.

| Original artifact | SHA-256 |
| --- | --- |
| [Ordinary report](ordinary-php-wasm.json) | `205910d5f840473c2523f32c00491cc9a7c0aabe537d94362ce01e627bd7e194` |
| [Reviewed report](reviewed-php-wasm.json) | `fd7e059016d5e26b50391331ea7c7b8dea0cb678bf043392343656813645db83` |
| [TAP](php-wasm.tap) | `58dd02da1da37b9247d16fff9eaf5595676744f6ce14569cb433af20dc28c9a0` |

The command used CPU 3 and ran only the two installed tests:

```sh
export LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=/path/to/verified/php-wasm-runtime
export LEAN_BRIDGE_PHP_WASM_FIN_TEST=1
export LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST=1
export LEAN_BRIDGE_PHP_WASM_FIN_REPORT=/path/to/ordinary-php-wasm.json
export LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_REPORT=/path/to/reviewed-php-wasm.json
taskset -c 3 node --test --test-concurrency=1 \
  --test-name-pattern='^(relocated PHP-Wasm packages|independently reviewed PHP-Wasm packages)' \
  tests/php-wasm-fin.test.mjs
```

The report and TAP bytes are unchanged. The harness removed the temporary
package trees after testing; archive hashes and sizes remain in the reports.
Source and adapter dispatch were not measured. This run does not establish
scalar/direct-container, callback, checked Subtype or other untested
PHP-Wasm coverage, and it does not close #1442 or #1443. Hosted acceptance
and the remaining original-scope audit are separate gates.
