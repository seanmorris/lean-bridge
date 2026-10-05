# Compiler-owned exports for ordinary locked Lake projects

VO1107 and VO1108 milestone, 2026-09-13.

## Build behavior

Ordinary npm builds with `lake-manifest.json` and no reviewed Binding IR now send source-only intent to the isolated engine. Planning captures modules and source identities without assigning types or writing adapters. The engine resolves the locked import closure, compiles fresh interfaces, and asks Lean for the selected declarations and their types. It then derives the primitive Binding IR and compiler adapters from that metadata.

Captured public modules use the same path as generated modules. Native CPAN builds also discover exports through Lean; they no longer use source-scanned names. Automatic discovery uses Lean's generated-declaration classification, excludes private/protected names and projections, and skips type-valued aliases. Explicit export selections remain exact. Signature reduction resolves callable aliases as well as inferred return types and local notation.

Version 2 of the [source intent](../../schema/lake-entry-intent.schema.json) admits captured roots without requiring a generator. Version 2 of the [elaboration record](../../schema/lake-entry-elaboration.schema.json) records a null generated-source identity when there are no generators. Version 4 of the [compilation plan](../../schema/component-compilation-plan.schema.json) binds the metadata digest and each captured or generated root's origin. Generated origins still require a generator receipt and a generated-source digest.

The engine rejects host-supplied semantic metadata and adapters in source-only requests. Elaboration verifies source, compiler, extractor and interface hashes. Target compilation must reproduce the complete elaboration record before linking, including for projects without generated sources or native C inputs. The bundle retains `metadata/lake-entry-exports.json`.

## Regression coverage

Shop and Telemetry use automatically discovered public functions with a type alias, local notation, a private helper and inferred result or aliased callable type. An unused structure exercises exclusion of generated eliminators. A declaration written inside a comment must not become an export. Both projects import local and pinned Git dependencies.

The npm suite builds both projects from detached, relocated snapshots, compares archive bytes, installs offline with lifecycle scripts disabled, and calls the installed APIs at zero, ordinary, and UInt32 overflow inputs. It repeats this for default source layouts, custom Lake source directories, and declared C inputs. Native tests compare relocated CPAN archives and call installed Perl APIs.

Negative cases reject implicit, instance, dependent, universe-polymorphic, IO, Task, unsafe, foreign, admitted and missing exports before adapter compilation. A separate test changes the extractor's output during target compilation and requires rejection before Emscripten runs. Existing source, interface, header, dependency-drift and publication-dry-run checks remain in the suite. The Perl consumer CI job runs the compiler-only rejection cases without requiring Emscripten.

## Commands

```sh
source scripts/env.sh
node --test tests/lake-entry-modules.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs
LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-name-pattern='locked native builds' tests/lake-workspace.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/perl-native.test.mjs
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
  node --test --test-name-pattern='generated entry' tests/lake-generated-packages.test.mjs
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
  node --test --test-name-pattern='generated imports npm publication dry run reproduces' \
  tests/lake-generated-packages.test.mjs
```

The glibc override applies only to this local host; the production minimum remains 2.38. Local tests execute the pinned Lean and Emscripten tools directly. Publication dry-run tests replace Nix's command transport only; compilation, linking, packaging and verification still execute. Consumer CI exercises the pinned Nix engine. No registry publication forms part of these tests.

## Results

All 23 locked-WASM checks pass, including six relocated installed-package cases, ten rejected signatures, metadata drift, linker checks and both publication dry runs. The CI compiler-only command also passes all 12 checks without sourcing the local toolchain environment. All nine source-intent contracts pass as the unprivileged `nobody` user. Shop's default-layout npm case also passes as `nobody`, with the same archive bytes as the root run.

The native relocation group passes all five checks on Perl 5.38.2 threaded. Both installed APIs return their expected values, and dependency drift and unreviewed foreign implementations reject output. All four existing native regression groups pass, including the installed-API program's 183 assertions through its prebuilt and XS-only installation paths. Initial automatic discovery incorrectly selected Lean's generated `Counter.mk.noConfusion`; using Lean's generated-declaration classification corrected that regression.

Generated-entry Shop and Telemetry packages produce identical archives across detached, relocated roots and pass their installed npm calls. Shop's post-build dependency-drift check also passes. These cases were rerun after the extractor and engine source edits finished; the earlier concurrent run rejected those edits as engine identity drift.

Publication dry runs reproduce and verify both generated public entries and captured entries that import generated dependencies. The generated-entry dry run rejects changed generator input. Fresh target compilation rejects altered generated-entry metadata before linking. Generated definitions containing `sorry` reject before target compilation and leave no output or engine staging directory.

Representative archive SHA-256 identities from the final compiler/extractor sources:

```text
Shop npm, default:      159e5a331b3f1ba21a185a90897d1c080c606f060c4fc4ddc35eb90e6da58709
Telemetry npm, default: effd2290f7ef886cfa2296ed1f6435fabaf7902de2d868c98e9a8e61aeb22f03
Shop CPAN, custom:      f94b93460273bdf03da4cf21afe4ce2e87ac2c48383d6c3acafd933227ed9e11
Telemetry CPAN, custom: 8c3430b11fa1378d9a88aaf663d1e473504ef59871da65fd7e9b8ccd9bfc654b
Shop npm, generated:    fe4d5fc31f6d58a541f5bd02a00d54288aef83752b7dee364c5d6e79017d27a9
Telemetry, generated:  5683f1583047db9544d2ccb8d462a8ceadc4a7175097ab12dc97e57049ca5514
```

Lint, checked JavaScript, all 526 core contracts, all 62 documentation checks, site type checking for 79 canonical pages, and all 111 site tests pass. The type inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps. Four existing source-evidence hashes were refreshed without changing coverage states.

## Remaining work

This milestone does not complete VO1107 or VO1108. The richer shared metadata contract still needs binder diagnostics, theorem references and finite specialization decisions. `lean-bridge analyze` remains source-only; unlocked npm projects and explicit reviewed IR retain their existing planning paths. General cross-language adapters and the complete installed type corpus remain VO1216 and VO1217 work.

No type/profile cell advances. npm keeps the existing pure primitive profile, and CPAN keeps its native profile. No ABI conversion, XS or runtime implementation changes are included.
