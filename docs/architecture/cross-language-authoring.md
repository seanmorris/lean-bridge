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

Task 1219 has installed arrays, Lists, products, Option, Except, copied records,
aliases and variants across all seventeen consumer profiles. The
[structured-types record](../evidence/structured-types-20260921.md) links the
ordinary-source and independently reviewed package checks.
[Recursive npm values](../evidence/npm-recursive-20260922.md) also pass installed
checks in Node, TypeScript, browser pages, React and workers.
[Recursive copied packages](../lean/export-decisions.md#start-with-the-runnable-npm-shapes)
now pass installed checks on both source paths across all seventeen profiles.
Synchronous callbacks and returned closures accept acyclic copied payloads in
every profile. npm, [C/C++](../evidence/native-recursive-callables-20260925.md),
[Python](../evidence/python-recursive-callables-20260925.md),
[Rust](../evidence/rust-recursive-callables-20260925.md),
[Ruby](../evidence/ruby-recursive-callables-20260925.md),
[Perl](../evidence/perl-recursive-callables-20260925.md) and
[C#](../evidence/dotnet-recursive-callables-20260926.md) also accept recursive
callback payloads. Five profiles still need recursive callable acceptance.
Aggregates with explicit resource ownership remain part of the same task.

Prepared [C/C++ packages](../evidence/native-compounds-20260920.md),
[Python wheels](../evidence/python-compounds-20260920.md),
[Rust crates](../evidence/rust-compounds-20260920.md),
[NuGet packages](../evidence/dotnet-compounds-20260920.md),
[Maven packages](../evidence/jvm-compounds-20260920.md),
[RubyGems](../evidence/ruby-compounds-20260920.md),
[CPAN packages](../evidence/perl-compounds-20260920.md),
[native Composer packages](../evidence/php-native-compounds-20260920.md) and
[PHP-Wasm packages](../evidence/php-wasm-compounds-20260920.md) also compile options,
results and binary products on both source paths. Python uses explicit `Some`,
`Ok` and `Err` wrappers. Rust uses its standard `Option`, `Result` and tuples,
with an outer `Result` for bridge failures. C# uses generated `Option<T>` and
`Result<T, E>` value types and native binary tuples; bridge failures throw
exceptions. Java and Kotlin share generated sealed `Option<T>` and
`Result<T, E>` types and a `Pair<A, B>` record, with boxed primitive payloads.
Ruby uses `nil` or `Some`, `Ok` or `Err`, and two-element arrays. Branch wrappers
are frozen `Data` classes with pattern matching; nested mutable payloads are copied.
Perl uses `undef` or `Some`, `Ok` or `Err`, and two-element array references.
Its mutable branch objects preserve presence even when the payload is `undef`.
Native PHP and PHP-Wasm use `null` or `Some`, `Ok` or `Err`, and two-element arrays;
final readonly branch wrappers retain present `null` payloads.
These adapters preserve Unit and nested options.
WIT/WASI uses native option, result and tuple types, retaining explicit presence and binary nesting. All seventeen consumer profiles now have installed checks for this Option/Except/Prod round.

Lists have a distinct `constructor:list` in the shared compiler and Binding IR.
The five npm profiles have installed checks on both source paths, using ordinary
host arrays and typed Lean sequence conversions. Lists retain order and nest with
the existing copied types. [C/C++ packages](../evidence/native-lists-20260920.md)
also have installed List checks on both paths, using typed C spans and owned
C++ vectors. [Python wheels](../evidence/python-lists-20260920.md) accept exact
lists or tuples and return owned tuples on both paths.
[Rust crates](../evidence/rust-lists-20260920.md) borrow slices and return owned
vectors on both paths. [C# packages](../evidence/dotnet-lists-20260920.md) use
owned typed arrays on both paths. [Java and Kotlin](../evidence/jvm-lists-20260920.md)
use primitive or reference arrays from the same prepared Maven JAR on both paths.
[Ruby gems](../evidence/ruby-lists-20260921.md) use copied Arrays on both paths.
[Perl packages](../evidence/perl-lists-20260921.md) use plain array references on
both paths, with installed checks on all four pinned Perl ABIs.
[Native PHP packages](../evidence/php-native-lists-20260921.md) use consecutive-key
arrays on both paths, with weak and strict callers checked separately.
[PHP-Wasm packages](../evidence/php-wasm-lists-20260921.md) use consecutive-key
arrays with 32-bit PHP integer mappings in Node and Chromium on both paths.
[WIT/WASI packages](../evidence/wit-lists-20260921.md) use canonical lists through
the packaged Wasmtime host on both paths. Copied Lists now cover all seventeen
consumer profiles. Aliases, arbitrary and recursive variants, and compound
callables remain open.

The [structured-type implementation record](../evidence/structured-types-20260921.md)
tracks the remaining compiler, transport, ownership and installed-package work.
Shared validation now rejects alias-only cycles, including cycles inside
containers. A staged codec preserves alias identities and tagged variants in
bounded copied descriptors. These transport tests do not advance installed
coverage; compiler adapters and per-profile package checks must follow.

## Shared configuration and Perl cutover

`lean-bridge.exports.json` holds language-neutral author intent. Module and export selection apply before host-language projection. Package-specific names and versions belong under canonical target keys. Machine paths and credentials stay outside source configuration.

The shared configuration supplies `modules`, `exports`, `specializations`, `contracts`, `resources`, `arities`, and target metadata validation. Source analysis and builds hash the configuration. npm and CPAN implement finite specialization within their existing type profiles; npm and native builds implement closure arities; CPAN also implements resources and its module/version settings. npm packaging and publication use the sealed settings while preserving the compiled Lean identity. Other configured target settings fail when their projection does not implement them.

[Export contracts](../lean/existing-package.md#declare-export-contracts) now express ownership, lifetime, refinement and boundary-effect requirements for exact exports. Lean checks those constraints against compiled signatures; the request identity, metadata validators, target re-extraction and package model retain them. Current adapters enforce copied values, native call-scoped borrowing, returned leases and synchronous callback effects. Unsupported transfers, anchored lifetimes, checked constructors and async choices fail. Their runtime implementations remain in tasks 1220, 1221, 1222 and 1223; configuration does not complete those tasks.

The [contract acceptance record](../evidence/export-contracts-20260914.md) covers installed npm/CPAN packages, relocated builds, contract tampering, pre-link rejection and unchanged source inputs.

Perl uses the [shared configuration](../lean/existing-package.md#configure-exports). Native compilation, generated XS, the shared runtime, CPAN archives, and supplied-XS installation remain in use.

Public analysis, ordinary npm builds and native CPAN use fresh elaboration through the shared compiler report, including projects without a Lake lockfile. Explicit reviewed Binding IR keeps its compiler-free analysis path. [Reviewed builds](../lean/existing-package.md#compile-a-reviewed-contract) require explicit source modules and reconcile the contract with fresh metadata before generating adapters. Copied primitives, nested arrays and Lists, acyclic records, Option, Except, nested products and synchronous primitive callables have installed checks across all seventeen consumer profiles, including PHP-Wasm and WIT/WASI. npm copied values and callables can share a component, including callbacks and returned functions with finite recursive payloads. Combined builds check the same reviewed input and source API across profiles. Native projections retain their compiler-checked C representations, resource selection and closure arities. Source-configured builds also accept [named concrete specializations](../lean/existing-package.md#export-concrete-specializations) with compiler-resolved type arguments and instance dictionaries. Public analysis projects the npm copied-value shapes and synchronous callables with primitive or copied payloads.

## Shared semantic model and combined builds

Task 1216's first adapter slice uses one compiler-metadata lowering function for scalar and native Binding IR. Source declarations retain Lean names; the Perl projection applies its own namespace validation and snake-case names. Native representations stay in the native adapter model. Callback type identities describe their semantic signatures, without including native boxing or C layout.

The [combined npm/CPAN build](../publish/npm.md#build-npm-and-cpan-together) passes the same immutable Lake snapshot to both compiler profiles. It compares the resulting source API while retaining each profile's complete Binding IR, source positions, compiler evidence and artifact hashes. Source/API identity includes contracts, specializations and theorem references. It excludes source positions and producer hashes, which remain bound by the individual profile evidence.

The native adapter model is now version 2 because its canonical declaration names and semantic type identities changed. Binding IR remains version 3; native ABI 1 and scalar ABI 2 are unchanged. CPAN staging reconstructs the model from compiler metadata and rejects stale models. Existing Perl call names are unchanged.

The combined builder compiles each profile once and stages its archives privately. Source drift, mismatched APIs, failure or cancellation prevents the final directory from appearing. Ordinary builds accept npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo and native PHP together when every selected profile admits the API. C/C++, C#, Java/Kotlin, Ruby, WIT, Python, Rust and native PHP support all 19 copied primitives, arrays and acyclic records in concrete, pure function signatures. These targets reuse the compiled native component; generated record accessors keep its object layout private. C#, Java, Ruby, Python, Rust and native PHP wrap the shared C adapter with private scoped conversions. NuGet and Maven contain compiled managed code; RubyGems and PyPI contain host-language sources and compiled native libraries without an extension build. Arrays and acyclic copied records can also target npm when every selected profile admits the API. All seventeen consumer profiles support synchronous primitive callbacks and returned closures on ordinary-source and reviewed paths. Source-configured closure arities still require separate target builds. C++ supplies pinned Boost cpp_int values, typed callbacks and move-only closure ownership. Configured native identity resources still require CPAN-only builds.

The [ordinary WIT adapter](../evidence/native-wit-20260914.md) generates a native import interface, canonical-ABI forwarding component and public function interface. Its Wasmtime embedding library converts copied values through the same C adapter and automatically loads the shared Lean runtime. Canonical scratch memory resets after successful calls; trapped stores are replaced before reuse. The prepared archive includes the pinned Wasmtime C API and dependency licenses. It requires the packaged native host rather than an arbitrary WASI command runner. Other profile/type gaps and the shared corpus (1217) remain open.

The [ordinary Python adapter](../evidence/native-python-20260915.md) generates source-named functions, type stubs and frozen dataclasses in deterministic platform wheels. Consumers use exact Python integers and owned copied values. A synchronized in-memory loader verifies bundled library hashes and shares one compatible runtime across independently installed wheels. No shared installed file is owned by multiple distributions.

The [ordinary Rust adapter](../evidence/native-rust-20260915.md) generates borrowed inputs, owned results, exact big integers and private RAII conversions. Checked crates embed compiled libraries in downstream binaries. A locked process registry coordinates compatible independently generated crates; temporary library files are removed after loading. Cargo compiles the generated Rust, not Lean or a C extension. Wider type coverage and the shared corpus remain open under the stages above.

The [ordinary native PHP adapter](../evidence/native-php-copied-20260915.md) produces self-contained Composer ZIPs with checked PHP functions, readonly records and exact wide integers. Installed packages use FFI to load verified libraries into one process runtime. It covers PHP NTS CLI; server SAPIs remain open.

The [ordinary PHP-Wasm CLI](../evidence/php-wasm-cli-20260915.md) compiles copied primitives, arrays and acyclic records into a separate wasm32 Zend adapter. `--target php-wasm` produces npm runtime/component archives and a companion Composer ZIP. Combined builds share one captured API across JavaScript-Wasm, native and PHP-Wasm profiles, compare compiler-derived meanings, and expose every package atomically. Installed checks cover bundled files, Composer autoloading and Vite asset URLs, with [startup and lazy loading](../evidence/php-wasm-lazy-20260915.md) in Node and Chromium. These builds include the generic package-set receipt described below.

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

Generated public entry modules now use compiler-free root intent, checked against declared root-owned recipes and Lake's actual module ownership. npm uses a source-only engine request, obtains supported component signatures from fresh Lean metadata inside the engine, and checks them again during target compilation. CPAN selects its public roots from the freshly compiled closure. The [generated-entry milestone](../evidence/lake-generated-entries-20260912.md) records the source-intent and elaboration contracts separately from the original capture.

Captured public modules in locked npm projects now use the same compiler-owned path. Source intent carries no signatures; the engine discovers names and types before making the Binding IR or adapters, then checks fresh target interfaces again before linking. Native CPAN discovery also uses Lean instead of scanned declaration names. Alias, notation, inferred-result, relocation and rejected-signature cases are covered by the [ordinary-entry milestone](../evidence/lake-elaborated-entries-20260913.md).

Locked npm builds now use version 2 of the [rich compiler report](elaborated-export-metadata.md). It records elaborated binders, structural runtime types, documentation, UTF-16 source ranges, visibility, returned effects and direct theorem references. Binding IR uses the structural types. Interface identities include private/server sidecars, and target compilation must reproduce the complete report. The [rich metadata evidence](../evidence/elaborated-export-metadata-20260913.md) covers unsupported selections, namespace collisions, extractor faults and sidecar drift.

Arbitrary hooks, prebuilt native libraries and additional compiler/linker options remain unsupported. Reviewed foreign implementations still need compiler and adapter support; export contracts cannot authorize them. `analyze` invokes the pinned engine for captured and generated sources; dependency-free projects need no lockfile. Ordinary npm and native CPAN builds use the same compiler report with their separate scalar and native projections. These milestones keep the current primitive npm and native CPAN types without advancing type/profile cells or completing the full extractor plan.

## Package and consumer requirements

Generate packages for npm, PyPI, Cargo, C/C++, NuGet, Maven, RubyGems, CPAN, native PHP, PHP-Wasm, and WIT/WASI. Nix remains a delivery channel. Use native publishing tools and signed binary-cache recipes; do not add registry-upload adapters as part of this plan.

Use exact host integers and ecosystem numeric libraries. Preserve Unit, missing/default arguments, host null, Option branches, Except payload order, runtime widths, ownership, and effect semantics. Generate conversions, runtime loading, callbacks, and cleanup. Applications call named public APIs without writing bridge dispatch or marshalling code.

Compile Lean once per compatible profile. Package assembly cannot invoke compilers, and consumer installation cannot compile Lean or rebuild its runtime. Perl may compile supplied XS; ordinary downstream-language compilation remains supported. Include runtime dependencies, licenses, notices, source identities, and provenance in prepared outputs.

Ordinary npm, native, PHP-Wasm and combined builds now include ecosystem-neutral local package-set receipts. The [Node-only verifier](../consume/receive-package.md#verify-a-local-package-set) checks archive hashes, sidecars, declared package identities, exact in-set dependencies and per-profile runtime agreement. It retains npm and signed formats and reports unsigned local consistency separately from authenticated provenance. It does not inspect archive-internal metadata or replace installed-consumer acceptance.

The [package-set acceptance record](../evidence/package-set-verification-20260915.md) covers relocated receipts across all ordinary target ecosystems, installed CLI verification, mixed-profile name collisions, and unchanged PHP-Wasm archive bytes.

## Evidence and closure

Run positive, negative, and boundary cases against exact installed archives from at least two unrelated ordinary Lean projects, including nested modules and locked dependency imports. Test recursive limits, checked refinements, stale handles, cancellation races, and cleanup after failure. Verify independent components share one compatible runtime.

Compare isolated relocated builds, reject stale interfaces and corrupted artifacts, and retain reviewed latency and throughput thresholds. Measure warm paired calls separately from startup, build, and loading. Shard CI by profile and require the aggregate gate.

Keep the two documentation workflows: build and publish a Lean package; install and use a published package. Cover every target, keep PHP consolidated, retain package-manager guidance and bookmarks, and execute named example files against candidate archives. Site/toolchain maintenance belongs under Contributing.

Record commands, artifact hashes, covered cells, failures, and remaining work on the owning VO tasks. Completed milestones may be committed locally. Pushes, registry uploads, and deployment require separate approval. Existing platform profiles and release approval requirements remain unchanged.
