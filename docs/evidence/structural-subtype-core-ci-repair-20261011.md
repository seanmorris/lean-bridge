# Structural Subtype Core CI repair

Predecessor: `68d6e3ba1b6bfbc8171a813d6a565ad330584076`.

## Observed failures

[Core run 38136048997](https://github.com/seanmorris/lean-bridge/actions/runs/38136048997/job/114460013456) tested `fb99ddabe63722eeda0da7a4e54c5b289c2edd7c` and reported 18 failing tests, 4,045 passing tests and 957 explicit skips. The original job log is retained at `build/ci-core-114460013456.log`, SHA-256 `38659b79f48e5bfeb263ba7b93fbf2a38edbcfbd47e0ab6d116d2e929e18e476`.

Two assertions still required structural Subtype rejection after that support was implemented. Commit `68d6e3b` repaired the metadata assertion and retained callback and nominal-field refusals. This milestone repairs the component-array assertion: valid nested Subtype trees must retain their constructor and complete refinement metadata in the schema-validated adapter plan. Malformed constructor names and nominal/callback-edge constraints still fail. No production admission or conversion code changes.

The component-array failure was reproduced locally before editing. Original TAP: `build/vo1444-core-array-baseline-r1.tap`, SHA-256 `e886a7f9d99fc435bc530016e692eca121e1c715fda6586449be4d92a0abb3ca`.

The other 16 failures attempted to read original producer commits through `git show`. Core used the checkout action's default `fetch-depth: 1`, so those commits were absent. Core now requires `fetch-depth: 0` and retains `persist-credentials: false`. Tests reject a missing, shallow or disabled checkout. A separate real Git fixture reproduces the failed historical read in a depth-one clone, fetches its history, and verifies both the older and current file bytes. The evidence readers still require exact producer bytes; no missing-history fallback or skipped authentication was added.

## Validation

The local replay selected every original failing test, the corrected metadata case and its new structural checks. It passed 20 tests with no failures or skips. New checkout/history controls and the independent browser-corpus controls passed nine tests with no failures or skips. The browser corpus is draft work and does not establish installed browser support.

The four-root regression passed 178 tests with no failures and 32 explicit compiler/installed gates skipped. It ran the complete component-array, elaborated-metadata, structural installed-contract and checked-JavaScript roots. TAP: `build/vo1444-core-repair-regression-r1.tap`, SHA-256 `b6281290c84930ddefb4704ee1d1b9b1caffa43e1ff65b94632e32fd026b5f94`.

The documentation suite passed 133 tests with no failures or skips. TAP: `build/vo1444-core-repair-docs-r1.tap`, SHA-256 `79499185e1b1c7d994248cee00aaf21d40ecbf3a6cc7507fa25424c7d8cff835`. Full lint, checked JavaScript, 16 generated-reference checks and actionlint passed. The original-failure replay TAP is `build/vo1444-core-failures-replay-r1.tap`, SHA-256 `8da43dd27d8d9b472a6341d78e6d0cbce6724c5836b8a459befdcc711fed3dba`. All 16 failed historical reads refer to 14 producer commits reachable from the hosted revision; complete history includes each one.

Original failed baseline and draft lint logs remain retained. These local results do not claim a fresh hosted CI pass or fresh installed execution.

## Evidence preservation

`structural-subtype-core-ci-source-history-20261011.json` records five exact source transitions from the predecessor. Its SHA-256 is `72a22269fec572fc567fe16682d6ab3dddaec14c988cd5a05a08cd0163f7f81c`. Four current-source hashes change in the type inventory. All 464 evidence claims and 555 observations retain their content and status. An independent audit compares each restored source with its Git predecessor, checks the four pin-only changes and verifies all 9,330 earlier evidence files against their Git blob identities. No earlier receipt, log, source snapshot or history ledger is rewritten.

Remaining #1220 work includes browser/PHP-Wasm checked records, broader checked-record shapes, nominal and callable Subtypes, and graph/owned/dependent combinations. This CI repair closes none of those requirements.
