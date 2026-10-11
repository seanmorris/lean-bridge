# Installed checked records in PHP-Wasm

VO #1446, within #1220. Four original installed-package runs passed at `d329faf45141be46e2e875c529ea4be14732c13b`: ordinary source, independently reviewed source, and separate result-only packages for each source route. Each run passed one installed test with no failures or skips.

## Executed packages

Each route ran in twelve contexts: Node embedded and Composer deployments with startup/lazy loading and weak/strict PHP callers, plus Chromium bundled startup/lazy executions with both caller modes. The pinned host was PHP 8.4.1 with 32-bit pointers. Every Node context was replayed and compared. The archive records 48 distinct route/context observations.

Each full-package context completed 18,048 assertions, 9,023 public calls and complete input snapshots, and 4,009 expected constructor rejections. Each result-only context completed 2,007 assertions and 1,004 calls and snapshots, without any checked-input exports. Wide integer results include both `2^100` and `2^80 + 1`. The callers retain the native corpus's normalization, error-attribution, repeated rejection and recovery checks.

All four producers built from two independent author roots, compared package/model identities, verified receipts, removed author sources, installed local archives offline with empty caches, relocated the deployment and executed it without compiler access. The full report verifier passed before each installed test completed. No internal dispatch count or memory measurement is claimed.

## Original records

The [archive index](checked-record-php-wasm-20261011/index.json) has SHA-256 `af276809d2a1a9eab267650a4e08ad0d7ba0bae3037a10722364502250b38e6b`. It retains 228 original files plus the index, including run start/end records, complete TAP, runtime identities, both compiler models and package receipts, reviewed contracts, PHP callers, deployed manifests and locks, individual execution observations and 38 selected Git sources from the actual producer commit.

| Route | Original TAP SHA-256 |
| --- | --- |
| Ordinary | `545b24f06726e8d9d4a36d01f13d64749e2baf3fed0b42e1a16a9e7917a52a78` |
| Reviewed | `d1f196d87383f6c2903c83b59253c19b4561c3ff2fa8ab862624cfca13add033` |
| Result-only ordinary | `26fcd9acc46a321dca63cb611db71bd6a0a8f96c61da50f9ff05ff7ce4912b76` |
| Result-only reviewed | `0765fb5831805751f350beae8a3d558c842047d4c7a3a25ff10fc1002b12150b` |

Validators read retained records rather than following historical absolute paths. They authenticate models, source/review decisions, package and runtime identities, deployed caller bytes and all twelve loading traces per route. The independent original-record checks passed on all four producers, including 172 missing-record controls and 616 coordinated semantic substitutions. Required recurring CI and exact support/documentation promotion remain next; this archive alone changes neither the support inventory nor hosted acceptance.

Nested/refined/recursive/inherited records, additional index kinds, dependent payloads, zero-payload records and callback/owned combinations remain requirements under #1220.

## Validation

The registered archive/history suite passed six tests with no failures or skips, including 458 missing/corrupted-file controls, 172 missing-required-record controls and 616 coordinated semantic substitutions. TAP SHA-256: `1c669e9834209e8e9d08b0b9c0d3e43c8c1b8c8b95866dac4c7d9089e56b7c16`.

The four-root regression completed 256 tests: 214 passed, none failed and 42 compiler/installed gates were explicitly skipped. TAP SHA-256: `d574b0cf069569a9a513394291ffa02749861460f86c7afab6a52601354741fd`. The separate four installed runs above have no skips. All 133 documentation tests passed; TAP SHA-256: `898cd1d804a8a1acb89373129faddf882d1320244e774dbfac076ebb418b8702`. Full lint, checked JavaScript and all sixteen generated-reference checks passed.

The [source-history ledger](checked-record-php-wasm-archive-source-history-20261011.json), SHA-256 `4c832b394d450fd08b7f3a83ccbef69557bb39cdc6e637990be39be08c48e1a1`, records three exact registration/history transitions from the producer commit. The independent audit compares every archived original with its retained run or Git source, preserves all 9,772 earlier evidence files, and requires the support inventory to remain byte-identical at 468 evidence claims and 567 observations.
