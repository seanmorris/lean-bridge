# Checked-record browser acceptance foundation

Predecessor: `5387cfe33ac97ecccdef9fa54be4dc31339c487d`.

This milestone prepares four independent installed-package selections: ordinary full, reviewed full, ordinary result-only and reviewed result-only. It does not claim an installed browser pass or promote any type-support cell.

## Public caller and package checks

The shared JavaScript caller retains the earlier Node assertions and adds complete input snapshots, exact constructor-versus-shape refusal checks, multiple-parameter rejection, normalization, proof-free results and repeated recovery. Its full selection performs 16,176 checks, 3,031 expected rejections, 8,088 calls and complete input snapshots around every call. The result-only selection performs 2,011 checks and 1,002 calls, verifies the absence of checked-input exports, and checks both `2^80` and `2^80 + 1` without lossy number conversion. Strict TypeScript callers cover the same public signatures and reject proof fields and nonexistent result-only exports.

The new producer builds in two author roots, compares original receipts and archives, removes both author/build trees, and installs offline through a compiler-free path. It physically renames the installed Node consumer and replays unchanged JavaScript and strict TypeScript while checking every component/runtime file hash. The older checked-record npm fixture moved an author root, not the installed consumer; its reports remain unchanged.

Page, React and dedicated-worker consumers use the same caller. Each author selection requires Chromium, Firefox and WebKit, production and Strict Mode React, remounts, worker restart, failed-asset recovery and pending unmount. Readers require 12 browser executions and 51 lifecycle observations per route, complete original build/install/caller/package records, locked framework identities, deployed Wasm hashes and external-network isolation. Source-only models and lifecycle fixtures are negative-control tests, not installed execution evidence.

## Adapter-plan schema correction

The new complete-plan schema test found that the published compiler-adapter schema omitted `erased` from nominal record descriptors even though the compiler emits and the runtime validates it. The corrected schema admits unique identifier lists of 1 through 1,024 erased names on nonempty records using copied-graph ABI 8. It rejects erased names on aliases, variants and other ABIs, malformed names, duplicate names, empty lists, extra fields and empty payloads. Runtime validation separately enforces disjoint proof and payload field names. No compiler constructor or transport implementation changes.

Original failed source-control runs remain in `build/vo1446-checked-browser-source-r1.tap` and `build/vo1446-checked-browser-source-r7.tap`. The first exposed a weak precision control based only on an exactly representable power of two. The second exposed the schema omission and a child-test runner environment issue. The low-bit case supplements the original assertion; child test controls now remove inherited test-runner context and request TAP explicitly.

## Validation and remaining work

Focused corpus, schema and history controls passed 15 tests with no failures or skips (`build/vo1446-checked-browser-focused-r9.tap`, SHA-256 `85acb845b626cc9b7d9a5927a9a346bfa6e79f635bf817a5dddae495571a17b0`). The eight-root checked-record/adapter regression passed 164 tests with no failures and 29 explicit compiler/installed gates skipped (`build/vo1446-checked-browser-regression-r1.tap`, SHA-256 `eac6cc000cfb0caee06d889de1306e87fc325e630aa15ca43940ed3acb400d6f`). The documentation suite passed 133 tests with no failures or skips (`build/vo1446-checked-browser-docs-r1.tap`, SHA-256 `f73730a0e0e281cf67266372d7d7150684745667b4bd4454d779ba478c90cf8c`). Seven earlier-history and nested-Fin checks passed, along with full lint, checked JavaScript and 16 generated-reference checks.

Actual installed runs, immutable archival, recurring CI and evidence-backed support/documentation promotion follow separately. No dispatch-count or memory claim is made.

Five exact source transitions and ten current-source pin updates preserve all 464 evidence claims and 555 observations. Ledger SHA-256: `dbba6ef878ad44cd7e1c40f9cd61728dd2a1e95531c6e46e7b2eec091eab0bf5`. An independent audit restores each source to its exact Git predecessor, compares the inventory apart from those ten pins, and verifies all 9,332 earlier evidence files against their Git blob identities. Earlier receipts and history ledgers remain immutable. The remaining PHP-Wasm, nested/refined/recursive/inherited/dependent/indexed/zero-payload/callback/owned requirements stay open under #1220 and #1446.
