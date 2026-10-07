# Refinement closure audit, 7 October 2026

Source baseline: `7f7bd65104050efddd328377389072f4c4272ac0`. VO #1434 tracks this audit. This is a source and inventory review, not a new installed acceptance record.

## Recorded coverage and remaining work

The [inventory](../type-surface.v1.json) records each source path, position and installed observation separately. The table below first summarized it at the baseline above. It was refreshed against `ba70845b51bf1bea267def314b405c5d32b4df37`, separating three things: cells the inventory promotes, host reports archived in Git that the inventory does not yet cite, and remaining work. An archived local report is not an installed support claim.

| Area | Inventory installed coverage | Archived, not yet promoted | Remaining work |
| --- | --- | --- | --- |
| Fin parameters and results | Ordinary source: Node JavaScript/TypeScript; browser page, React and worker profiles; C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI. Reviewed IR: C and C++. | Reviewed-IR container and alias Fin reports for Python, Rust, .NET, Java, Kotlin, native PHP, Ruby and WIT/WASI (`reviewed-fin-hosts-20261007/`). | Perl has no promoted Fin cell; it awaits the CI Perl reports. Native structural checks cover Array, List and Option only; Prod and Except are VO #1441. |
| Fin nominal fields | Ordinary-source Node JavaScript/TypeScript, including the recorded alias and finite recursive cases. | None. | Native and browser field acceptance; see the design notes in #board 1378. |
| Fin callback positions | Ordinary-source Node JavaScript/TypeScript. | None. | Native callback and closure checks need their own ABI and lifetime acceptance. Browser parameter and result evidence does not cover callbacks. |
| Checked Subtype | Top-level primitive-base parameters and results for Node, browser, C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI. | None. | Perl awaits CI. Nested, nominal and reviewed-IR Subtype positions are not admitted. |
| Finite function specializations | Ordinary source: Node JavaScript/TypeScript, Perl (earlier fixture), Python, C, C++, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI. | Specialized-record fixture runs for managed hosts, Perl and the remaining hosts are in progress under #1439. | The shared Perl fixture needs its CI report. Reviewed-IR specializations are not admitted. |
| Closed generic records | Ordinary-source npm (Node JavaScript and strict TypeScript), C and C++. The generic signature cells of those groups cite `npm-generic-records-installed` and `native-generic-records-c-cpp-installed`. | Rust, Python 3.11 and 3.12, four Perl ABIs, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI (`generic-record-hosts-20261007/`). The Python and Perl reports ran locally with a lowered glibc floor. | Promote the archived hosts from their reports, with CI reports for Python and Perl. Browser, PHP-Wasm and reviewed-IR generic records, and recursive, indexed, inherited and refined generic records, remain original #1220 work. |
| Reviewed-IR refinements and constructed generics | Fin at C and C++ parameters and results (`reviewed-native-fin-c-cpp-installed`, `reviewed-native-fin-containers-c-cpp-installed`). | Container and alias Fin for the eight hosts above. | Reviewed Subtype constructors, reviewed specializations and reviewed generic-structure instantiations are not admitted. |
| PHP-Wasm refinements | No positive refinement acceptance. | None. | Keep this gap visible and distinct from native PHP. |

Alias identity and provenance are separate from each host's assignment rules. Each alias names its own host record type and carries its origin in the Binding IR. Distinct identity is not distinct assignability. JavaScript and TypeScript records are structural, so `NatBox` and `NatBoxAgain` with the same fields are mutually assignable there. Only the Rust and managed-host compiler-negative reports observe rejection of one alias where another is expected.

The specialization evidence groups are C/C++, Python, Rust, Ruby, .NET, Java/Kotlin, native PHP and WIT/WASI, besides Node and the earlier Perl fixture. The earlier `perl-finite-specializations-ordinary-source` observation remains valid; a pending shared-fixture report does not erase it.

## Source constraints

