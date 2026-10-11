# Installed checked records in Node and browsers

VO #1446, within #1220. All four local installed-package selections passed with no failures or skips. They cover ordinary source and independently reviewed IR, each with a full checked-input package and a separate result-only package.

| Selection | Original producer | TAP SHA-256 |
| --- | --- | --- |
| ordinary-source | `6f4aeaf349a0b696650e43a5aa677a1f073e869d` | `fc2403cc843ef75fa3b4746f214161b06349a9f776191d8de2077701390ea210` |
| reviewed-ir | `ccc372392997ea0de2ef72a1b29474df96e3af39` | `c68ada9d98e6d23f22612092139097b02cb4646767d9528a77cda2d6fc0e5939` |
| result-only-ordinary-source | `ccc372392997ea0de2ef72a1b29474df96e3af39` | `0e639773e2efd7caaa5854bb5da68f2b9e33a41be6d0827109dd3311b0163845` |
| result-only-reviewed-ir | `db18006038829bf87c020f081d99b27a8932ee20` | `a99213c44c6d2695df0da1f85e97fa441d26eaf45c3434c97d339f4641484e3e` |

Each selection reproduces component/runtime archives in two author roots, deletes author/build sources, installs offline, checks strict TypeScript, runs Node, physically relocates the installed tree, and repeats the unchanged caller. The browser consumers bundle the installed packages, remove installation/build sources, and run with external browser networking blocked.

Each selection has two Node executions, twelve browser executions and 51 lifecycle observations across Chromium, Firefox and WebKit. Browser contexts include a JavaScript page, React production and Strict Mode, and dedicated workers. The lifecycle checks cover remounts, worker restarts, failed-asset recovery and pending unmounts. Across all four selections, these total eight Node executions, 48 browser executions and 204 lifecycle observations.

The full caller checks 16,176 assertions, 3,031 expected rejections, 8,088 calls and complete input snapshots, and 3,031 recoveries per observation. The result-only caller checks 2,011 assertions and 1,002 calls and snapshots, including exact `2^80` and `2^80 + 1` results without checked-input exports. These caller counts do not measure internal adapter, constructor or source dispatch.

## Originals and verification

`checked-record-browser-20261011/index.json` has SHA-256 `8a7284d2dbb30071f44a972c3c0726007ca59181864ed81ea2916938f1a5d518`. The archive retains 425 originals plus the index: 74 required records and start/end/TAP files for each selection, 38 selected Git sources for each of three producer commits, the original runner, and both report checkers. Each route retains its actual producer revision. The selected compiler, fixture and acceptance sources are byte-identical across the three revisions; intervening commits repair unrelated CI assertions.

The registered archive tests authenticate every file, compare selected sources with original Git blobs, verify sequential run provenance and disk guards, and check the original installed reports. Negative controls reject 852 missing/corrupted index or original-file cases. Each route also rejects 74 missing required records, 34 coordinated npm/compiler/caller changes, and 133 browser/package/lifecycle substitutions. The untouched originals pass again after those controls.

`scripts/archive-checked-record-browser.mjs` refuses an existing destination and requires four successful distinct selections before creating the archive. The source-history ledger records only the three test-registration/history changes against `db18006038829bf87c020f081d99b27a8932ee20`. Earlier evidence and the support inventory remain unchanged.

## Scope still open

These are local Linux observations, not hosted CI acceptance. Package binaries and complete toolchain closures are not retained in this archive. No memory or internal dispatch measurement is claimed. Required recurring browser CI and exact support/documentation promotion follow separately. PHP-Wasm and broader nested, recursive, inherited, dependent, callback and owned checked-record combinations remain open under #1220.

## Archive milestone validation

The registered four-root regression passed 190 tests with zero failures and 33 explicit compiler/installed gates skipped. The four original installed selections above have no skips. Original regression TAP SHA-256: `0327618da7b243c3dee31fb8498e0e182923264e1f16efb932d3fba6c6489069`.

Registration, current-source evidence and history checks passed 15 tests with no skips; TAP SHA-256: `379e97f2cfb1b8a150162cc273f71357832ccaa6749460c177c99018393599f8`. Documentation passed 133 tests with no skips; TAP SHA-256: `0e45f327f0887d00afcddd15ef3b6a5989ae070e51e5dc4b7e34827c86f503cc`. Full lint, typecheck and all 16 generated-reference checks passed.

The independent archive audit compares retained bytes with original run files and Git sources, checks all three reversible test-source transitions, and verifies that all 9,338 earlier evidence files and the 464-claim/555-observation support inventory remain unchanged. The immutable source-history ledger has SHA-256 `3871144e02fb3d23507239538bc8401e0ac07bc2b8f1bc88dd230e9bc0cc5220`.
