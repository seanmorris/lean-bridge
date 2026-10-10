# Reviewed browser Subtype support

The [installed browser archive](reviewed-subtype-browser-runs-20261010/index.json)
adds exactly six support cells: reviewed-IR `Subtype` parameters and results
for browser JavaScript, React and workers. It adds one evidence entry and one
observation to the inventory. Older observations retain their claims.

The original producer `f07c86d23f75b9b07ae66f6e9c7101c47b29b58e` compiled twelve
independently reviewed exports over `String`, `Nat`, `Int`, `ByteArray` and
`UInt8`. Two finite specializations select different constructors. Consumers
pass base values; compiled Lean rejects invalid values or supplies the
constructor's accepted, possibly normalized value. Results expose base values.

Chromium, Firefox and WebKit passed twelve engine/build configurations and
51 lifecycle observations. Each observation records 2,036 checks and 2,024
rejections. The run checks React production/strict remounts and pending
unmounts, worker shutdown/restart, missing-Wasm recovery and served asset
identities. Both author roots were deleted before offline installation;
browser execution used source-free static deployments.

This is local-engine acceptance. It does not establish hosted locked-Nix
acceptance, entry counters or relocated browser replay. The archive retains
114 original artifacts and its index, including selected source snapshots
and package digests, but not binaries or a complete toolchain closure.
The archive index SHA-256 is
`f2992a5696da474d6dce426c4b6c4aaee5d6eb5f0f989723e9a68a77a0cc5b7a`.

The promotion authenticates every archived artifact and rechecks the original
75 package/browser records. Tests reject omitted or altered records, invented
scope, changed commands or source routes, overlapping observations and repeated
promotion. Exact source-history transitions preserve earlier receipts and
account for changes to current source hashes.

The [required CI checks](reviewed-subtype-browser-ci-20261010.md) run all three
engines and retain partial observations on failure. Their hosted result
remains separate from the local installed run.

Nested containers, nominal fields, callback positions, owned-value transports
and other generic combinations remain open under #1220. This promotion adds
no support claims for those positions.

## Verification

The eight-root regression passed 711 tests with zero failures and seven
explicit compiler/installed gates in 191.20 seconds. It includes the browser,
native Subtype, JVM, inventory, corpus and documentation checks. TAP
`build/vo1444-browser-promotion-registered-r2.tap`, SHA-256:
`bda94ceb2f2092a00b40aac3b57aa076934d0a73761b083d8a887601e60615a5`.

Nine focused promotion/history controls passed without failures or skips.
They include altered bytes in every one of the 115 archive files, changed
scope, missing records, overlapping observations and an unrelated-checkout
writer refusal. The profile list is immutable. Full lint passed, final code
edits passed targeted lint, checked JavaScript passed, and all sixteen
generated references matched.

The independent Git audit verifies twelve exact source transitions and
87 current-source hash updates. All 419 earlier evidence claims and 518
observations are preserved. The six newly passed cells produce totals of
420 evidence entries and 519 observations. All 6,024 older evidence files
outside the closure-audit document retain their original bytes. The
closure-audit document changes only its Checked Subtype row.
Audit `build/vo1444-browser-promotion-audit-r2.json`, SHA-256:
`691fd3a338e004f87a9adc5041da396bcef5a14c6ce0e82ee9b315b8f56f93ba`.
The [history ledger](reviewed-subtype-browser-promotion-source-history-20261010.json)
hashes to `ade038495212a676ed3a088af8a03e7079bce7b816cbafdff4a5a83494b8333b`.

Earlier failed checks remain in `build/`: focused R1 found a case-sensitive
prose assertion; registered R1 found the previous 28-cell expectation.
The corrected test checks all 34 reviewed top-level Subtype cells and the
exact browser evidence without adding field or callback claims.
