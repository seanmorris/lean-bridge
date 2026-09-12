# Generated Lake sources in installed packages

This VO1239 milestone connects the [verified generated workspace](lake-generated-workspace-20260912.md) to ordinary npm/WASM and native/CPAN builds.

## Build and transport

Both builders use `resolveLakeBuildWorkspace`. Projects without generator recipes keep the captured-source path. Projects with recipes select the required pure tools, generate their declared outputs, and resolve the completed Lean import closure. Selected public entry modules must still be captured files.

`lake-generated-sources.json` is a canonical, digest-bound handoff containing the requested modules, prerequisite receipts, generated-workspace receipt, resolution receipt, and exact UTF-8 output text. The original snapshot keeps its own unchanged identity. The [handoff schema](../../schema/lake-generated-sources.schema.json) closes its fields. Encoded handoffs are limited to 64 MiB, in addition to the existing per-generator and workspace limits.

The reader requires the producing compiler's expected digest. It reads recipes from the independently verified original capture, validates the receipt chain and source origins, checks every output's path and bytes, and restores files into private staging. It rejects extra outputs, changed content, invalid Unicode, mode changes, symlinks, noncanonical JSON, and oversized files. Verification rechecks the handoff, capture, and exact restored inventory. Failed reads and compilation remove owned staging.

Native compilation accepts generated C sources only through an authenticated workspace context. C build outputs must be outside both the original capture and the generated workspace. The C compiler reports the include closure; the builder checks captured and generated headers against their authorized hashes. Version-2 C compilation receipts retain both the original snapshot digest and the generated workspace digest. The native component model binds the generated handoff digest, and the CPAN distribution includes the same handoff bytes.

Generated WASM builds use version-3 target-C manifests. The linker checks the generated handoff, root-module ownership, actual import order, fresh interfaces, and compiler identities before invoking Emscripten. Link receipts bind the handoff and workspace digests. The exact engine output inventory reserves one `generated/lake-generated-sources.json` file when captured configuration contains recipes. The release bundle verifies that compilation and linking used the same handoff before copying it.

The generated-source path runs the fresh implementation check even when no C translation unit is selected. Generator output does not authorize foreign or unsafe Lean implementations. Arbitrary Lake target bodies, shell generators, prebuilt native libraries, and extra compiler flags remain unsupported. Lean configuration evaluation and import initializers retain normal trusted-Lean behavior; private staging is not an OS sandbox.

## Installed acceptance

Shop and Telemetry's captured public APIs import generated values. Generation also introduces an import of `Extra`, a captured module unreachable before generation. Selected C translation units include generated headers. Both npm and CPAN tests build each project from two relocated roots and compare receipts and archive bytes. npm compilation runs after both original project paths become unavailable. CPAN consumers install after both author workspaces have moved.

The installed Perl APIs return `45` and `67` for input `10`. The installed JavaScript APIs additionally check zero and UInt32 overflow inputs. npm installation runs offline with lifecycle scripts disabled. CPAN installation uses its prebuilt-only path. Consumer installation does not execute Lean, Lake, or the generator.

The publication test reproduces a committed generated-source project twice, then verifies the package receipt and publication manifest without registry writes. A companion case changes the original generator input after the first build and requires release rejection.

Transport rejection tests change output bytes, output paths, output count, generator receipts, source origins, producer keys, and requested modules. They test both the retained handoff digest and an attacker-recomputed digest. The altered handoffs fail before Emscripten is invoked. A changed captured input also fails. Node-only checks cover required external digests, fake workspace objects, exact directories, noncanonical JSON, file modes, symlinks, oversized handoffs, and cancellation.

Commands:

```sh
source scripts/env.sh
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/lake-generated-packages.test.mjs
node --test tests/lake-generator-contract.test.mjs
```

The local glibc override is test-only; the production floor remains 2.38. Nix is unavailable locally. Local publication tests replace only Nix's command transport; Lean compilation, C compilation, linking, packaging and release verification run normally. CI runs the npm generation and publication cases through the pinned Nix engine.

## Verification results

All nine generated-package checks pass across the focused root runs. Shop's relocated npm installation and the handoff rejection case also pass as the unprivileged `nobody` user. The first unprivileged installation used the root account's npm cache and failed; the test now selects a cache inside its owned temporary directory. Shop's archive and handoff hashes match between root and `nobody`:

```text
Shop npm archive:     5cc8ff207b4c292a7fb6dd5c40d0e3b220692a0890ca1ab3fa3e48a0ac4642be
Shop source handoff:  667bc88741e89f4e9f58c85786d36d2aa693c9e5e5115326fce7e669b849181c
Telemetry npm:       bb0a7e990ceaec1bee4a1be03d80cbd2a7a862ff934c46e32edb8da2008c9ee8
Telemetry handoff:   b13f3a60edd442f3b6e3816bc15a8d464f81a504663c18f22df7781ba78ea97d
Shop CPAN archive:   1a18fee3d31bf9088436ca7b0cf7461bdf91f209a135fb6e1d54ae126d860599
Telemetry CPAN:      989eebc47026c4cdf614526abfbd6442155c6bfa8a97025b7265846a21fce313
```

All 59 existing Lake/native/Perl checks pass, including 183 installed Perl API assertions on 5.38.2-threaded. All 11 existing WASM integration groups have passing runs. One initial case rejected an engine edit made while the test was running; its unchanged-source rerun passes. The final C-output guard also passes the nine focused include/object-drift checks and the generated npm rerun.

The core gate passes lint, checked JavaScript and 516 contracts. Site tests pass 101 checks, site typechecking covers 79 canonical pages, and all 16 generated reference pages pass. Another 23 compiler/linker/bundle/publication checks, 19 CLI/engine/author-doc checks, and 19 generator/C/Perl contracts pass. The type inventory remains at 6,562 cells, 2,193 observed, 116 installed-tested and 32,230 required stage gaps. Eight tested source/schema/test hashes were refreshed without changing support claims.

The preceding commit, `1d14830`, completed [core CI](https://github.com/seanmorris/lean-bridge/actions/runs/34712475125), [downstream CI](https://github.com/seanmorris/lean-bridge/actions/runs/34712475251), and [performance CI](https://github.com/seanmorris/lean-bridge/actions/runs/34712475148) successfully. These results belong to that preceding revision; the new integration requires its own CI run.

### CI fixture follow-up

Commit `55e0a4c` passed downstream and performance CI. Core passed 515 of 516 contracts. The failing read-only check recorded `.git/objects/maintenance.lock` before planning, then found it absent afterward, with changed object-directory timestamps. Git 2.55.0 ran on that worker; the local Git is 2.39.5. The fixture helper had allowed automatic maintenance after creating commits.

Both Lake Git fixture helpers now pass command-scoped `maintenance.auto=false` and `gc.auto=0`. They do not change the author's Git configuration, exclude lock files from inspection, or relax timestamp checks. A regression enables both settings in the fixture's local config, verifies that fixture commands override them without changing the stored values, and repeats the complete read-only planning comparison. This regression fails before the fix and passes afterward. All 68 snapshot/planning checks and the final 517-contract core gate pass locally. The recorded helper hash was refreshed without changing type support.

## Scope

The npm and CPAN capability gates accept the closed `lean-text-v1` profile. Other targets do not gain ordinary generator support from this change. Public entry-module generation, arbitrary hooks, prebuilt native libraries and foreign implementation contracts remain separate work. VO1238 owns foreign implementation contracts; VO1107/1108 own authoritative export extraction and stale-interface cutover. This milestone does not promote type-surface cells.
