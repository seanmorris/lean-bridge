# Refinement closure audit, 7 October 2026

Source baseline: `7f7bd65104050efddd328377389072f4c4272ac0`. VO #1434 tracks this audit. This is a source and inventory review, not a new installed acceptance record.

## Recorded coverage and remaining work

The [inventory](../type-surface.v1.json) records each source path, position and installed observation separately. The following rows summarize that inventory at the baseline; they do not promote additional cells.

| Area | Recorded installed coverage | Remaining work |
| --- | --- | --- |
| Fin parameters and results | Ordinary-source Node JavaScript/TypeScript; browser page, React and worker profiles; C, C++, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI | Python and Perl implementation awaits installed evidence. Native structural checks cover Array/List/Option, not every copied shape. |
| Fin nominal fields | Ordinary-source Node JavaScript/TypeScript, including the recorded alias and finite recursive cases | Native and browser field acceptance remains separate. |
| Fin callback positions | Ordinary-source Node JavaScript/TypeScript | Native callback/closure checks require their own ABI and lifetime acceptance. Browser parameter/result evidence does not cover callbacks. |
| Checked Subtype | Top-level primitive-base parameters/results for the recorded Node, browser and C-family profiles | Python/Perl evidence remains pending. Nested and nominal Subtype positions are not admitted. |
| Finite function specializations | Ordinary-source Node JavaScript/TypeScript, earlier Perl acceptance, and seven native-host evidence groups | Python and the newer shared Perl fixture need their CI reports. These functions do not establish generic-record support. |
| Closed generic records | No positive acceptance from the new slice yet | #1433 implements alias-named copied records for npm/strict TypeScript and C/C++; #1426 retains remaining native-host rollout. |
| Reviewed-IR refinements and constructed generics | No installed acceptance for these mappings | Reconcile reviewed authority with fresh elaboration before admitting them. Inspected renderer branches are not installed support. |
| PHP-Wasm refinements | No positive refinement acceptance | Keep this gap visible and distinguish it from native PHP. |

The seven native specialization evidence groups are C/C++, Rust, Ruby, .NET, Java/Kotlin, native PHP and WIT/WASI. Perl's earlier `perl-finite-specializations-ordinary-source` observation remains valid; a pending shared-fixture report does not erase it.

## Source constraints

- [NativeExports.lean](../../src/analyze/NativeExports.lean) extracts closed Fin bounds and validates checked Subtype constructors. Its record path rejects parameterized, indexed and inherited records. A closed application such as `Pair Word String` does not become a supported record merely because function specialization resolved its arguments.
- [native-types.mjs](../../src/analyze/native-types.mjs) and [native-model.mjs](../../src/build/native-model.mjs) retain native refinement-position restrictions. Existing C traversal code for pairs/results is insufficient to admit those shapes through extraction, metadata validation, documentation and Perl generation.
- [semantic-model.mjs](../../src/analyze/semantic-model.mjs) compares nominal definitions by name and immediate edges. #1433 must preserve duplicate-definition conflict checks when adding compiler-owned generic provenance.
- [native-model.mjs](../../src/build/native-model.mjs) renders named Lean types with an absolute-name prefix. The generic-record design keeps the verified alias as both identity and Lean spelling; arbitrary applied type text must not replace the identifier contract.
- [reviewed-source.mjs](../../src/analyze/reviewed-source.mjs) keeps export decisions in reviewed Binding IR and rejects competing configuration specializations/contracts. It also restricts source extensions. Adding an ordinary-source refinement extension does not authorize a reviewed build.

## Reviewed-IR design requirements

The next design must identify the reviewed field that authorizes each exact Fin bound, Subtype constructor or finite specialization. Fresh Lean elaboration must verify the selected declaration, source closure, concrete arguments and instantiated type. A constructor must still accept the exact base type and return `Option` of the exact subtype.

Test mismatched bounds, substituted constructors, changed source modules, fabricated specialization applications and conflicting nominal identities. Preserve source-located rejection diagnostics and authenticate the same facts in package receipts. Do not admit a mapping by trusting user-authored provenance or dropping a constraint during transport lowering.

## Sprint handoff

Claude owns #1433's generic-record implementation while Codex reviews milestones and handles the repair queue. The Perl indexed-message milestone is separately reviewable at `6c06fa6`; it does not add installed support claims. CI evidence remains tied to the revision that actually ran.

Feature development continues while unrelated CI jobs run. Failures block only the work they invalidate. Integration still requires focused local checks and review; installed support claims require the corresponding installed observations. No task becomes complete merely because its remaining scope moved to a follow-up.

Before #1434 closes, reconcile this matrix with the final candidate, audit the author/consumer and generated-package wording, and record the owners and acceptance tests for each remaining #1220 requirement. This checkpoint does not close #1220 or start the resource/callback implementation phase.
