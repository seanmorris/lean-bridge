# Constructor-free native Subtype results

Lean-produced native results can now expose a primitive-base `Subtype` without selecting an input constructor. The result projects its base value. This applies to scalars, structural containers, transparent aliases and acyclic copied plain records and variants. Inputs still require checked constructors at every Subtype site.

This milestone covers fresh source extraction, independent review reconciliation and generated Lean/C/C++ compilation. Installed acceptance and component carriers remain pending. It adds no installed support claims.

## Implementation

`src/analyze/NativeExports.lean` gives copied native export results a separate capability. It propagates through the admitted shapes and records `constructor: null` when no constructor was selected. Callbacks, owned values, generic record fields, proof-bearing payloads and recursive graphs do not inherit that capability. Unrefined recursive results and Fin-only records retain their existing mappings.

The native schema accepts the explicit null marker. Direction-aware semantic validation admits it only in a Lean-produced result. Default validation and parameter validation reject it. Reviewed result-only APIs derive no constructor decision; mixed APIs retain each input's choice. Structural aliases keep the same shape whether an input constructor is selected or the result is projected. Shared nominal definitions retain their identity and Fin bounds.

Generated native documentation and Perl POD describe result projection rather than constructor invocation. Result-only adapters generate no input constructor helpers. Selecting an unused output constructor produces the same native adapter bytes as omitting it.

## Validation

Four focused unit tests cover explicit result direction, missing or misplaced null markers, callbacks, owned and generic values, review reconciliation, shared definitions, Fin preservation, generated adapters and result documentation. TAP: `build/vo1444-subtype-result-unit-r4.tap`, SHA256 `ce8d0cb7fef1adbb63306c78607fb5bc24fa56d848453647f7c1b380bf6a5c55`.

The fresh compiler test is registered in `tests/native-subtype.test.mjs`. Its reviewed fixture authors the API independently, without deriving it from the compiler report. Four routes passed:

| Route | Exports | Lean assertions | Native compiler checks |
| --- | ---: | ---: | --- |
| Ordinary result-only | 13 | 16 | C11 and C++20 |
| Reversed exports | 13 | 16 | C11 and C++20 |
| Independently reviewed result-only | 13 | 16 | C11 and C++20 |
| Independently reviewed mixed inputs/results | 15 | 21 | C11 and C++20 |

All 69 Lean assertions and eight C/C++ checks passed. Native compilers treat warnings as errors. The ordinary and reversed routes produce identical Lean and C adapters. Reviewed C adapters preserve the author's parameter names.

The assertions exercise scalar and nested results, empty and inactive branches, aliases, Fin-bearing siblings, and a produced value of 121 that both input constructors would refuse. The mixed package selects different input constructors for two uses of the same nominal type and checks normalization, later failure and Fin rejection while projecting results without a constructor.

The same run checks six refused input, callback, generic, recursive and proof-bearing source declarations, two positive unrefined-recursion/Fin controls, and all thirteen component refusals. Successful TAP: `build/vo1444-subtype-result-source-r6.tap`, SHA256 `fe006f1cbc9b9ed9ff87cdba12d89cccc48c70518080ae8276c1ab6c6ad315bc`. Requests, reports, generated adapters and models are retained under `build/vo1444-subtype-result-source-r6/`. The 24-command report has SHA256 `13b2810db88281cc103e55264e125ef22010711e3695e6ae122c26d578b5f285` and marks installed support false.

Earlier attempts `r2` through `r4` failed in test assertions: Lean could not synthesize equality for `Except`, then needed explicit `Option` and `Except` annotations in the replacement mapping. Those failed TAP files remain. The result-only run `r5` passed before the mixed-package assertions were added; `r6` validates the final fixture.

Both existing fresh structural and nominal Subtype compiler checks passed again, including independent reviewed input choices and preserved refusal controls. TAP: `build/vo1444-subtype-result-previous-source-r1.tap`, SHA256 `529ae1d45e898b20a96274a0cb3d95f0c88eeedb74335462a50b7a8584558941`.

Five fresh checked-record controls passed: native C/C++ adapter compilation, independent review reconciliation, refused source sites, npm recursive carriers and result-only mirrors. TAP: `build/vo1444-subtype-result-checked-record-controls-r1.tap`, SHA256 `b75d2ae329e85b0ab718c4e64dde37f789c0e98d5ff98991f3fe05fe04d19d88`.

Documentation passed all 133 checks without failures or skips. Full lint, checked JavaScript and sixteen generated reference pages passed. Documentation TAP: `build/vo1444-subtype-result-docs-r2.tap`, SHA256 `5055f2676214247676eec99410794a197ec09810c6a3fc18b101336b92a2ae8e`.

The broad registered regression passed 386 of 451 tests, with zero failures and 65 intentionally gated compiler or installed checks. It covers configuration, metadata, semantic models, native Subtypes, nominal Fin, checked records, compiler adapters, refinement boundaries and the support inventory. TAP: `build/vo1444-subtype-result-regression-r1.tap`, SHA256 `ee2a8cc16d1b1f28c15e1a6d95e7456b4c341f2acb6d2941bfae104037ab2c52`.

## Source history and next acceptance

The immutable source ledger records fourteen transitions from `9e9c99a0000cd9bee80339a9ed971248cb68dacc` and 398 current-source pin updates. The inventory retains its 472 evidence entries and 571 observations. Ledger SHA256: `15c1db9ef64bff285f26baf2c0cf26c06b448e449c4b17d4bcbc954ed491b87f`. Earlier ledgers and installed receipts remain unchanged.

The independent working-tree audit checked all 23 milestone files, reversed each transition to its exact predecessor, and compared all 10,015 earlier evidence files. Focused unit/history checks passed six tests with one fresh-compiler check intentionally gated; that compiler check passed separately in `r6` above. Focused TAP: `build/vo1444-subtype-result-focused-r1.tap`, SHA256 `36a7075232ea9d97de6fe4c2be686eb8a0deaf32c25898bc6afc1f06cbad737b`.

Next, update the author guides and implement erased component carriers for nominal Subtypes. Freeze the producer before ordinary and independently reviewed source-free installed C/C++ acceptance, including relocation and recovery. Extend acceptance through the remaining host profiles, archive original receipts and require CI before promoting measured support cells. Callback, owned, recursive, broader generic and dependent combinations remain open under #1220.
