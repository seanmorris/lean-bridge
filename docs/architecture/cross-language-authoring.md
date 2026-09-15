# Complete cross-language authoring

Virtual Office plan 1208 owns the full type and authoring implementation. The completion contract covers all 48 source forms, all 17 existing consumer profiles, both ordinary-source and reviewed-IR paths, and each applicable argument, result, field, and callback position in [the type inventory](../type-surface.v1.json).

Stages can finish independently. Plan 1208 stays open until every required cell passes analysis, generation, compilation, packaging, and installed execution. Proof-only cells require explicit erasure checks. New exclusions do not count as completing the approved work.

## Stages

| Stage | Virtual Office tasks | Acceptance |
| --- | --- | --- |
| Inventory and evidence | 1213, 1214; reuse 1215 | Classify every profile, shape, position, and Binding IR facet. Separate inspected, generated, compiled, packaged, and installed evidence. |
| Shared author configuration | 1238 | Share source selection and author decisions across npm and native builds, reject unimplemented choices, and preserve installed behavior. |
| Locked dependencies and elaboration | 1239, 1107, 1108 | Resolve pinned external and hashed local dependencies in isolated staging. Bind source, compiler, dependency, and interface identities; reject drift. |
| Generic compilation and corpus | 1216, 1217 | Compile unrelated ordinary projects once per compatible ABI/toolchain profile. Generate every target's adapters without Alpha-specific assumptions. |
| Exact scalars | 1218 | Preserve integer widths and arbitrary precision, text and bytes, Char, platform-sized integers, and floating-point behavior in every applicable position. |
| Structured values | 1219 | Preserve arrays, lists, tuples, records, aliases, variants, recursive copied values, nested Option, and Except branches. |
| Specialization and checked values | 1220 | Resolve finite generics, implicit and instance arguments, refinements, defaults, nulls, and proof erasure without dropping runtime constraints. |
| Identity and callbacks | 1221; reuse 1237 | Cover resources, host objects, mutation, ownership, callbacks, closures, disposal, reentry, and cross-component identity. |
| Effects and async | 1222, then 1223 | Preserve declared errors and effect order; generate asynchronous delivery, cancellation, iteration, and cleanup. |
| Packages and verification | 1240, 1224 | Produce native ecosystem packages and generic local receipts, verify exact installed archives, and retain signed-receipt compatibility. |
| Documentation and acceptance | 1227, 1225, 1226 | Execute documentation examples, pass the complete matrix and latency/throughput thresholds, and reconcile every remaining gap. |

## Shared configuration and Perl cutover

`lean-bridge.exports.json` holds language-neutral author intent. Module and export selection apply before host-language projection. Package-specific names and versions belong under canonical target keys. Machine paths and credentials stay outside source configuration.

The shared configuration supplies `modules`, `exports`, `specializations`, `contracts`, `resources`, `arities`, and target metadata validation. Source analysis and builds hash the configuration. npm and CPAN implement finite specialization within their existing type profiles; CPAN also implements resources, closure arities, and its module/version settings. npm packaging and publication use the sealed settings while preserving the compiled Lean identity. Other configured target settings fail when their projection does not implement them.

