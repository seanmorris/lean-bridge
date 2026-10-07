# Refinement closure audit, 7 October 2026

Source baseline: `7f7bd65104050efddd328377389072f4c4272ac0`. VO #1434 tracks this audit. This is a source and inventory review, not a new installed acceptance record.

## Recorded coverage and remaining work

The [inventory](../type-surface.v1.json) records each source path, position and installed observation separately. This refresh uses `88dfd1074f6edc0a6bb6848d66ea0948a6715e61`. The table distinguishes promoted inventory cells from archived installed runs awaiting promotion. Local executions establish the environment recorded in their receipts; they do not establish a hosted CI result or a different runtime floor.

| Area | Inventory installed coverage | Archived, not yet promoted | Remaining work |
| --- | --- | --- | --- |
| Fin parameters and results | Ordinary source: Node JavaScript/TypeScript; browser page, React and worker profiles; C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI. Reviewed IR: C and C++. | Reviewed scalar and Array/List/Option/alias runs now cover the remaining native hosts, including four Perl ABIs. See the receipts below. | Promote only the verified source/host/position combinations. Perl has no promoted Fin cell. Execute the new ordinary/reviewed npm and browser gates; release-floor CI remains separate. |
| Fin inside products and Except | No separate product promotion. | Ordinary and reviewed C/C++ [product reports](native-fin-products-20261007/receipt.json) and [Array-of-product reports](native-fin-product-arrays-20261007/receipt.json). The latter also archives all five product mismatch checks, including the nominal alias bound. | VO #1441: other native hosts, both Python floors and four Perl ABIs. Array reports verify public rejection and input immutability but do not measure source or raw-adapter dispatch; add that observation separately. |
| Fin nominal fields | Ordinary-source Node JavaScript/TypeScript, including the recorded alias and finite recursive cases. | None. | Claude owns native record and variant fields in VO #1442. Ordinary-source checked conversion comes first, reviewed nominal reconciliation second. Browser acceptance remains open. |
| Fin callback positions | Ordinary-source Node JavaScript/TypeScript. | None. | Native callback and closure checks need their own ABI and lifetime acceptance. Browser parameter and result evidence does not cover callbacks. |
| Checked Subtype | Top-level primitive-base parameters and results for Node, browser, C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI. | None. | Perl awaits CI. Nested, nominal and reviewed-IR Subtype positions are not admitted. |
| Finite function specializations | Ordinary source: Node JavaScript/strict TypeScript and all eleven native profiles. The shared specialized-record fixture includes Python 3.11/3.12 and four Perl ABIs. | The [specialized-record receipt](generic-record-specializations-20261007/receipt.json) is now cited by `generic-record-specialized-*-installed` evidence. | CI on the integrated revision; reviewed-IR specializations are not admitted. |
| Closed generic records | Ordinary-source npm and all eleven native profiles, including the direct exports and nine configured specializations in the shared fixture. The promotion and twelve consumer tables are committed through `433814e`. | The earlier direct-record archives remain intact; the newer specialized-record receipt supplies the promoted combined fixture. | Browser, PHP-Wasm and reviewed-IR generic records, and recursive, indexed, inherited and refined generic records, remain original #1220 work. Original Array-field acceptance also needs explicit audit coverage. |
| Reviewed-IR refinements and constructed generics | Fin at C and C++ parameters and results (`reviewed-native-fin-c-cpp-installed`, `reviewed-native-fin-containers-c-cpp-installed`). | Scalar and container Fin on the other native hosts; product Fin on C/C++. | Reviewed nominal Fin is #1442 milestone two. Reviewed Subtype constructors, specializations and generic-structure instantiations are not admitted. |
| PHP-Wasm refinements | No positive refinement acceptance. | None. | Keep this gap visible and distinct from native PHP. |

Alias identity and provenance are separate from each host's assignment rules. Each alias names its own host record type and carries its origin in the Binding IR. Distinct identity is not distinct assignability. JavaScript and TypeScript records are structural, so `NatBox` and `NatBoxAgain` with the same fields are mutually assignable there. Only the Rust and managed-host compiler-negative reports observe rejection of one alias where another is expected.

The specialization evidence groups are C/C++, Python, Rust, Ruby, .NET, Java/Kotlin, native PHP, WIT/WASI, Node and Perl. The earlier `perl-finite-specializations-ordinary-source` observation remains valid alongside the four newer shared-fixture ABI reports.

### Archived reviewed Fin runs

- [Python and Rust scalar](reviewed-scalar-hosts-20261007/receipt.json): Python 3.11 and 3.12 each execute 2032 checks; Rust executes 2021.
- [Managed, PHP, Ruby and WIT scalar](reviewed-scalar-rollout-20261007/receipt.json): five gates cover six hosts. The original failed Perl invocation is retained; it omitted the separate CPAN runtime-floor override.
- [Perl scalar](reviewed-perl-scalar-20261007/receipt.json): corrected runs execute 2024 checks on each of four ABIs, with observed source-dispatch controls.
- [Native containers and aliases](reviewed-fin-hosts-20261007/receipt.json): Python, Rust, .NET, Java, Kotlin, native PHP, Ruby and WIT/WASI.
- [Perl containers and aliases](reviewed-perl-containers-20261007/receipt.json): four ABIs each execute 2027 checks. The corrected probe observes `orDefault`, because Lean inlines `countNone`. Nonzero positive controls remain required; the first failed probe log is retained.

