# Nominal Python Subtype acceptance harness

This milestone adds the Python acceptance harness for VO #1444. It does not add installed Python support observations. Compiled runs, independent record verification, archive controls, recurring CI and consumer-documentation promotion follow.

The ordinary and independently reviewed author routes each build a full API and a separate constructor-free result-only API. Each selection must reproduce its model, receipt and wheel from two independent author roots. The unchanged wheel then goes through separate offline pip installations on CPython 3.11 and 3.12. Author roots and extracted inspection files are removed before either public caller runs.

The caller checks named records and variants, aliases, nested containers, per-use constructor choices, normalization, large integer results, mixed Fin rejection order, unchanged input data and repeated rejection/recovery. Full API runs perform 4,212 checks and expect 1,032 rejections; result-only runs perform 2,086 checks. Each also checks eight independent snapshot mutations. The synthetic model detects ten full-API implementation mutations and five result-only mutations. Model tests do not execute Lean.

The installation harness records the fresh environment before pip runs. Only original receipt files and named pip metadata may extend that baseline. Normal Python site initialization remains enabled. Execution uses isolated imports and a fresh empty bytecode prefix, with all environment files, links and interpreter bytes checked before and after each call. The consumer tree is physically renamed for the second execution. Original wheels are retained under `build/`, outside `/tmp`.

Wheel inspection checks package coordinates, native runtime and component identities, generated public modules and type stubs, the original receipt and wheel RECORD. The evidence generator can reconstruct all 19 transitive modules from a frozen Git revision. Constructor/source entry counters remain a separate acceptance requirement.

Validation at predecessor `479684ae6d5d5c6b9f2ce0791f5ccbd16531aa23`:

- Focused caller, generator and registration checks: eight passed, no failures or skips. Log: `build/vo1444-nominal-python-harness-focused-r2.tap`, SHA-256 `8e20537d6c7c92bc35bc40a31c0cb1a3a9226ed24fd2e0f27a6adc4eafa4dc47`.
- Registered component-refinement, checked-JavaScript and reference-documentation regression: 97 passed, no failures, 17 explicit build-gated skips. Log: `build/vo1444-nominal-python-harness-regression-r1.tap`. The frozen-generator test was added after this run started and passed in the focused run above.
- Targeted ESLint and repository JavaScript typechecking passed.
- Three exact registration transitions preserve the prior source-history chain. The support inventory remains byte-for-byte unchanged at 484 evidence entries and 577 observations. Ledger SHA-256: `d00352b49f475b0bf9d2ed85a0e0a5145d5c5524ed0d389ca6da8ca0e3ea090b`.

The installed gate requires `LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHON_TEST=1`, an explicit `LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHONS` JSON mapping for both supported minors, and an explicit native glibc floor. Optional route and API-mode selectors reject unknown or duplicate values. The gate refuses uncommitted producer sources and existing output directories. No registry publication is part of this milestone.

## Inspection-order repair

The first frozen run at `9cac3f75bf72a79298d8a3ed3dc452511cd62ce7` reproduced the same ordinary/full wheel from both author roots, then failed the inspection harness's generated-source comparison. The checker reconstructed native library identities from the sorted receipt. The original generator emits the adapter first, then the component and runtime libraries. The identities matched, but the serialized dictionary order differed.

The repair reconstructs that producer order while still comparing every library identity against the receipt. A regression test varies receipt order and rejects changed library bytes, runtime identity and component identity. Nine focused checks passed without failures or skips; targeted ESLint passed.

The original failed run remains retained at `build/vo1444-nominal-python-ordinary-full-r1-9cac3f7.*`, with TAP SHA-256 `3b67c8c8b5a797861459f71f60ccb50b9d2cb0cb785cfa2df2d498cbb1bf3ea8`. A diagnostic replay using its original wheel and the uncommitted checker repair passed on Python 3.11 and 3.12 before and after relocation: four executions, each with 4,212 checks, 1,032 expected rejections and eight snapshot controls. Its scope is recorded in `build/vo1444-nominal-python-order-probe-r1/scope.txt`. That replay does not replace the pending clean, frozen-source acceptance run.
