# Per-use nominal Subtypes in native adapters

Native metadata, reviewed Binding IR and native adapters now retain a checked constructor for each Subtype field in an acyclic copied plain record or variant. Two uses of one nominal type can select different constructors. Shared definitions and payload layouts retain type identity and Fin bounds without acquiring a type-global constructor choice.

The component metadata validator still refuses these nominal Subtypes. Component carriers, constructor-free nominal results, recursive and generic records, owned values and callbacks remain separate work. This milestone establishes source compilation and generated native boundaries. It does not promote installed support cells.

## Implementation

`src/abi/refinements.mjs` matches closed per-use trees to the enclosing document's definitions. Record and variant names, every field, every case and their order must match. Aliases resolve through the same definition table. The validator enforces 32 type edges and 4,096 visited nodes and rejects missing, sparse or accessor-backed members. Callback, owned, generic and proof-bearing nominal choices remain gated.

`semantic-model.mjs` compares constructor-independent nominal facts and puts constructor decisions on each declaration. It retains sibling and nested Fin bounds in each full nominal tree. Shared nominal extensions remain Fin-only. Reviewed selection derives exact named field/case choices from those trees, then fresh Lean types each constructor and reconciles the authored API.

The native model uses the per-use converters introduced in `459fa8eaf0547d4f2cba488dbb135bb6adfc72f5`. C and Perl walk record fields and only the active variant case. They retain the existing order: raw shape checks, all Fin checks, constructor validation, then checked source dispatch. Native documentation expands each site's choices without replacing them with shared bounds and rejects conflicting bounds.

## Validation

Six synthetic unit checks cover shared identity, distinct per-use choices, malformed or misplaced decisions, bounded traversal, review differences, generated documentation and C/Perl guard paths. Their fixture is not compiler evidence. TAP: `build/vo1444-nominal-native-unit-r1.tap`, SHA256 `41eed724d5069cbcb9a9845683348100fb7947e682086e6c251222f88b0a4ee2`.

The fresh Lean check runs through the registered `tests/native-subtype.test.mjs` root. The independent review fixture authors its own twelve-export API and Fin bounds without reading a compiler report. Ordinary, reversed-order and reviewed native routes each:

- Extract twelve declarations from freshly compiled modules.
- Reconcile the independently authored API and its per-use constructors.
- Prove 23 generated Lean assertions covering normalization, repeated records, aliases, active and inactive branches, later failures, Fin rejection and result projection.
- Compile the generated C11 and C++20 adapters with warnings treated as errors. C++ uses the repository's pinned standalone Boost headers.

All 69 Lean assertions and all six C/C++ syntax checks passed. Reversed exports generated identical Lean and C adapter bytes. Reviewed adapters retained the author's parameter names. The same run preserved 25 source refusals in each of native and component profiles and confirmed that the component runtime gate remains closed.

Successful TAP: `build/vo1444-nominal-native-source-r5.tap`, SHA256 `3ab4fba7b516e2c60c27de3e26e36b8ee1bfc91ff6bb956c414cc9e6747fb9ca`. The retained requests, reports, generated adapters and models are under `build/vo1444-nominal-native-source-r5/`; its report SHA256 is `5d6492472472e8db6f14d74d271062bed109e90a291a8b11c77948efeb1a6a06`. The report records twenty subprocess invocations and marks installed support false.

A second fresh run passed the same checks after the final test edits: `build/vo1444-nominal-native-source-r6.tap`, SHA256 `1aa241fae35eba8f18538489ed753f1613e57b2cd3f57c9c0c88cbaad6f6e8b1`; report SHA256 `2ca71690146dfb491a577ab1c337e9017b63aadc340659cf0c51bbb24a60678e`. The existing fresh structural-Subtype check also passed, including native Lean/C adapters, component metadata and its independent refusal controls. Its TAP is `build/vo1444-nominal-native-structural-r1.tap`, SHA256 `8272fa6eaddc078b7463540ffb88dfe9b3e63446afe2f5625a7c24e542833cf5`.

The first four attempts exposed test setup errors: the expanded fixture emits six existing nullary-helper warnings rather than four; the fixture export `aliasPair` collided with `AliasPair` after C naming; the C++ probe initially lacked the pinned Boost headers and then selected C++17 instead of C++20. The fixture export is now `inspectAliasPair`. The original failed TAP files remain in `build/vo1444-nominal-native-source-r1.tap` through `r4.tap`.

Documentation passed 133 checks without failures or skips. Full lint, checked JavaScript and all sixteen generated reference pages passed. Documentation TAP: `build/vo1444-nominal-native-docs-r1.tap`, SHA256 `f8a03d6b257d8c8354a0f617787d16f9d4a95cf4376ebc8a15fcf4dded6d05f6`.

The first broad regression found one stale syntax-stage test that expected nominal Subtypes to remain unadmitted: 379 passed, one failed and 64 checks were gated. The test now admits copied plain records and separately checks callback, generic-record and nested-site refusals. The original TAP remains at `build/vo1444-nominal-native-regression-r1.tap`, SHA256 `6deb2ec8214c6579380489b264fa23de97a6924bace08c621da18b3242ce2873`.

The complete rerun passed: 444 tests, 380 passes, zero failures and 64 intentionally gated checks. It includes the registered configuration, metadata, semantic model, native Subtype, nominal Fin, checked-record, adapter, boundary and type-surface roots. TAP: `build/vo1444-nominal-native-regression-r2.tap`, SHA256 `bbcbc2e4bf095bfadaab434b6a275e08822725eed054b2fcdedc9c1a8009d396`. Full lint, checked JavaScript and all sixteen generated reference checks passed again on the final source.

The final focused selection, native and history checks passed all fifteen tests: `build/vo1444-nominal-native-focused-r4.tap`, SHA256 `b7bc7f0a6eb8a1c56920eaa36bfd848682655f13a229b87da34835be20388830`. An earlier focused run started during ledger regeneration and read the previous nineteen-file draft; the repeat ran after regeneration finished. The final selection-test formatting check passed after a manual line-wrap correction.

## Source history and next acceptance

The new source ledger records twenty exact transitions from `8e4445fc08b8f39bb9b47887c8583bb21bb94a94` and refreshes 635 current-source pins. It preserves the support inventory's 472 evidence entries and 571 observations. An independent audit checked every transition and all 10,013 earlier evidence files. No earlier ledger or installed receipt changes. Ledger SHA256: `d32a60fccba8aff463d627db045a5a84aca48419c6d0e1d09b599484b2a647d0`.

Next, complete constructor-free result metadata and component carrier integration. Freeze the producer, exercise ordinary and reviewed source-free installed C/C++ packages with relocation and recovery, then extend installed acceptance to the other host profiles. Preserve original records, require their CI checks and promote only measured support cells. The broader callback, owned, recursive, generic and dependent combinations under #1220 remain open.
