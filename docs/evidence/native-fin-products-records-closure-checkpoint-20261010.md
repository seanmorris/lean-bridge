# Native Fin products and records: closure checkpoint

The [hosted archive](fin-native-hosted-20261010/receipt.json) contains 78 original reports and 90 consumer observations from producer `ff71335c762628da47887bfd4f208e62c39b94b7`. It covers ordinary and independently reviewed product, array-of-product and record fixtures on all eleven native profiles. Python 3.11 and 3.12 retain separate execution records; Perl retains all four ABI configurations.

The archive validator passed six tests at `3ca155faffbe5ee9ea2a491bf28728579c10f2d5`. It authenticates the original ZIP members, job logs, commands, source trees, public callers, package identities and dispatch scope. The current three fixture test roots passed 87 tests with ten environment-gated skips. Those skips do not add installed or fresh-Lean observations.

## Original #1441 requirements

| Requirement | Existing evidence |
|---|---|
| Fin 0, Fin 1, Fin 10 and a bound wider than 64 bits | `FinProducts.absentOnly`, `second`, `first` and `wide`, including valid endpoints and exact rejection paths in the eleven public consumers. |
| Both product positions and active Except branches | `first`, `second`, `wide`, `okOnly`, `errorOnly` and `both`. Unbounded inactive branches retain their ordinary values. |
| Array/List/Option and alias composition | `nested` and `aliased`, plus `FinProductArrays.rows` and `reversed`. Array callers check first, middle and last rejected elements before restoring them. |
| Valid results and rejection/recovery | `produce`, `pairUp`, `reversed` and 1,000 valid/invalid pairs per consumer fixture. |
| Checked Lean construction before source dispatch | Generated-adapter tests in `native-fin-products.test.mjs` and `native-fin-product-arrays.test.mjs`; actual C adapter/source measurements in the archived reports. Other hosts have no inferred counters. |
| Independent reviewed bounds | The hosted C-family log records unskipped fresh-Lean rejection tests for changed components, branches and aliases, and array component/branch/result changes. |
| Native hosts and runtime floors | Both routes in the archived matrix, including Python 3.11/3.12 and all four Perl configurations. |
| Reproducible, source-free offline packages | Original reports and their authenticated producer/log records; host-language compilation remains distinct from the removal of Lean and producer tools. |

Sources: [Lean product fixture](../../tests/fixtures/onboarding/native-fin-products/FinProducts.lean), [array fixture](../../tests/fixtures/onboarding/native-fin-product-arrays/FinProductArrays.lean), [public consumers](../../tests/fixtures/fin-product-consumers), [array consumers](../../tests/fixtures/fin-product-array-consumers), [archive verifier](../../tests/helpers/fin-native-hosted-evidence.mjs).

## Original #1442 requirements

The [record fixture](../../tests/fixtures/onboarding/native-fin-records/FinRecords.lean) exercises bounded fields, nested records, heap-backed fields before a failing bound, absent/present Fin 0 fields, active/inactive variant cases, Array/List/Option/Prod/Except composition and bounded results. Public consumers compare rejected inputs before restoring them. C records actual source/adapter counters; the other profiles remain unmeasured.

The hosted C-family log records unskipped fresh-Lean rejection of tightened fields, moved fields, loosened nested-record bounds, tightened variant fields and a loosened Fin 0 case. Omission of a complete nominal-refinement extension has a static reconciliation test, but the explicit fresh-Lean omission case is absent from the five-case compiled suite. Add that case before claiming the full reviewed-field acceptance item is complete.

## Remaining reconciliation

The inventory already has installed Fin parameter/result observations for all eleven native profiles. Java, Kotlin, native PHP, WIT/WASI and Perl still lack links to the hosted product and array-of-product evidence. Add those links to the existing observations, preserving their earlier scalar/container evidence and dispatch distinctions.

Nominal Fin field observations are still missing for Java, Kotlin, native PHP and Perl on both source routes. The archived record reports provide the execution evidence for those eight cells. Existing field observations should retain their original records, with hosted/runtime-specific supplements where appropriate.

Update consumer guidance, generated conversion tables and the closure audit with the exact promoted scope. Preserve every original artifact and source-history record. Verify the compiled omission case, then audit #1441 and #1442 individually before closing them. Neither task closes the parent requirements for recursive/generic/indexed fields, Subtype, PHP-Wasm or other refinement transports.

## Verification records

| Local log | SHA-256 |
|---|---|
| `build/vo1441-hosted-closure-audit-3ca155f-r1.tap` | `7ebfcc6eee69692fe4dfc8153be417f929e26e0c348b711d40c9762374ab74c8` |
| `build/vo1441-1442-source-contracts-3ca155f-r1.tap` | `a9d6ccc7d31b665098dc587e498e5e6713d4fecd567d41a4c7bafe75f7557478` |

The original hosted C-family log is [job 113952962715](generic-record-array-hosted-20261010/job-113952962715.log). Its fresh-review tests appear at lines 5811, 5932 and 6191. The archive authenticates the complete log; these line numbers locate the observations without replacing their provenance checks.
