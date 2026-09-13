# Elaborated export metadata

The [version-2 metadata schema](../../schema/elaborated-export-metadata.schema.json) connects the Lean-side extractor to JavaScript Binding IR projection. Public `lean-bridge analyze` and ordinary npm builds use this report for captured and generated public modules, with or without a Lake lockfile. Explicit reviewed Binding IR retains its existing validation and build-profile gates.

## Compiler report

`NativeExports.lean --metadata` imports freshly compiled interfaces and reads Lean's environment. Each selected root module reports its definitions, opaque declarations, abbreviations and theorems. Private and protected declarations retain their visibility; compiler-generated helpers and projections are excluded. Dependency modules retain their source and interface identities without becoming public export roots.

Each declaration records its fully qualified identity, selection status, documentation, source range, elaborated binders, result expression and runtime projection. Source lines start at 1. Columns count UTF-16 code units from 0. Lean's range may include the documentation comment. A missing range on a selected export produces an extractor error.

The printed expressions support inspection. Binding IR copies the structural types from `projection.parameters` and `projection.result`; JavaScript never parses the printed type strings. Lean resolves aliases and inferred types before assigning those runtime types.

The `component-scalars-v1` profile supports pure functions with zero to 32 explicit primitive arguments. It retains the existing npm scalar types. Implicit, instance, dependent, generic, effectful and nonprimitive signatures receive distinct unsupported reasons. Explicit selections of proof-only or type-valued declarations fail; automatic discovery omits them. Selected implementations also pass the existing unsafe, foreign-call and admitted-proof checks. Duplicate unqualified host names require an export-selection or wrapper decision.

The effects field identifies a returned `IO`, `EIO`, `BaseIO`, `Task` or `ST` action, including aliases. An IO-typed parameter or an array of IO values does not make the function itself effectful. Those types still fail the primitive projection.

## Source and interface identity

The engine hashes the source, compiler, extractor and complete interface set. Each interface identity covers the `.olean` file and any `.olean.private` and `.olean.server` sidecars, including their presence, sizes and bytes. Existing project `.ilean` files supply no metadata. Extraction does not enable package initializers.

Producer identity binds the adapter version, actual Lean version, selected toolchain and measured invocation inputs. The report sorts modules, imports, declarations, effects, theorem references and diagnostics. The enclosing [version-3 elaboration record](../../schema/lake-entry-elaboration.schema.json) binds the source snapshot, optional generated-source handoff, request and report. Its identity is SHA-256 over canonical UTF-8 JSON.

The engine validates the report against its own request and checks source, compiler, extractor and interface identities again after extraction. Target compilation must reproduce the complete record from fresh interfaces before linking. Changed bytes or sidecar presence stop the build. The bundle stores the record at `metadata/lake-entry-exports.json`.

## Diagnostics and theorem references

Report diagnostics distinguish `unsupported-meaning`, `extractor-failure` and `stale-metadata`. Unsupported declarations require an author decision. Extraction faults and stale metadata prevent Binding IR release. Failed extractor execution and malformed JSON produce `lean-metadata-extractor-failed`; target record mismatch produces `lean-entry-elaboration-drift`. These errors retain their compiler context and clean up owned staging.

`theoremReferences` lists theorems in the compiled project closure whose elaborated statement directly uses the declaration. A similar name, comment or string does not create a relationship. This list supplies navigation metadata; Binding IR assurance arrays remain empty. Artifact-bound theorem claims require separate verification and review.

## Public analysis operation

`lean-bridge analyze` captures the original source and executes a version-3 engine request through the pinned Nix or Docker backend. The request accepts source intent and denies host-supplied semantic metadata or adapters. Its authorized output contains only `project-analysis.json` and an execution report binding the request, engine, source closure, backend and report hash.

The [version-2 public report](../../schema/project-analysis.schema.json) embeds the complete elaboration record. The host validates its invocation identity, captured source hashes, selected roots, structural metadata and Binding IR projection before releasing it. It checks the original checkout and transported inputs again after execution. Temporary compiler files stay outside the author's tree.

A dependency-free project without `lake-manifest.json` uses snapshot version 3, which binds the lockfile's absence. Lake rejects external dependencies until the author supplies a reviewed lock. Locked sources continue to use snapshot version 2. Configured generators execute from the captured locked inputs before extraction; analysis does not compile consumer adapters or link packages.

Unsupported meaning returns a reviewable report and exit status 2. Extractor faults or stale metadata return failure, never a source-scanned fallback. An explicit reviewed Binding IR bypasses compilation and reports `existing-validated`, with no fresh compiler evidence. `requireCompiledExports` accepts only fresh compiler-backed exports.

The [metadata milestone evidence](../evidence/elaborated-export-metadata-20260913.md) records interface drift and installed-package checks. The [CLI cutover evidence](../evidence/compiler-analysis-20260913.md) covers engine-backed analysis, lock-absent capture, generated entries, relocation and failure cleanup. The [npm cutover evidence](../evidence/unlocked-npm-compiler-20260913.md) covers compiler-owned builds and reproducible publication without a lockfile; external dependencies and configured generators still require a reviewed lock. Native CPAN retains its existing metadata profile. VO1107 and VO1108 still include native shared projection and finite specialization.
