# Per-use nominal constructor metadata

The source extractor now preserves constructor choices for each use of an ordinary record or variant. Two fields of the same record type can select different normalizing constructors without sharing a type-global choice. This follows the converter foundation in `459fa8eaf0547d4f2cba488dbb135bb6adfc72f5`.

Public native and component validators still refuse nominal Subtypes. These checks establish source metadata and selection syntax, not an installed package or new supported type cell. Reviewed decisions, runtime adapters and installed acceptance remain ahead.

## Selection contract

A record selection names the exact source type and every field in source order. A variant selection names the exact source type, every case and every case field. Null fields select no constructor and retain compiler-owned Fin bounds. The JavaScript reader, JSON schema and independent Lean reader reject malformed shapes; both readers also enforce unique member names, 32 type edges and 4,096 visited nodes. Member wrappers count toward the node budget. A selection must contain a constructor.

Lean retains selected nominal and alias trees inline. It never caches their choices under a shared nominal name. Both Lean and JavaScript recover the complete selection from the resulting projection and compare type, field, case, order and constructor placement. Lean still checks each constructor's explicit input, exact Option Subtype result, selected source module and implementation. Unsafe, partial, foreign and sorry-dependent constructors refuse.

The existing unselected Fin path keeps its nominal cache. Recursive selections, generic Subtype records, callbacks and constructor-free nominal results remain refused in this source milestone. The converter's earlier constructor-free result support is not yet wired through source metadata.

## Fresh compiler checks

`tests/helpers/nominal-subtype-selection-extractor-tests.mjs` runs from the registered native Subtype root when its explicit switch, the structural extractor switch, or the C Subtype profile is enabled. It passes the test abort signal to Lean processes and retains failed source artifacts.

The successful run used the pinned Lean 4.32.2 compiler:

- Native forward and reverse selections, plus component forward selection, each type-checked 12 selected declarations. Reversing exports preserved identical projections.
- Repeated records inside one parameter retained different constructors. Structural aliases, nested records, variant cases, two parameters and a separately chosen result retained their own decisions. The sibling Fin bound stayed `3`.
- Each profile refused 25 negative or still-gated cases. These include changed type/member identity or order, missing/extra/duplicate fields and cases, wrong constructor input/predicate, unsafe/partial/foreign/sorry implementations, out-of-closure and unknown constructors, depth/node overflow, and the remaining recursive/generic/callback/result-only gates.
- The public validators rejected the positive source projections at their existing nominal runtime gate.

Successful TAP: `build/vo1444-nominal-selection-source-r2.tap`, SHA256 `ce6e26366bdb797e2cb59dc5536d6bb2cb1cc054b279109841118ba41b4905df`. The original request, metadata and command observations are in `build/vo1444-nominal-selection-source-r2/`; its report SHA256 is `7f7ad35c1a54fba7e19bb2fe772d13479e50411102b6c3a88301e88bbf562d57`.

The first test attempt expected apostrophes around Lean's intentional sorry warning; Lean uses backticks. The exact warning assertion was corrected, and the unused binder was named explicitly. The failed TAP remains at `build/vo1444-nominal-selection-source-r1.tap`, SHA256 `d5223b92669c5509e30f07d4d7a995984fb826a491dbc54f319bf5f686c85374`.

The existing structural extractor passed unchanged source expectations after its test ceiling increased from 180 to 600 seconds and its subprocess received the abort signal. It took 68 seconds in this run. An earlier attempt exceeded the 180-second ceiling and did not finish until 296 seconds; an unchanged retry passed in 171 seconds. Current TAP: `build/vo1444-nominal-selection-existing-structural-r1.tap`, SHA256 `2929db358c9c1b124413da865f51ac6fe09d8cebe8566bfdefef2f025c4fad3d`. No forced-cancellation experiment was run.

Five existing fresh-Lean checks also passed without skips: native C/C++ mirror adapters, raw normalization/refusal, independent review reconciliation, npm recursive carriers and result-only record mirrors. Their TAP is `build/vo1444-nominal-selection-existing-records-r1.tap`, SHA256 `62bac69697f20baa974d26f5f9af300d0176fa7544314fcc069a5494c2656283`.

Documentation tests passed 133/0/0, exact source-history tests 4/0/0, and full lint, checked JavaScript and all 16 generated reference pages passed. Documentation TAP: `build/vo1444-nominal-selection-docs-r1.tap`, SHA256 `0e6daf1fa69e4043359f2287521e02bd00e330a5e2f08f99cf1f56ab4e8b9fb4`.

The broad registered regression passed 372 of 436 tests, with zero failures and 64 explicitly gated installed/compiler tests. It covers export configuration, elaborated metadata, semantic lowering, native Subtypes and nominal Fin, checked records, compiler adapters, refinement boundaries and the support inventory. Seven focused checks also passed through the registered native Subtype root without skips. The fresh compiler checks above were enabled separately; the broad run does not count its gated cases as passes.

- Broad TAP: `build/vo1444-nominal-selection-regression-r1.tap`, SHA256 `eab105d1aa2706c4ae1417a4069fac86516e22dbdc0682379b17f1db2100d079`.
- Focused registered TAP: `build/vo1444-nominal-selection-registered-r1.tap`, SHA256 `a8772649ecec193ee2c276b2163a5289cf401dba0f599a85e3a8a494164d5b7a`.

## Source history and remaining integration

The immutable ledger records eight exact transitions from `b0cabee3ac47be0feeb4cf7154b3ce32ecfa56f5` and 164 current-source pin updates. It leaves the support inventory's 472 evidence entries and 571 observations unchanged. The independent source audit preserves all 10,011 older evidence files. No earlier ledger or installed receipt is rewritten.

Next, independently reviewed Binding IR must carry per-declaration nominal decisions while shared type definitions retain constructor-independent facts. Fresh source reconciliation must reject altered type/field/case/base/predicate choices. Native and component models must then preserve those decisions through field validation and erased carriers. Installed C/C++ and the remaining host profiles, relocation/replay, original acceptance archives, mandatory CI and measured support/documentation promotion follow that integration.
