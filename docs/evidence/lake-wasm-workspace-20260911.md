# Locked Lake dependencies in npm builds, 11 September 2026

This VO1239 milestone follows `214ebf0`. The ordinary npm/WASM pipeline now compiles the locked pure-Lean dependency closure used by the native/CPAN pipeline. No type/profile cells advance.

## Build identity and transport

Version-2 component and compilation plans bind a complete source snapshot by SHA-256. Planning captures files and verifies cached Git objects with Node and Git. A test runs the planner with no Lean executable on its search path and no compiler installed in the supplied engine root.

The transported snapshot loader requires the digest from the authorized plan. It validates closed metadata, portable paths, sorted unique inventories, file hashes, executable modes, aggregate limits, toolchain identity, and agreement with the captured lock. It rejects extra files, symlinks, altered sources, changed metadata, and missing inputs. It reloads captured bytes without consulting the original workspace or Git checkout. This establishes integrity against the expected build identity, not publisher authentication by itself.

The execution request hashes the complete staged input and authorizes the bundle's exact filenames. Inside the engine, the selected compiler loads the shared Lake resolver, resolves imports, and compiles dependency modules before the generated adapter. The version-2 target-C manifest binds the snapshot, resolved order, compiler executable, resolver source, Lake library, target C, and fresh interfaces. The linker validates that chain before invoking Emscripten. Source and interface tampering, changed order, and unrelated compilation records reject the build.

The bundle retains the captured root and dependency files under `lake/`, including configuration and license inputs. npm packages carry dependency LICENSE, NOTICE, and COPYING files under package-specific paths in `notices/lake/`. The canonical build recaptures original inputs before releasing output. Source-free npm projection and downstream installation do not run Lean or fetch Lake dependencies. Existing no-lock projects retain their version-1 plan and manifest formats.

The publication dry run transfers the immutable dependency capture into both independent clean root checkouts. Each checkout must match the complete captured root file inventory. The gate recaptures the original dependency set after both builds, before writing candidate authorization. Its Git probes disable optional index writes, so checking cleanliness does not refresh the author's index.

## Executed acceptance

Two independent projects exercise transitive imports:

- Shop imports local Catalog, which imports pinned Git Units.
- Telemetry imports local Metrics, which imports pinned Git Reading.

Both Git dependencies use a custom library source directory. Each project is staged twice from relocated roots. Tests then rename both original workspaces, making every original source and locked path unavailable to the engine. Each pair produces identical execution requests, target-C manifests, execution reports, package receipts, and component archives. Staged inputs and the detached original workspaces retain their file bytes, modes, and modification/change times.

Offline npm installation uses the generated component and runtime archives with lifecycle scripts disabled. Installed JavaScript calls return `[6, 90, 4]` for `Shop.quote` and `[6, 132, 3]` for `Telemetry.measure`, using inputs `0`, `42`, and `4294967295`.

A committed Shop project also passes the complete local publication dry run: two independent root clones, canonical build orchestration, actual compilation and packaging, matching release inventories, receipt verification, and publication-manifest verification. A companion case edits Catalog after the first build and confirms that authorization fails after the second. Both local tests substitute only the Nix command transport; they do not run Nix or upload packages. The successful gate leaves original source and Git metadata unchanged.

Recorded SHA-256 identities on this host:

```text
Shop
  snapshot: 0a3ad67c693ec5cb03c9bdd5164450b43a265e53f9194c5f1e1ce8181ffb8b3f
  target C: 90ac3102640bf9ddb8b1bb53070bbf4c64dee0d39696e77b388e1f13a30cb9b1
  archive:  263792954895949fcd08fd2d14ba7d8e30478c2f3c28180864ed3165216bce27
Telemetry
  snapshot: e20740e416105ca892e276586d88bd0f80f86f96807f6ed8f8b1d1b9463efd08
  target C: 755665668889dca4bc0c0ecb30e1190f3cd91586a1d5d2a80b9cbc0997d291af
  archive:  b957f5d7b6fb954580b8d083e4c38fa3579d0ef6a543691061aa5bde0cfdbb6c
```

Commands require the repository's pinned Lean/Emscripten toolchains and prepared shared Wasm runtime:

```sh
node --test tests/lake-dependency-snapshot.test.mjs tests/lake-component-input.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs
```

The snapshot suite passes 60 checks, component-input planning passes four, and the WASM suite passes five integration groups. Native regressions pass 34 Lake workspace checks and all three Perl groups, including 183 installed API checks, on Perl 5.38.2-threaded. The local glibc test override remains 2.36; the production floor remains 2.38.

The consumer CI workflow now runs the relocated npm and publication-gate cases through the pinned Nix component engine. `LEAN_BRIDGE_LAKE_ENGINE` selects that external executable and `LEAN_BRIDGE_LAKE_RUNTIME_ROOT` selects its prepared consumer runtime. The direct compiler/linker tampering group requires the local toolchains. Nix is unavailable on this host, so local results do not claim Nix execution.

The broader regression pass exposed an existing universal-build routing error: the repository's fixture name was being checked as an ordinary npm coordinate. Canonical build orchestration now keeps the universal fixture's package projection path separate. Its backend, output, and cache-policy tests pass.

## Remaining work

VO1239 still owns declared native/generated inputs, custom root source layouts, and other Lake build behavior. Unsupported native targets, precompiled modules, prerequisites, and extra compiler/linker options continue to fail. Private staging does not sandbox hostile Lean or Lake code.

VO1107 and VO1108 retain the shared authoritative export extractor and stale-interface gates. The new dependency resolver uses Lean's import parser, but ordinary export discovery remains source scanning. Native export checking already uses fresh interfaces. The full type inventory remains incomplete, with no additional supported cells claimed by this milestone. Nothing is pushed or published by these checks.
