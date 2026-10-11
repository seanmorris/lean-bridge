# Native nominal Subtype authoring guidance

The author guides distinguish checked inputs from Lean-produced results. Native copied results can omit constructor selections. Acyclic copied plain record and variant fields retain a constructor choice at each input use. The guides label these additions as generated support with installed acceptance pending; npm/PHP-Wasm component carriers remain unadmitted.

The new `NominalSubtypes.lean` example pairs a checked `Positive` field with `Fin 3`. Its ordinary configuration selects only the input constructor, preserves the Fin bound and exports both an echo and a result-producing operation. Reviewed examples distinguish the result-only null constructor marker from ordinary configuration, where the selection is omitted. Variant guidance requires exact ordered case/field names and describes active-case validation.

## Validation

The compiler check reads the exact Lean and JSON fences from `docs/lean/export-decisions.md`, compiles the module, authenticates fresh native metadata, generates adapters and proves six Lean assertions. They cover valid input, Subtype rejection, Fin rejection and constructor-free results. It passed with no compiler output or warnings:

- TAP: `build/vo1444-nominal-author-source-r2.tap`, SHA256 `47335c2d7c3a40a3c2fc5cfb7c9fcaf9568363ee9fc0e9933e9d926a978a64bf`.
- Report: `build/vo1444-nominal-author-source-r2/report.json`, SHA256 `11162e42da441eae2a684fa9ad7996f2c083c4020b9e984190df0028bd233755`.

The first compiler probe omitted the explicit export-name list from its metadata request. Lean compiled the documentation module, then refused that malformed request. The test now passes the documented exports explicitly. The failed `r1` TAP and temporary source directory are retained. The check keeps an abort signal and a 600-second ceiling after the initial disk-constrained attempt took 271 seconds.

The native Subtype root passed 48 tests, with zero failures and seven intentionally gated compiler/installed checks. TAP: `build/vo1444-nominal-author-native-root-r1.tap`, SHA256 `d1d4b240e2138dd666c84871352801fa60d301ad6b7529822c640a1959d62a1f`. The support inventory passed all 64 tests: `build/vo1444-nominal-author-inventory-r1.tap`, SHA256 `70b4c67235ccb669b75516b643628112f15be8c3b05e4535dfa26398790a1bcd`. Four initial focused documentation/history checks also passed. Targeted lint, checked JavaScript and all sixteen generated reference pages passed.

The first full documentation run passed 132 of 133 checks. Its CPAN assertion still expected the old scalar Subtype table label. The assertion now includes “with constructor selections,” matching the guide's distinction between installed selected results and the new constructor-free result support. Original TAP: `build/vo1444-nominal-author-docs-r1.tap`, SHA256 `ef3a6f832499d5825129db3ba92212171de19d520fcee0eb32dd378443d091c3`.

The corrected CPAN assertion passed on its own. After CPU pressure subsided, the full documentation suite passed all 133 checks, with no failures or skips: `build/vo1444-nominal-author-docs-r2.tap`, SHA256 `ecff542632e8fa906f417a5d46428422984804b9bf8aa3402a16104bad6cc012`. Four final documentation/history checks also passed: `build/vo1444-nominal-author-final-focused-r3.tap`, SHA256 `1719b50e6a850211a006b6fea5dd5a97fc61b59a98997e4806bdd4a0ada466d8`.

At the user's report of excessive host load, the remaining full lint job was stopped with exit 143. That interrupted run is not a pass. Validation resumed serially at low CPU and I/O priority after the host recovered. Targeted lint passed for every changed JavaScript file, and a new full repository lint completed successfully (`build/vo1444-nominal-author-full-lint-r2.log`). A separate draft of shared component mirrors is not part of this documentation milestone or its support claims.

## Source history

The new ledger records seven exact transitions from `8af7aea7f2488554a3ad1fb340d7a8af2a4b6f4c` and refreshes 48 source pins. It leaves the 472 evidence entries and 571 observations unchanged. Ledger SHA256: `2ea975406006397b1f1b40cedced15c780a6ca8b74a902cb3d499af78f7d37b2`. An independent audit checked the complete inverse transitions and confirmed that all 10,017 earlier evidence files are byte-identical. No installed support cell is promoted, and earlier ledgers and receipts remain immutable.