- [NativeExports.lean](../../src/analyze/NativeExports.lean) extracts closed Fin bounds and validates checked Subtype constructors. Its record path rejects indexed and inherited records. A closed application of a generic structure becomes a record only through an abbrev that names it: `Pair Word String` written directly in a signature, or as an argument of another instantiation, is rejected. Established structural constructors (`Array`, `Prod`, `Fin`, `Subtype`) keep their own mappings, and an argument carrying a resource, callback or refinement anywhere inside it is rejected.
- [native-types.mjs](../../src/analyze/native-types.mjs) and [native-model.mjs](../../src/build/native-model.mjs) retain native refinement-position restrictions. Existing C traversal code for pairs/results is insufficient to admit those shapes through extraction, metadata validation, documentation and Perl generation.
- [semantic-model.mjs](../../src/analyze/semantic-model.mjs) compares nominal definitions by name and immediate edges, including the compiler-owned generic provenance, so two definitions of one alias with different origins conflict.
- [native-model.mjs](../../src/build/native-model.mjs) renders named Lean types with an absolute-name prefix. Generic records keep the verified alias as both identity and Lean spelling, and the applied type text never replaces the identifier contract.
- [reviewed-source.mjs](../../src/analyze/reviewed-source.mjs) keeps export decisions in reviewed Binding IR and rejects competing configuration specializations/contracts. It admits only Fin decisions in the refinements extension of a declaration and the nominal-refinements extension of an alias, compares them exactly with fresh elaboration, and rejects every other source extension. Adding an ordinary-source refinement extension does not authorize a reviewed build.

## Reviewed-IR design requirements

VO #1438 settled this for Fin: the reviewed declaration's refinements extension, or an alias's nominal-refinements extension, carries the exact bounds, and fresh elaboration must produce the same tree. The next design must identify the reviewed field that authorizes each Subtype constructor, finite specialization or generic-structure instantiation. Fresh Lean elaboration must verify the selected declaration, source closure, concrete arguments and instantiated type. A constructor must still accept the exact base type and return `Option` of the exact subtype.

Test mismatched bounds, substituted constructors, changed source modules, fabricated specialization applications and conflicting nominal identities. Preserve source-located rejection diagnostics and authenticate the same facts in package receipts. Do not admit a mapping by trusting user-authored provenance or dropping a constraint during transport lowering.

## Remaining rows and owners

| Row | Owner | Next task or decision |
| --- | --- | --- |
| Perl Fin, Subtype, containers and the shared specialization fixture | Codex | Promote from the CI Perl reports for the integrated candidate. |
| Generic records on the nine remaining native hosts | Codex | Promote the archived #1439 reports, with CI reports for Python and Perl. |
| Native Fin inside Prod and Except | Claude | VO #1441, a bounded slice: extractor, validator, model tree, bound paths, Perl and WIT walkers. |
| Native refined record and variant fields | Unassigned | Design notes in #board 1378; not started. |
| Native callback and closure refinements | Unassigned | Separate ABI and lifetime work, coordinated with #1221. |
| Reviewed-IR Subtype, specializations and generic instantiations | Unassigned | Design first, as above. |
| Browser, PHP-Wasm and reviewed-IR generic records; recursive, indexed, inherited and refined generic records | Unassigned | Original #1220 requirements; not covered by the native rollout. |
| PHP-Wasm refinements | Unassigned | Visible unsupported path. |

## Sprint handoff

Claude implemented #1433's generic records; Codex reviewed and integrated them and carried the native-host rollout in #1439. The Perl indexed-message milestone is separately reviewable at `6c06fa6`; it does not add installed support claims. CI evidence remains tied to the revision that actually ran.

Feature development continues while unrelated CI jobs run. Failures block only the work they invalidate. Integration still requires focused local checks and review; installed support claims require the corresponding installed observations. No task becomes complete merely because its remaining scope moved to a follow-up.

Before #1434 closes, reconcile this matrix with the final candidate, audit the author/consumer and generated-package wording, and record the owners and acceptance tests for each remaining #1220 requirement. This checkpoint does not close #1220 or start the resource/callback implementation phase.