[Export contracts](../lean/existing-package.md#declare-export-contracts) now express ownership, lifetime, refinement and boundary-effect requirements for exact exports. Lean checks those constraints against compiled signatures; the request identity, metadata validators, target re-extraction and package model retain them. Current adapters enforce copied values, native call-scoped borrowing, returned leases and synchronous callback effects. Unsupported transfers, anchored lifetimes, checked constructors and async choices fail. Their runtime implementations remain in tasks 1220, 1221, 1222 and 1223; configuration does not complete those tasks.

The [contract acceptance record](../evidence/export-contracts-20260914.md) covers installed npm/CPAN packages, relocated builds, contract tampering, pre-link rejection and unchanged source inputs.

Perl uses the [shared configuration](../lean/existing-package.md#configure-exports). Native compilation, generated XS, the shared runtime, CPAN archives, and supplied-XS installation remain in use.

Public analysis, ordinary npm builds and native CPAN use fresh elaboration through the shared compiler report, including projects without a Lake lockfile. Explicit reviewed Binding IR keeps its separate validation path. Native projections retain their compiler-checked C representations, resource selection and closure arities. Both build profiles accept [named concrete specializations](../lean/existing-package.md#export-concrete-specializations) with compiler-resolved type arguments and instance dictionaries. Public analysis retains the scalar profile. Configuration support does not enable additional source targets.

## Shared semantic model and combined builds

Task 1216's first adapter slice uses one compiler-metadata lowering function for scalar and native Binding IR. Source declarations retain Lean names; the Perl projection applies its own namespace validation and snake-case names. Native representations stay in the native adapter model. Callback type identities describe their semantic signatures, without including native boxing or C layout.

The [combined npm/CPAN build](../publish/npm.md#build-npm-and-cpan-together) passes the same immutable Lake snapshot to both compiler profiles. It compares the resulting source API while retaining each profile's complete Binding IR, source positions, compiler evidence and artifact hashes. Source/API identity includes contracts, specializations and theorem references. It excludes source positions and producer hashes, which remain bound by the individual profile evidence.

The native adapter model is now version 2 because its canonical declaration names and semantic type identities changed. Binding IR remains version 3; native ABI 1 and scalar ABI 2 are unchanged. CPAN staging reconstructs the model from compiler metadata and rejects stale models. Existing Perl call names are unchanged.

The combined builder compiles each profile once and stages its archives privately. Source drift, mismatched APIs, failure or cancellation prevents the final directory from appearing. Ordinary builds accept npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI and Cargo together when every selected profile admits the API. C/C++, C#, Java/Kotlin, Ruby, WIT, Python and Rust support all 16 copied primitives, arrays and acyclic records in concrete, pure function signatures. These targets reuse the compiled native component; generated record accessors keep its object layout private. C#, Java, Ruby, Python and Rust wrap the shared C adapter with private scoped conversions. NuGet and Maven contain compiled managed code; RubyGems and PyPI contain host-language sources and compiled native libraries without an extension build. Arrays and records can share one native build with CPAN but cannot yet target npm. Resources and callbacks still require CPAN-only builds.

The [ordinary WIT adapter](../evidence/native-wit-20260914.md) generates a native import interface, canonical-ABI forwarding component and public function interface. Its Wasmtime embedding library converts copied values through the same C adapter and automatically loads the shared Lean runtime. Canonical scratch memory resets after successful calls; trapped stores are replaced before reuse. The prepared archive includes the pinned Wasmtime C API and dependency licenses. It requires the packaged native host rather than an arbitrary WASI command runner. Other profile/type gaps, the shared corpus (1217) and generic package-set receipts (1240) remain open.

The [ordinary Python adapter](../evidence/native-python-20260915.md) generates source-named functions, type stubs and frozen dataclasses in deterministic platform wheels. Consumers use exact Python integers and owned copied values. A synchronized in-memory loader verifies bundled library hashes and shares one compatible runtime across independently installed wheels. No shared installed file is owned by multiple distributions.

The [ordinary Rust adapter](../evidence/native-rust-20260915.md) generates borrowed inputs, owned results, exact big integers and private RAII conversions. Checked crates embed compiled libraries in downstream binaries. A locked process registry coordinates compatible independently generated crates; temporary library files are removed after loading. Cargo compiles the generated Rust, not Lean or a C extension. PHP, wider type coverage, the shared corpus and generic receipts remain open under the stages above.

The [shared-model acceptance record](../evidence/shared-model-multi-profile-20260914.md) covers relocated builds, both installed languages, failed-build cleanup and existing native/npm regressions.

## Locked dependency milestones

Task 1239 now has an offline input snapshotter for the flat package list in `lake-manifest.json`, including inherited entries. It verifies cached Git files against full pinned commits and hashes local package files, native sources, and data. Snapshot identities survive relocation. Capture leaves projects and locks unchanged; writing uses the captured bytes in a new staging directory outside the input projects.

The [snapshot contract](../../schema/lake-dependency-snapshot.schema.json) records the root lock, selected toolchain, package sources, executable modes, and file hashes. The snapshotter rejects changed Git inputs, symlinks, submodules, missing declared files, package overrides, and mismatched toolchains. It neither fetches dependencies nor runs Lake configuration, Git filters, or package hooks.

The native/CPAN builder now uses a version-2 snapshot that also captures the root project's files. A shared Lean/Lake resolver evaluates captured configurations in private staging and resolves the selected modules through Lake and Lean's import parser. The native compiler builds the resolved pure-Lean dependency closure from source, then checks exports through fresh interfaces. Receipts bind the snapshot, resolution, compiler, Lake library, and interface hashes. Two unrelated projects produce identical receipts and CPAN archives after relocation, and their installed Perl APIs run correctly. See the [native dependency milestone evidence](../evidence/lake-native-workspace-20260911.md).

The npm/WASM engine now accepts transported snapshots against the digest in its build plan. Planning requires Node and Git, without a host Lean compiler. The engine uses the same Lake resolver, compiles the captured dependency closure, and binds its resolved order and fresh interface hashes into the target-C manifest. The linker checks that evidence before invoking Emscripten. Bundles retain the captured source closure. Two unrelated projects produce identical npm archives from relocated inputs and run through installed JavaScript APIs after their original source paths become unavailable. The publication dry run transfers the snapshot into both clean root checkouts and rejects dependency drift before authorizing the candidate. See the [npm dependency milestone evidence](../evidence/lake-wasm-workspace-20260911.md).

Root package and library `srcDir` layouts now work with explicit module selection. Host planning records a unique provisional source path for each selected module; Lake must confirm that exact ownership during compilation. Both package formats, nested modules, relocated installed npm/CPAN packages, and publication dry runs have [custom-layout acceptance evidence](../evidence/lake-root-layouts-20260911.md).

Lake `input_file` C sources referenced by `moreLinkObjs` now compile for native and WASM profiles. Resolution binds each input to its owning package and captured source. The compiler reports its complete include closure, including system headers; the builder checks source, header, compiler, and object identities before releasing output. Relocated npm/CPAN builds and their installed consumers have [C-input acceptance evidence](../evidence/lake-c-inputs-20260911.md). The existing implementation checker still rejects unreviewed foreign calls.

The internal `lean-text-v1` generator runner compiles captured tool modules and calls a checked Lean function with declared text inputs and literal arguments. Lake selects prerequisite recipes and resolves their tool imports without invoking custom target bodies. The runner writes the exact named outputs into private staging and records compiler-prefix, interface, input, and output hashes. See the [prerequisite milestone](../evidence/lake-generator-prerequisites-20260912.md) for selection and execution checks.

The [generated-workspace milestone](../evidence/lake-generated-workspace-20260912.md) stages those outputs beside the captured sources without changing the original snapshot identity. A second Lake pass resolves generated imports and binds every module and C input to its captured or generated origin. New prerequisites introduced by generated imports fail. Separate receipts retain the generator and output identities.

Ordinary npm and CPAN builds now consume those generated sources. The bounded `lake-generated-sources.json` handoff carries exact output text and separate receipts through compilation, linking, bundle inventories and package archives. Its reader verifies captured recipes and source origins before restoring files. The [generated-package acceptance record](../evidence/lake-generated-packages-20260912.md) covers installed public APIs, relocation, transport tampering and publication dry runs.

Generated public entry modules now use compiler-free root intent, checked against declared root-owned recipes and Lake's actual module ownership. npm uses a source-only engine request, obtains primitive signatures from fresh Lean metadata inside the engine, and checks them again during target compilation. CPAN selects its public roots from the freshly compiled closure. The [generated-entry milestone](../evidence/lake-generated-entries-20260912.md) records the source-intent and elaboration contracts separately from the original capture.

Captured public modules in locked npm projects now use the same compiler-owned path. Source intent carries no signatures; the engine discovers names and types before making the Binding IR or adapters, then checks fresh target interfaces again before linking. Native CPAN discovery also uses Lean instead of scanned declaration names. Alias, notation, inferred-result, relocation and rejected-signature cases are covered by the [ordinary-entry milestone](../evidence/lake-elaborated-entries-20260913.md).

Locked npm builds now use version 2 of the [rich compiler report](elaborated-export-metadata.md). It records elaborated binders, structural runtime types, documentation, UTF-16 source ranges, visibility, returned effects and direct theorem references. Binding IR uses the structural types. Interface identities include private/server sidecars, and target compilation must reproduce the complete report. The [rich metadata evidence](../evidence/elaborated-export-metadata-20260913.md) covers unsupported selections, namespace collisions, extractor faults and sidecar drift.

Arbitrary hooks, prebuilt native libraries and additional compiler/linker options remain unsupported. Reviewed foreign implementations still need compiler and adapter support; export contracts cannot authorize them. `analyze` invokes the pinned engine for captured and generated sources; dependency-free projects need no lockfile. Ordinary npm and native CPAN builds use the same compiler report with their separate scalar and native projections. These milestones keep the current primitive npm and native CPAN types without advancing type/profile cells or completing the full extractor plan.

## Package and consumer requirements

Generate packages for npm, PyPI, Cargo, C/C++, NuGet, Maven, RubyGems, CPAN, native PHP, PHP-Wasm, and WIT/WASI. Nix remains a delivery channel. Use native publishing tools and signed binary-cache recipes; do not add registry-upload adapters as part of this plan.

Use exact host integers and ecosystem numeric libraries. Preserve Unit, missing/default arguments, host null, Option branches, Except payload order, runtime widths, ownership, and effect semantics. Generate conversions, runtime loading, callbacks, and cleanup. Applications call named public APIs without writing bridge dispatch or marshalling code.

Compile Lean once per compatible profile. Package assembly cannot invoke compilers, and consumer installation cannot compile Lean or rebuild its runtime. Perl may compile supplied XS; ordinary downstream-language compilation remains supported. Include runtime dependencies, licenses, notices, source identities, and provenance in prepared outputs.

Extend the existing Node-only verifier with ecosystem-neutral local package-set receipts. Retain existing npm and signed formats and distinguish local integrity from authenticated provenance.

## Evidence and closure

Run positive, negative, and boundary cases against exact installed archives from at least two unrelated ordinary Lean projects, including nested modules and locked dependency imports. Test recursive limits, checked refinements, stale handles, cancellation races, and cleanup after failure. Verify independent components share one compatible runtime.

Compare isolated relocated builds, reject stale interfaces and corrupted artifacts, and retain reviewed latency and throughput thresholds. Measure warm paired calls separately from startup, build, and loading. Shard CI by profile and require the aggregate gate.

Keep the two documentation workflows: build and publish a Lean package; install and use a published package. Cover every target, keep PHP consolidated, retain package-manager guidance and bookmarks, and execute named example files against candidate archives. Site/toolchain maintenance belongs under Contributing.

Record commands, artifact hashes, covered cells, failures, and remaining work on the owning VO tasks. Completed milestones may be committed locally. Pushes, registry uploads, and deployment require separate approval. Existing platform profiles and release approval requirements remain unchanged.
