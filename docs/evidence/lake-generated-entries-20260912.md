# Generated public Lake modules

This VO1239 milestone allows a declared root-owned `lean-text-v1` recipe to produce a selected public API module for ordinary npm/WASM and native/CPAN builds.

## Source intent and compilation

`selectLakeEntryModules` locates captured root files or declared root generator outputs without executing Lean or assigning signatures. It rejects missing locks, unknown modules, multiple matching files, multiple producers and different names selecting one file. Lake must confirm the selected root path and producer after generation.

npm transports a [source-only intent](../../schema/lake-entry-intent.schema.json) alongside the unchanged original dependency snapshot. Version-2 [engine requests](../../schema/engine-execution-request.schema.json) bind that intent, engine and input inventory. They cannot supply a Binding IR, compiler adapters or extra host files. Readers check a bounded regular intent file and reconstruct its contents from the independently verified original capture.

The existing host-planned request format also compares the Binding IR's claimed origin with its freshly reconstructed analysis. A regression that relabels inferred types as `lean-elaborated` reached the compiler before this check and now fails at the analysis boundary.

The engine resolves the generated workspace, compiles fresh interfaces, then invokes `NativeExports.lean` with the complete import closure and separate public roots. The extractor supplies declaration names, resolved types and implementation checks. The primitive lowering creates a Binding IR with `origin: lean-elaborated`; it does not claim theorem assurance or parse generated source for signatures.

The [elaboration record](../../schema/lake-entry-elaboration.schema.json) binds the original snapshot, generated-source handoff, Lean executable, extractor, request, source files and fresh interfaces. Version-3 compilation plans bind that record and captured/generated root origins. Target compilation regenerates the workspace, emits C and fresh interfaces, and runs the extractor again. Different source, producer or metadata identities stop the build before linking. The bundle retains `metadata/lake-entry-exports.json` alongside the existing generated-source handoff.

This npm path performs an interface-elaboration pass before target C compilation and regenerates selected outputs for comparison. It links one component binary per profile; package projections reuse that binary.

Native builds use the same root selection and Lake ownership checks, compile the source closure once, then extract the API from its fresh interfaces. The native source identity records `request.exportModules` separately from all compiled modules. Existing C ABI validation and XS projection remain in use.

## Acceptance fixtures

Shop and Telemetry's public modules do not exist in their original snapshots. Their generators emit qualified functions using a captured `Extra.Amount` alias and an inferred result type. Generated code imports modules that were not reachable before generation. Selected C translation units include generated headers.

Each installed-package case builds two relocated copies and compares their receipts and archive bytes. npm builds run after both original paths become unavailable. CPAN installation runs after both author trees move. Installed calls use only the generated public API. Expected results for input `10` are `45` and `67`; JavaScript additionally checks zero and UInt32 overflow inputs. npm installs offline with scripts disabled, and CPAN uses prebuilt-only installation.

Publication dry runs reproduce a committed generated-entry project twice and verify its package receipt and publication manifest. A companion case changes the original generator input after the first build and requires rejection. No registry writes occur.

Node-only contracts cover compiler-free planning, source intent reconstruction, recomputed forgeries, source drift, forged output authority, occupied output directories, extra host files, symlinks, oversized records and cancellation. Selected captured roots without exports remain in the compilation closure. Compiled rejection cases inject changed extractor metadata after initial elaboration and generate an admitted public implementation; neither may reach linking.

The ordinary build also rechecks local dependency contents after engine execution. Its host-side regression replays the exact output from the preceding real compiled build, changes an original local dependency, and requires rejection without publishing a destination.

## Commands

```sh
node --test tests/lake-entry-modules.test.mjs tests/lake-component-input.test.mjs
source scripts/env.sh
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
  node --test --test-name-pattern='generated entry' tests/lake-generated-packages.test.mjs
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-name-pattern='generated native' tests/lake-generated-packages.test.mjs
```

The local glibc override is test-only; the production floor remains 2.38. Local tests replace only Nix's command transport because Nix is unavailable in this environment. Lean compilation, C compilation, linking, packaging and verification run normally. Consumer CI runs npm and publication acceptance through the pinned Nix engine.

## Verification results

All six generated-entry npm cases pass across focused runs: two relocated offline installations, successful publication reproduction, changed generator-input rejection, altered metadata rejection and admitted-implementation rejection. Shop's installed npm case also passes as the unprivileged `nobody` user, including the host-side dependency-drift regression. Both native fixture groups pass, covering captured APIs and generated public modules in Shop and Telemetry.

Recorded generated-entry archives:

```text
Shop npm:        d65811092946515b03573c6508acbb2d23aa33e6d1723b4f1547813880794763
Telemetry npm:   2446c4dfe79b059b317b85fc6e6cd4d7a8fb28dcb2e22d359b646c701d18c0eb
Shop CPAN:       1a51a8ff67193648329ce844d18d5713f1e442962c0d62525bba979013e00469
Telemetry CPAN:  8984535eab76aba1a270ac4b77297de14987ec50da39b666763a67c8a529a6f1
```

The existing Perl suite passes on 5.36.3 and 5.38.2, each threaded and nonthreaded. Each configuration completes the 183-assertion installed API program; nonthreaded interpreters skip its two thread-only assertions. The source analyzer, compiler/linker, package, CLI and snapshot regression groups pass. Core validation passes lint, checked JavaScript and 525 contracts. Site tests pass 101 checks, documentation typechecking compiles 79 canonical pages, and reference checks cover 16 generated pages.

Four audited source hashes were refreshed after these checks. The type inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps. No coverage cell changed status.

## CI permission regression

[Core run 34723571344](https://github.com/seanmorris/lean-bridge/actions/runs/34723571344) failed two tampering tests on `23ba193`. The fixture writer tried to overwrite mode-0444 intent and request records. Local root execution allowed those writes; the unprivileged CI runner rejected them with `EACCES` before reaching the validation assertions.

Both failures reproduced with `runuser -u nobody -- node --test tests/lake-entry-modules.test.mjs`. The test-only helper now asserts the original read-only mode, temporarily grants its owner write permission, writes the forged bytes and restores mode 0444 before validation. All eight tests pass as `nobody` after that change. Production file permissions and validation remain unchanged.

A broader unprivileged run found the same setup error in the legacy engine's source-drift test. That fixture now restores read-only mode before validation too. All 22 entry, engine-request and Lake-input tests pass as `nobody`. The full core check passes lint, checked JavaScript and all 525 contract tests in the normal local environment.

## Scope

npm retains its pure primitive signature profile, and CPAN retains its existing native capability checks. This change does not promote type-surface cells. `analyze` does not generate missing source files. VO1107/1108 still own the general authoritative extractor/analyzer cutover and its broader stale-interface contract. Arbitrary hooks, unreviewed foreign implementations and prebuilt native libraries remain unsupported.