These receipts preserve two-root package reproduction and source-free installed execution. Their scope does not imply Subtype, refined nominal fields, callbacks or PHP-Wasm acceptance. Private host libraries without source counters retain `observed: false`.

## Source constraints

- [NativeExports.lean](../../src/analyze/NativeExports.lean) extracts closed Fin bounds and validates checked Subtype constructors. Its record path rejects indexed and inherited records. A closed application of a generic structure becomes a record only through an abbrev that names it: `Pair Word String` written directly in a signature, or as an argument of another instantiation, is rejected. Established structural constructors (`Array`, `Prod`, `Fin`, `Subtype`) keep their own mappings, and an argument carrying a resource, callback or refinement anywhere inside it is rejected.
- [native-types.mjs](../../src/analyze/native-types.mjs) and [native-model.mjs](../../src/build/native-model.mjs) admit Fin at top-level sites and inside Array, List, Option, Prod and Except, including nested combinations. Native nominal fields and callback-bearing signatures still reject refinements at this checkpoint. Checked Subtype remains limited to top-level primitive-base sites. Implementation admission does not replace each host's installed acceptance.
- [semantic-model.mjs](../../src/analyze/semantic-model.mjs) compares nominal definitions by name and immediate edges, including the compiler-owned generic provenance, so two definitions of one alias with different origins conflict.
- [native-model.mjs](../../src/build/native-model.mjs) renders named Lean types with an absolute-name prefix. Generic records keep the verified alias as both identity and Lean spelling, and the applied type text never replaces the identifier contract.
- [reviewed-source.mjs](../../src/analyze/reviewed-source.mjs) keeps export decisions in reviewed Binding IR and rejects competing configuration specializations/contracts. It admits only Fin decisions in the refinements extension of a declaration and the nominal-refinements extension of an alias, compares them exactly with fresh elaboration, and rejects every other source extension. Adding an ordinary-source refinement extension does not authorize a reviewed build.

## Reviewed-IR design requirements

VO #1438 settled this for Fin: the reviewed declaration's refinements extension, or an alias's nominal-refinements extension, carries the exact bounds, and fresh elaboration must produce the same tree. The next design must identify the reviewed field that authorizes each Subtype constructor, finite specialization or generic-structure instantiation. Fresh Lean elaboration must verify the selected declaration, source closure, concrete arguments and instantiated type. A constructor must still accept the exact base type and return `Option` of the exact subtype.

Test mismatched bounds, substituted constructors, changed source modules, fabricated specialization applications and conflicting nominal identities. Preserve source-located rejection diagnostics and authenticate the same facts in package receipts. Do not admit a mapping by trusting user-authored provenance or dropping a constraint during transport lowering.

## Remaining rows and owners

| Row | Owner | Next task or decision |
| --- | --- | --- |
| Perl ordinary Fin, Subtype and containers | Codex | Obtain release-floor CI reports and reconcile exact source/position claims. Reviewed scalar/container local receipts do not substitute for ordinary Subtype results. |
| Reviewed Fin scalar/container promotion and npm/browser execution | Codex | Promote from the committed receipts, then run the new npm gate's four selections, strict TypeScript and all three browser engines. |
| Generic records and function specializations | Codex | Promotion and twelve consumer tables are committed. Check integrated CI; retain the remaining generic-shape requirements below. |
| Native Fin inside Prod, Except and Array of products | Claude, Codex integration | VO #1441 implementation and C/C++ archives are integrated. Finish other host executions and add measured Array dispatch. All five product fresh-Lean mismatches now pass. |
| Native refined record and variant fields | Claude | VO #1442: checked erased mirrors, caller-input bounds, active-case checks, absent/inactive Fin 0, cleanup and input immutability; reviewed nominal reconciliation follows ordinary acceptance. |
| Native callback and closure refinements | Unassigned | Separate ABI and lifetime work, coordinated with #1221. |
| Reviewed-IR Subtype, specializations and generic instantiations | Unassigned | Design first, as above. |
| Browser, PHP-Wasm and reviewed-IR generic records; recursive, indexed, inherited and refined generic records | Unassigned | Original #1220 requirements; not covered by the native rollout. |
| PHP-Wasm refinements | Unassigned | Visible unsupported path. |

## Sprint handoff

Claude implemented #1433's generic records; Codex integrated the native-host rollout and specialized-record promotion in #1439. Claude's Array-of-product milestone `faac75b` is integrated, including immediate rejected-input snapshots and a mutation negative control. Claude now owns #1442 in a separate worktree. CI evidence remains tied to the revision that actually ran.

The full core run on `433814e` passed 3272 tests with 859 gated skips. The later `88dfd10` integration passed 132 focused tests with 18 gated skips, plus full lint and type checking. It adds bounded apt waits and mandatory ordinary/reviewed Fin npm/browser gates. Those gated checks have not yet produced installed npm/browser evidence; the earlier core result does not cover the later commit.

Feature development continues while unrelated CI jobs run. Failures block only the work they invalidate. Integration still requires focused local checks and review; installed support claims require the corresponding installed observations. No task becomes complete merely because its remaining scope moved to a follow-up.

Before #1434 closes, reconcile this matrix with the final candidate, audit the author/consumer and generated-package wording, and record the owners and acceptance tests for each remaining #1220 requirement. This checkpoint does not close #1220 or start the resource/callback implementation phase.
