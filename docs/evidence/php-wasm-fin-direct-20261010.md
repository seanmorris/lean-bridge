# Direct Fin values in installed PHP-Wasm packages

Producer `ccb44b24d17b96bd3327cb976b6d45921f7f3af2` passed the ordinary and independently reviewed scalar/container gates on 10 October 2026. The original run completed in 869.3 seconds: nine tests passed, with no failures or skips.

The [archive index](php-wasm-fin-direct-20261010/index.json) authenticates both original reports, the TAP log, runtime manifest, runner, start/end records, verification record and 37 selected producer source files. Its SHA-256 is `0584e1582db5f6afabf4f6509cc415ef1df0aa3bfca3581681a23ef67b1290ce`.

## Installed coverage

| Fixture | Exports | Checks per execution | Source routes | Executions per route |
| --- | ---: | ---: | --- | ---: |
| Direct scalar Fin | 7 | 2,028 | Ordinary and independently reviewed | 12 |
| Direct and nested Array/List/Option Fin | 12 | 14,089 | Ordinary and independently reviewed | 12 |

Each fixture runs in Node with embedded or Composer loading, startup or lazy initialization, and weak or strict PHP callers. Chromium runs bundled packages with both initialization modes and both caller modes. The two source routes total 48 installed executions.

The scalar caller retains every native PHP assertion, including bounds 0, 1, 10, 300 and 2^70, a Fin result, mixed arguments, invalid PHP types, large integers, and 1,000 rejection/recovery cycles. Only autoload placement changes before the shared PHP-Wasm caller conversion.

The container caller retains the original eight exports and adds all four native edge exports. Cases include empty arrays and lists of Fin 0, absent and present Option (Fin 0), Option (List (Fin 10)), first/middle/last invalid elements, late invalid arguments, unchanged inputs and repeated recovery. The fixture source and consumer are composed from the original native files, not a reduced PHP-Wasm copy.

Both routes build archives from two unrelated author roots and compare their identities. The harness removes author/build roots before offline installation, relocates the installed packages, runs with unavailable compiler paths and empty caches, and verifies repeat execution with unchanged deployment. Original reports retain npm and Composer lock identities and all installed library/request hashes.

## Review checks

Six fresh-Lean cases reject tightened, loosened or omitted scalar bounds; loosened or omitted Fin 0 list constraints; and a changed Lean source bound. Every case requires `reviewed-ir-source-mismatch` and confirms that no output directory exists. These are compiler reconciliation checks, separate from installed execution.

## Runtime and retained evidence

The run used Node 22.23.2, Chromium 152.0.7977.75, PHP 8.4.1, php-wasm 0.1.0, Lean 4.32.2 and Emscripten 3.1.68. PHP integers and pointers are 32-bit. The runtime identity is `44535fd7b0e510b50f3aae5e2134970012d90e9f6be04048a04dce85bddbd966`. Minimum free disk during this run was 2,396 MiB.

- [Ordinary report](php-wasm-fin-direct-20261010/ordinary.json): `abfb927ac57de70659018a9718408c68d38a470b7683aefe4cb97722c013adfe`.
- [Reviewed report](php-wasm-fin-direct-20261010/reviewed.json): `7c58ab9c6467af9427bab5abe051bb9e1ff14a55290e11e0428d02d48da9aa55`.
- [Original TAP](php-wasm-fin-direct-20261010/run.tap) and [producer start record](php-wasm-fin-direct-20261010/start.json).

The strict report checker requires both fixtures and routes, all execution tuples, exact assertion counts, original caller hashes, independent review contents and package receipt reconstruction. Corruption tests alter archived bytes and individual report claims. CI runs the producer in the existing PHP-Wasm consumer job, verifies both reports and uploads the originals.

These are local installed observations. They do not establish hosted CI acceptance, source/adapter entry counts, checked Subtype, refined callbacks, graph/owned refinement transports, or other browser engines. Package binaries were removed by the harness; their original digests and sizes remain in the reports. The selected source snapshots are not a complete build dependency closure. Earlier product/record evidence remains unchanged. Updating the public coverage inventory to cite these additional direct-value observations is a separate step.

## Reproduction

Configure the repository's pinned PHP-Wasm build inputs, then run:

```sh
LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_TEST=1 \
LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_LEAN_TEST=1 \
node --test --test-concurrency=1 tests/helpers/php-wasm-fin-direct-tests.mjs
node scripts/check-php-wasm-direct-fin-reports.mjs --directory build/php-wasm-fin-direct
```

The committed archive and report controls do not need those toolchains:

```sh
node --test tests/helpers/php-wasm-fin-direct-report-tests.mjs
```
