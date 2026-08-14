# Implementation status

Status as of 2026-08-14: the repository is an architecture-testing proof of concept. Every row in the [consumer support contract](consumer-support.v1.json) has a clean package consumer that executes real Lean. Native packages currently target x86-64 Linux with glibc 2.38 or newer. The [production-hardening review](evidence/production-hardening-review-20260814.md) withholds production approval pending human clean-room sessions, external reconstruction, a reviewed deployment profile, operated publication controls, and human assurance review.

## Lean project intake

The installed CLI provides noninteractive `analyze`, `build`, and `publish` commands. It resolves command flags, environment variables, a local configuration file, and defaults in a fixed order. Human and JSON results include diagnostics, adapter questions, progress, selected targets, cache policy, next actions, and exit code.

The analyzer currently:

- reads ordinary Lean source, Lake metadata, lockfiles, and available `.ilean` metadata;
- proposes Binding IR for documented public definitions with supported source types;
- preserves theorem references as unverified assurance candidates;
- reports foreign declarations, unsupported types, callable shapes, effects, implicit parameters, and host-name collisions as adapter questions;
- writes only an explicitly requested new output directory; and
- applies a built-in or supplied hash-identified analysis policy.

The onboarding matrix covers small, medium, generic, asynchronous, identity-bearing, custom-marshaling, incomplete-documentation, and ambiguous-lifetime projects. The plain package fixture contains no bridge annotation or handwritten wrapper. [Lean analysis evidence](evidence/lean-project-analysis.md) and [zero-configuration evidence](evidence/zero-configuration-acceptance.md) record those results.

## Build and artifact identity

The component build path prepares a closed compilation request from project source, generated compiler adapters, the shared-runtime contract, target selection, and cache policy. Docker and Nix consume the same request and produce the same authorized component bundle for the acceptance fixture.

The implemented build chain includes:

- one pinned Lean 4.32.2 compiler input and one patched shared runtime;
- runtime-free Emscripten side modules with imported memory and table;
- startup, lazy, and final-static composition profiles;
- a component artifact manifest and structural Wasm audit;
- a component-neutral bundle with Binding IR, assurance, provenance, runtime requirement, source closure, and hashes;
- deterministic package projections that cannot rebuild the component; and
- byte and file-mode comparison across clean rebuilds.

[Component engine evidence](evidence/native-component-engine.md), [Docker engine evidence](evidence/docker-component-engine.md), [side-module evidence](evidence/plain-component-side-module.md), and [artifact manifest evidence](evidence/component-artifact-manifest.md) retain the build details.

## Generated runtime behavior

The JavaScript and PHP execution fixtures cover:

- named functions and constructors;
- copied records with booleans, fixed-width integers, strings, bytes, and arrays;
- canonical identity-bearing resources;
- deterministic disposal with queued finalization as fallback;
- JavaScript and PHP callbacks invoked by Lean;
- returned Lean closures projected as host callables;
- declared errors and unexpected-error containment;
- properties, overloads, finite generic specializations, iterators, asynchronous iterators, and Promises in focused generated tests;
- bounded nested re-entry and cancellation; and
- exactly-once runtime and component initialization.

One application runtime owns the Lean heap, Wasm memory, function table, symbol space, identity registries, pending operations, and initialization state. Independently compiled components attach to that runtime. [Direct-call conformance](evidence/direct-call-conformance.md), [typed-value evidence](evidence/typed-value-frame.md), [callback evidence](evidence/callback-signature-plan.md), [pending-operation evidence](evidence/pending-operation-state-machine.md), and [lifecycle evidence](evidence/lifecycle-stability.md) record the behavior.

## Package projections

### npm

The canonical Alpha npm projection installs into a clean Node project with scripts disabled and executes the real Lean runtime. Plain Lake projects produce separate runtime and component archives plus a component receipt. The component archive contains no runtime binary. The runtime archive is shared. Package export maps keep internal runtime paths closed.

Browser source fixtures execute the same native API through raw ESM, a module worker, Vite, Rollup, Webpack, and React. The installed npm archive also exposes a browser conditional export and executes through Vite and Chromium. [npm evidence](evidence/npm-package.md), [plain project acceptance](evidence/plain-project-package-acceptance.md), and [browser package acceptance](evidence/browser-package-acceptance.md) record these paths.

### PHP

The native PHP builder emits a Composer package, C transport, generated Zend extension, process-owned runtime library, normalized sources, reflection, assurance, provenance, and a sorted hash inventory. The supported artifact targets PHP 8.2 NTS on x86-64 Linux.

