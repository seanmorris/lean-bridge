# Installed checked-record PHP-Wasm support

VO #1446, within #1220. This milestone adds four installed support observations:
top-level checked-record parameters and results on ordinary-source and
independently reviewed PHP-Wasm packages. Existing observations retain their
scope. The [support inventory](../type-surface.v1.json),
[PHP guide](../php.md#checked-records-in-php-wasm) and
[author guide](../lean/existing-package.md#export-a-record-with-proof-fields)
describe the same positions.

## Original installed runs

All four runs used producer `d329faf45141be46e2e875c529ea4be14732c13b`.
Commit `d65842fa5ac87dda2a364adc43c510685730027c` archived their
[original records](checked-record-php-wasm-20261011/index.json).
The index SHA-256 is
`af276809d2a1a9eab267650a4e08ad0d7ba0bae3037a10722364502250b38e6b`.

| Package selection | Public positions | Assertions per context | Calls and input snapshots | Constructor rejections |
| --- | --- | ---: | ---: | ---: |
| Ordinary source | Input and result | 18,048 | 9,023 | 4,009 |
| Independently reviewed | Input and result | 18,048 | 9,023 | 4,009 |
| Ordinary source, result-only | Result | 2,007 | 1,004 | 0 |
| Independently reviewed, result-only | Result | 2,007 | 1,004 | 0 |

Each selection passed twelve actual wasm32 PHP 8.4.1 contexts: eight Node
embedded/Composer configurations and four Chromium bundled configurations,
covering startup/lazy loading and weak/strict callers. These runs used
Node 22.23.2, Chromium 152.0.7977.75 and php-wasm 0.1.0. Native PHP control
executions are retained separately and do not count as PHP-Wasm acceptance.

Two author roots produced identical packages before the tests removed the
sources, installed the npm and Composer archives offline with empty caches,
moved the installed tree and replayed unchanged callers. Every call checked a
complete input snapshot. Tests cover per-site constructor selection,
normalization, rejection and recovery, plus exact `2^80 + 1` and `2^100` results.
Result-only packages contain no checked-input export or constructor selection.

## Promotion checks

The [promotion helper](../../tests/helpers/checked-record-php-wasm-promotion.mjs)
authenticates all 228 original files, the index, selected producer Git sources,
runtime and package identities, original TAP and twelve executions per route.
It constructs evidence references from those records. It never follows an
absolute path recorded on the producer machine.

The [tests](../../tests/helpers/checked-record-php-wasm-promotion-tests.mjs)
reject missing/corrupt records, forged selections, overlapping observations and
repeated promotion. They require exactly four new PHP-Wasm cells and four
evidence entries, leaving every earlier observation unchanged. Result-only
evidence attaches only to result positions.

The [required CI workflow](checked-record-php-wasm-ci-20261011.md), committed in
`c3a115752a174e18a6e2f07c64718e5be4d641d3`, runs nine fresh Lean compiler and
reconciliation checks before all four installed selections. A fresh hosted
success is still required.

## Local validation

- Final registered checked-record, type-surface, source-history and profile regression: 271 tests, 229 passed, no failures, 42 intentionally gated installed/compiler skips. TAP SHA-256: `4cee7a6f4161d74be6a104d0f7fa0b06ddc45994ef773106815d32b0c37c986d`.
- Focused PHP-Wasm and Perl promotion tests: 13 passed, no failures or skips, including 88 PHP-Wasm missing/corrupt-original controls. TAP SHA-256: `29e70b82e217cd93c21724e24d0b273830903916234881db8f0ba9e182427a36`.
- Documentation tests: 133 passed, no failures or skips. TAP SHA-256: `e63b0d801e5fd3470776c35c4cf3f982833db1bcc6cadbe87cbb4870bc3b4fbb`.
- The first broad regression found stale PHP-Wasm expectations in the Perl author-guide test and the copied-value support count. Both now require the new evidence and exact supported positions; focused repair checks passed.
- Full lint, checked JavaScript typecheck and all 16 generated reference pages passed.
- The source-history ledger records 13 exact changes and 125 refreshed source digests against `c3a115752a174e18a6e2f07c64718e5be4d641d3`. Its SHA-256 is `4201ec0a84bceb3457e77d6314bc89af4d2a864020ff6901809dbada79addde7`. All 10,005 older evidence files remain unchanged.
- The inventory now contains 472 evidence entries and 571 observations. Checked-record top-level inputs/results have 68 installed observations across all seventeen profiles and both source routes. Earlier observations retain their scope.

## Remaining scope

The supported fixtures are `Interval`, `Sized 3` and `Bounded 0 101` at top-level
parameter/result sites. Nested, refined, recursive or inherited checked records,
other index kinds, general dependent or zero-payload records, callbacks and
owned positions remain unreviewed.

These local results do not establish other PHP/browser versions, hosted
acceptance, internal dispatch counts or memory measurements. The archive
retains selected producer sources and package digests, not package binaries
or a complete toolchain closure.
