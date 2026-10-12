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