The PHP-Wasm builder emits the same Composer API, a PHP 8.4 extension, one shared runtime, three side modules, loader metadata, and release records for lazy and startup profiles. The Node-hosted PHP-Wasm 0.1.0 consumer executes both profiles. Native Zend and PHP-Wasm produce the same semantic observation for the current conformance corpus.

[Native PHP evidence](evidence/native-php-release-package.md), [PHP-Wasm package evidence](evidence/php-wasm-release-package.md), [shared PHP-Wasm runtime evidence](evidence/php-wasm-shared-runtime-composition.md), and [transport parity evidence](evidence/php-transport-parity.md) retain the package and execution records.

### Python, Rust, C, C++, and WIT/WASI

One native foundation produces a process-wide Lean runtime and an Alpha component library. The canonical bundle records both by hash and makes the Python wheel, Rust crate, C11 package, and C++20 package eligible. Python loads the component lazily, Rust supplies a generated runtime implementation, C calls its generated API, and C++ adds move-only RAII wrappers. All four clean consumers cover real Lean resources, copied values, callbacks, closures, and disposal.

The WIT/WASI package includes the generated portable WIT subset, a Component Model adapter, the pinned Wasmtime C API, and an independent host. Its clean consumer enters the component and calls real Lean through the generated C API.

[Native consumer acceptance](evidence/native-consumer-acceptance.md) and [WIT/WASI consumer acceptance](evidence/wasi-consumer-acceptance.md) record the package and execution evidence.

### .NET, JVM, and Ruby

The canonical bundle includes deterministic net8.0 assemblies, JDK 22 classes, generated Ruby and RBS sources, the shared native runtime, and independently compiled Alpha and Beta components. NuGet uses the standard runtime-specific native asset layout. Maven packages native libraries as resources loaded by the finalized Foreign Function and Memory API. RubyGems installs pure Ruby `Fiddle` bindings without compiling a native extension.

Clean consumers cover copied values, identity, callbacks, returned callables, declared failures, deterministic close, stale use, package receipts, Kotlin compilation, isolated JVM class loaders, Ruby GC compaction, two-component shared-runtime composition, and end-user performance. [.NET, JVM, and Ruby acceptance](evidence/managed-consumer-acceptance.md) records the package and execution evidence.

## Release controls

The release proof of concept includes:

- a canonical package manifest and component graph lock;
- deterministic npm, NuGet, Maven, RubyGems, native PHP, and PHP-Wasm artifacts;
- an SPDX SBOM and in-toto provenance records;
- clean rebuild comparison before authorization;
- a value-free registry credential boundary;
- signed publication authorization with a closed public-key policy;
- preflight and durable state for several registry adapters;
- idempotency keys and registry-specific recovery states; and
- content-addressed component receipts for local dry runs and signed exact-archive receipts for completed releases.

No live registry adapter is installed. Dry run performs no external registry write. Execute mode cannot publish without a separately installed adapter, credentials, and signer policy. [Reproducibility evidence](evidence/reproducibility-release-gate.md), [publication attestation evidence](evidence/publication-attestation.md), [registry transaction evidence](evidence/transactional-registry-release.md), and [receipt evidence](evidence/release-receipt.md) define those controls.

## Performance evidence

The performance corpus includes spatial workloads, 1, 3, 10, and 50-library graphs, generated call overhead, lifecycle stability, PHP transport comparison, build reproducibility, and a nine-fork reference methodology. Shared CI measurements remain informational because runner hardware and co-tenant load vary.

The runtime measurements in the [README](../README.md#runtime-performance) link to raw records. The [evidence index](evidence/README.md#performance) lists the methodology, workloads, and reproducibility reports.

## Remaining product work

Current blockers include:

- passing clean-room sessions from a real Lean author, JavaScript consumer, and Python consumer;
- an independent release reconstruction outside this repository's workflow boundary;
- a reviewed production deployment profile and human assurance approval;
- elaborator-backed extraction for the full supported Lean language surface;
- reviewed adapters for additional numeric, generic, effect, callback, and ownership shapes;
- additional native operating systems and architectures;
- broader Component Model coverage for callbacks and borrowed identity results;
- PHP ZTS, AArch64, macOS, Windows, browser PHP, and broader libuv effects;
- live registry adapters and an operated signer policy; and
- independent release rebuild attestations outside this repository.

Any support promotion requires a clean package installation and real Lean execution in the consumer matrix workflow.
