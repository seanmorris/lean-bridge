# PHP-Wasm checked-record acceptance harness

VO #1446, within #1220. This milestone registers compiler checks and installed-package tests for four selections: ordinary source, independently reviewed source, and separate result-only packages for each source route. It does not promote PHP-Wasm checked-record support or claim a hosted result.

## Compiler and caller checks

The independent review retains `Interval`, `Sized 3` and `Bounded 0 101`, erased proof names, closed value indices and per-parameter constructors. The Wasm model must have 32-bit pointers and the exact payload-only mirrors. Fresh Lean compiles the source and generated adapters before the compiler tests stop at the C compilation boundary. Separate reconciliation tests reject an omitted proof field, a changed index, reordered payload fields and a foreign constructor. A different valid checked constructor must compile as a legitimate API change.

The PHP caller retains every assertion and diagnostic from the native fixture. Its observation wrappers call the generated public functions without validating Lean predicates or converting arguments. They snapshot complete input values before each call and compare them in `finally`, including rejected calls. The caller adds an exact `2^80 + 1` result check alongside the original `2^100` cases. Full packages require 18,048 assertions, 9,023 public calls and snapshots, and 4,009 constructor rejections per execution. Result-only packages require 2,007 assertions, 1,004 public calls and snapshots, and no constructor rejections.

Explicit native-PHP stand-ins independently check those caller counts and detect nested input mutation. Their runtime version and word width are measured separately. They do not establish Lean execution, Wasm execution or installed-package acceptance.

## Installed acceptance

Each selected test builds from two independent author roots, compares model and package identities, verifies the package receipt, removes the author trees and installs from the isolated handoff. It reuses the shared offline installer to relocate and replay the installed deployment without Lean or C compiler access.

All twelve contexts are required: Node embedded and Composer arrangements, each in startup/lazy loading and weak/strict PHP modes; and Chromium bundled startup/lazy executions in both lexical modes. The loading trace must show that invalid PHP input does not load a lazy Lean library. The original deployment manifests, locks, drivers, callers, requests, compiler models and individual execution observations are retained beside the report. The verifier authenticates those bytes against the actual producer revision and the pinned runtime/package identities.

The installed test invokes that complete verifier before marking the run successful. A report-validation failure retains the installed tree and original records for diagnosis.

The registered installed gates require `LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST=1`. `LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_ROUTES` selects one or more of `ordinary-source`, `reviewed-ir`, `result-only-ordinary-source` and `result-only-reviewed-ir`. An explicit route without the enabling flag, invalid or repeated routes, and pre-existing output directories fail before compilation. Set a fresh `LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_OUTPUT` for each run. The installed entry point is `tests/helpers/checked-record-php-wasm-installed-tests.mjs`.

The nine compiler checks require `LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_LEAN_TEST=1` and use `LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_LEAN_OUTPUT` for retained observations. Their entry points are `tests/helpers/checked-record-php-wasm-lean-tests.mjs` and `tests/helpers/checked-record-php-wasm-reconcile-tests.mjs`.

## Remaining work

Execute the four installed selections at a frozen commit, authenticate and archive their original records, require them in hosted CI, and update only the observed support entries and consumer documentation. This harness does not measure internal dispatch counts or memory usage. Nested/refined/recursive/inherited checked records, other indices, dependent runtime payloads, zero-payload records, callbacks and owned positions remain separate requirements under #1220.

## Validation

All nine enabled fresh-Lean tests passed without failures or skips: four source selections and five reconciliation controls. Original TAP SHA-256: `1fe7476bcf3c2e32bfca4c220eb9a40bb32f844b49ea372b497443fcca44639d`. The final focused caller, guard and history suite passed eight tests without failures or skips; TAP SHA-256: `da896e6213148a554bfdaadcd5894ec18e490620e49cec1cb1b0d0fa41c1bad3`. All 133 documentation tests passed; TAP SHA-256: `5d32cee13fb972294066263b9d8c4b38118fdccdd299a452e712e7cc1032832d`. Full lint, checked JavaScript and sixteen generated-reference checks passed; targeted lint also passed after the final producer-verifier and formatting changes. These compiler and source controls do not count as installed PHP-Wasm observations.

The four-root regression completed 250 tests: 208 passed, none failed and 42 compiler/installed gates were explicitly skipped. Original TAP SHA-256: `bdcfe0f2ffad818837ef18afc27afb35cdc6fa37bc531d9f90c40655d30bf5d3`. The separate nine-test enabled compiler run establishes compilation only; the four installed PHP-Wasm selections have not run yet.

The [history ledger](checked-record-php-wasm-source-history-20261011.json), SHA-256 `3fc5fd2b05923bd831d26ee5b59db7cb0e385bd44c3ae7f1caa22a4a9140ecdb`, records three exact test-source transitions from `ebad9755490619052a87c1385af49f669ac48f86`. The independent audit verifies those transitions against Git, preserves all 9,770 earlier evidence files and requires the support inventory to remain byte-identical at 468 evidence claims and 567 observations.
