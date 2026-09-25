# Elaborated export metadata

The [version-2 metadata schema](../../schema/elaborated-export-metadata.schema.json) connects the Lean-side extractor to Binding IR projection. Public `lean-bridge analyze`, ordinary npm builds and native CPAN builds use this report for captured and generated public modules. Explicit reviewed Binding IR has a compiler-free analysis path and a separate [compiler-checked build path](../lean/existing-package.md#compile-a-reviewed-contract).

Reviewed builds retain the exact document as `reviewedBindingIr`. Its hash joins the source, interface, compiler and extractor identities in the invocation digest. Native and PHP-Wasm models reconcile the review through their retained source identity. npm's version-3 source intent carries the review into the isolated engine, and its elaboration record retains it for target compilation and package verification. Reviewed names and types cannot replace compiler-owned facts; supported documentation and argument names survive reconciliation.

## Compiler report

`NativeExports.lean --metadata` imports freshly compiled interfaces and reads Lean's environment. Each selected root module reports its definitions, opaque declarations, abbreviations and theorems. Private and protected declarations retain their visibility; compiler-generated helpers and projections are excluded. Dependency modules retain their source and interface identities without becoming public export roots.

Each declaration records its fully qualified identity, selection status, documentation, source range, elaborated binders, result expression and runtime projection. Source lines start at 1. Columns count UTF-16 code units from 0. Lean's range may include the documentation comment. A missing range on a selected export produces an extractor error.

The printed expressions support inspection. Binding IR copies the structural types from `projection.parameters` and `projection.result`; JavaScript never parses the printed type strings. Lean resolves aliases and inferred types before assigning those runtime types.

Concrete copied aliases retain named targets and chains. Function aliases keep
the callback contract and its borrow/lease ownership; configured resource aliases
keep the resource contract. Primitive callable payloads use their checked target
representation after alias validation. Definition, cycle and nesting checks run
before normalization. A callback or resource hidden inside a copied alias,
container or record still requires an explicit retention or ownership policy.
The [callable alias regression checks](../evidence/callable-alias-repair-20260921.md)
cover both compiler profiles and installed Perl specializations.

The extractor also describes concrete user-defined variants.
Both profiles retain constructor order, names and typed fields; the native
profile additionally records each qualified constructor and the compiler's C
representation. Empty constructors remain separate cases. Named fields retain
their names; arrow-only fields receive positional names such as `arg0`. If a
declared name collides, the generated name gains underscores until it is unique.
No internal hygienic name enters the public type graph. Semantic lowering rejects
conflicting definitions for the same nominal identity, and reviewed contracts
must match constructor order and field types exactly.

Concrete non-recursive variants have installed-package coverage across all
seventeen consumer profiles. npm uses private ABI 7 and typed Lean adapters;
native packages use their checked copied-value adapters. Generic/indexed,
proof-bearing and identity-containing variants still require further contracts.

[Recursive copied metadata](../evidence/recursive-copied-metadata-20260922.md)
uses a finite `graph` wrapper with a root and nominal definition table. A
`reference` names its definition without unfolding it. Native references retain
the same compiler ABI as the named definition. Small acyclic types keep their
inline representation; long chains and shared graphs have bounded expansion.
Semantic lowering authenticates every definition, including types used both
inline and in graphs. [Typed recursive transport](../evidence/recursive-copied-adapters-20260922.md)
executes in native helper and Wasm walker checks. Compiler package admission,
public runtime integration and installed recursive packages remain open.

The historically named `component-scalars-v1` profile supports zero to 32 explicit arguments. Compiled npm parameters and results can contain primitives, nested Array and List values, copied records and variants, including bounded recursive values, aliases, Option, Except and nested binary products. Callbacks and returned functions accept one to sixteen arguments and a result using primitives or these copied-value shapes. `arities` identifies the outer argument count for an export returning a function. Scalar-only packages retain private ABI 2; primitive-only callable packages use ABI 3, array-only packages ABI 4 and record packages ABI 5. Packages with Option, Except or products use ABI 6, with a nominal record table that may be empty; aliases and variants use ABI 7. Recursive copied packages use ABI 8; packages combining copied values with callables use ABI 9 over the recursive copied-value wire and the shared callable registry. Lean constructs and inspects every branch and field through typed helpers; C never guesses constructor layouts. Result arguments use canonical [success, error] order. Callback and resource identities cannot occur inside copied containers. Copied values and synchronous callables can share one component. Unresolved implicit, instance, dependent, generic, asynchronous and other unimplemented signatures receive unsupported reasons. Explicit selections of proof-only or type-valued declarations fail; automatic discovery omits them. Selected implementations also pass the existing unsafe, foreign-call and admitted-proof checks. Duplicate unqualified host names require an export-selection or wrapper decision.

Configured [finite specializations](../lean/existing-package.md#export-concrete-specializations) bind one to eight leading type parameters to named closed types. Lean resolves their universe levels and following instance dictionaries, then checks the remaining signature against the scalar or native profile. Each specialization appears under its configured identity in the original source module, with a `specialization` record containing the original declaration, configured types and compiler-rendered application. The application is null when elaboration fails. The original declaration keeps its own unspecialized type and selection state. Source ranges, documentation and theorem references continue to refer to that original declaration.

Binding IR emits separate concrete functions and stores each application under `lean-lang.org/specialization`. Lean serializes the checked expression with absolute constant names, re-elaborates that text, and checks definitional equality to the original application. Ordinary adapter calls and primitive types also use absolute names, so declarations inside the generated namespace cannot redirect them. Unrepresentable or private dictionary terms require a monomorphic wrapper.

This path does not emit an unrestricted generic host function or alter the existing `lean-wasm.org/specializations` overload-dispatch contract. The adapter generator uses the checked application from the compiler-derived model, and target compilation reproduces the whole report before linking. Native specialization preserves the existing C ABI and type/ownership rules. Its configured arity uses the specialization's name and counts runtime arguments, excluding resolved types and dictionaries.

The effects field identifies a returned `IO`, `EIO`, `BaseIO`, `Task` or `ST` action, including aliases. An IO-typed parameter or an array of IO values does not make the function itself effectful. Those types still fail the primitive projection.

The `native-library-v1` profile retains native CPAN's primitive values, finite copied records and arrays, configured resources, callbacks and returned closures. Its `native-function` projection includes the compiler-lowered C type and boxing operations in the [native type schema](../../schema/native-metadata-type.schema.json). Configured `arities` determine where an export's arguments end and its returned closure begins. Resource selection and its source module remain part of the invocation identity. Identity-bearing values inside copied containers require an ownership or retention policy and receive `unsupported-native-type`. Public `analyze` uses the npm component profile described above; configured native resource exports require a native build.

## Source and interface identity

The compiler request carries optional `contracts` from shared source configuration, keyed by exact export or specialization name. `compilerExportSelection` sorts the keys and effect sets before hashing the request. Lean checks each selected contract after specialization, arity selection and structural type projection. Parameter counts, ownership, lifetimes and boundary effects must match the implemented adapter; checked refinement constructors remain unsupported. Unsupported source types and effects are never made supported by a contract.

Metadata validation repeats those checks against the structural projection. A mismatch produces `export-contract-mismatch`; a contract without a selected declaration requires `unused-export-contract`. Binding IR retains the author decisions in `lean-lang.org/export-contract`, separately from the compiler-derived types and empty assurance arrays. Native callback boundary labels (`host-call`, `fails`) differ from the declaration's returned-action `effects` field described above.

The engine hashes the source, compiler, extractor and complete interface set. Each interface identity covers the `.olean` file and any `.olean.private` and `.olean.server` sidecars, including their presence, sizes and bytes. Existing project `.ilean` files supply no metadata. Extraction does not enable package initializers. Specialization rehydrates only Lean's built-in class and instance indexes from imported metadata; it checks the bodies and axioms of every constant used by the resulting application, including synthesized dictionaries.

Producer identity binds the adapter version, actual Lean version, selected toolchain and measured invocation inputs. The report sorts modules, imports, declarations, effects, theorem references and diagnostics. For analysis and npm, the enclosing [version-3 elaboration record](../../schema/lake-entry-elaboration.schema.json) binds the source snapshot, optional generated-source handoff, request and report. Its identity is SHA-256 over canonical UTF-8 JSON.

The engine validates the report against its own request and checks source, compiler, extractor and interface identities again after extraction. npm target compilation must reproduce the complete record from fresh interfaces before linking. Changed bytes or sidecar presence stop the build. The npm bundle stores the record at `metadata/lake-entry-exports.json`.

Native compilation produces fresh interfaces and C together. The native receipt binds the report at `metadata.json`, source and complete interface identities, compiler, extractor, selection, generated adapters and library. The build rechecks its inputs after extraction, adapter compilation and linking, and re-extracts the report after adapter compilation to check exact agreement before linking. Native calls, types, record constructors and projections use absolute names. The C compiler compares generated prototypes against Lean's emitted definitions. CPAN staging reconstructs the native model from the retained report and rejects a mismatched model, metadata hash or source identity. It does not invoke Lean during package installation.

## Diagnostics and theorem references

Report diagnostics distinguish `unsupported-meaning`, `extractor-failure` and `stale-metadata`. Unsupported declarations require an author decision. Extraction faults and stale metadata prevent Binding IR release. Failed extractor execution and malformed JSON produce `lean-metadata-extractor-failed`; target record mismatch produces `lean-entry-elaboration-drift`. These errors retain their compiler context and clean up owned staging.

Native builds return `native-elaboration-unsupported` with the selected declarations' diagnostics and unsupported projections. Input changes during compilation return `native-elaboration-drift`. An unsupported helper outside the configured export set remains visible in metadata without preventing a supported selected API from building.

`theoremReferences` lists theorems in the compiled project closure whose elaborated statement directly uses the declaration. Specializations inherit references to the original generic declaration; the extractor does not instantiate or certify those theorems for a host binding. A similar name, comment or string does not create a relationship. This list supplies navigation metadata; Binding IR assurance arrays remain empty. Artifact-bound theorem claims require separate verification and review.

## Public analysis operation

`lean-bridge analyze` captures the original source and executes a version-3 engine request through the pinned Nix or Docker backend. The request accepts source intent and denies host-supplied semantic metadata or adapters. Its authorized output contains only `project-analysis.json` and an execution report binding the request, engine, source closure, backend and report hash.

The [version-2 public report](../../schema/project-analysis.schema.json) embeds the complete elaboration record. The host validates its invocation identity, captured source hashes, selected roots, structural metadata and Binding IR projection before releasing it. It checks the original checkout and transported inputs again after execution. Temporary compiler files stay outside the author's tree.

A dependency-free project without `lake-manifest.json` uses snapshot version 3, which binds the lockfile's absence. Lake rejects external dependencies until the author supplies a reviewed lock. Locked sources continue to use snapshot version 2. Configured generators execute from the captured locked inputs before extraction; analysis does not compile consumer adapters or link packages.

Unsupported meaning returns a reviewable report and exit status 2. Extractor faults or stale metadata return failure, never a source-scanned fallback. An explicit reviewed Binding IR bypasses compilation and reports `existing-validated`, with no fresh compiler evidence. `requireCompiledExports` accepts only fresh compiler-backed exports.

The [metadata milestone evidence](../evidence/elaborated-export-metadata-20260913.md) records interface drift and installed-package checks. The [CLI cutover evidence](../evidence/compiler-analysis-20260913.md) covers engine-backed analysis, lock-absent capture, generated entries, relocation and failure cleanup. The [npm cutover evidence](../evidence/unlocked-npm-compiler-20260913.md) covers compiler-owned builds and reproducible publication without a lockfile; external dependencies and configured generators still require a reviewed lock. The [native cutover evidence](../evidence/native-shared-metadata-20260913.md) covers the CPAN projection and its installed regressions. The [finite specialization evidence](../evidence/finite-specialization-20260914.md) covers concrete npm exports, instance resolution, namespace shadowing and installed execution. The [native specialization evidence](../evidence/native-finite-specialization-20260914.md) covers CPAN installation, configured closure arities, resource and callback behavior, and pre-link report comparison.
