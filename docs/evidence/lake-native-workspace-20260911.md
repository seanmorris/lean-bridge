# Native locked Lake builds, 11 September 2026

This VO1239 milestone follows `ff58e42`. Native/CPAN builds now compile locked pure-Lean dependency imports from captured source. npm/WASM integration and external native build inputs remain open. No type/profile cells advance.

## Resolution and compilation

Version-2 snapshots include the root project's files as well as the locked dependency set. Version 1 retains the dependency-only contract. The native builder uses the complete snapshot when the project has a `lake-manifest.json`, including when its package list is empty. Missing declared dependencies fail; the builder never creates or updates a lock.

`ResolveLakeWorkspace.lean` uses the pinned Lake loader and Lean import parser. It evaluates captured TOML or Lean configuration in private staging, replaces package locations with captured directories, and resolves module ownership and compilation order. Root Git URL, revision and subdirectory drift, changed local paths, missing pins, ambiguous modules, compiler-module shadowing, cycles, and unsupported native targets or compiler options reject the build. Git verification remains offline.

The resolver loads the selected compiler's Lake shared library. Without that library, evaluating a Lean Lake configuration reached an interpreter assertion; the Lean-configuration regression test covers this case. Lake can write its configuration cache only into the task-owned staging tree during normal operation. Snapshot verification rejects changed or unexpected staged input files. Private staging is not an operating-system sandbox for hostile Lean or Lake code.

The native compiler builds the resolved source modules before checking exports through fresh interfaces. The component model and receipt bind the complete snapshot, resolution, resolver source, compiler executable, Lake library, and interface hashes. The builder recaptures dependencies before releasing output and rejects source or compiler drift. Existing native/CPAN projection code reuses that compiled component across XS variants.

## Installed and relocated acceptance

Shop imports local Catalog, which imports pinned Git package Units. Telemetry independently imports local Metrics and pinned Git package Reading. Both Git packages use custom source directories. Separate resolver cases cover Lean configurations, Git subdirectory packages with sibling sources, and read-only author files.

Both projects build twice from relocated roots. Each pair produces identical native receipts and CPAN archives. Installed Perl calls return `12` for `Shop.quote(3)` and `15` for `Telemetry.measure(3)`. Dependency declarations remain internal to the selected API. Tests compare original source and Git file contents, modes, and modification/change times before and after resolution and compilation.

Recorded SHA-256 identities from the unprivileged run on this host:

```text
Shop
  snapshot:   0a3ad67c693ec5cb03c9bdd5164450b43a265e53f9194c5f1e1ce8181ffb8b3f
  resolution: d1dac126627a7926a91a5e4267442e6620e622e9477a7462490fe5fec64e2a21
  native:     2a866ddbc44ef1f0974b919c162183848198229263041e5a51da91ec06bf3225
  archive:    e97939756358686e24616a1dc5eb84291df5be3c71d3eb80ff5a40e9fa66b69d
Telemetry
  snapshot:   e20740e416105ca892e276586d88bd0f80f86f96807f6ed8f8b1d1b9463efd08
  resolution: daea4ae09ba1d6d7a6f66d3afe601e9446ee60673b3d4b8825be561cac3a7991
  native:     ce530bfb02fbbb063965a1d0bb67d9efd019c9f785486c60c28f55f078fdf6b4
  archive:    40029f130386665a7b8e5b9c05f1c2af96314a00b1ebf1e6871e50f44f27ca94
```

The 34 workspace tests pass as `nobody`. The existing Perl suite passes three groups, including 183 installed API checks, on Perl 5.38.2-threaded. This host uses glibc 2.36; the test override does not change the production minimum of 2.38.

```sh
runuser -u nobody -- env \
  LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/lake-workspace.test.mjs

LEAN_BRIDGE_PERL_NATIVE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/perl-native.test.mjs
```

CI now runs the workspace suite in the Perl job. The Nix Perl source closure includes the resolver and snapshot modules; the app supplies Git. Nix execution has not been tested on this host. Test-owned staging directories are removed after success or failure. No push, registry upload, or deployment occurred.

The core check passes lint, checked JavaScript types, and 486 contract tests. The 50 snapshot tests also pass as `nobody`; the engine/Perl contract run passes 11 tests, including both Nix source closures. Site tests pass 101 checks, site typechecking passes, and all 16 generated reference pages match. The core run initially found an unsorted npm source allowlist; the corrected allowlist passes the archive/install checks.

```sh
npm run check:core
runuser -u nobody -- node --test tests/lake-dependency-snapshot.test.mjs
node --test tests/engine-execution-request.test.mjs tests/perl-contract.test.mjs
npm run site:test
npm run site:typecheck
npm run docs:reference
npm run types:check
```

The type inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells, and 32,230 required stage gaps. Plan 1208 remains incomplete.

## Remaining VO1239 work

Pass authenticated snapshots across the npm/WASM engine boundary, resolve dependency imports inside that engine without requiring host Lean during planning, and extend its compilation/link manifests to bind the resolved order. Add native/generated input closure and root custom-source-layout support. Keep relocated offline and installed tests for each enabled profile.

Custom Lake build behavior, precompiled modules, native prerequisites, and additional compiler/linker flags are not implemented by this milestone. VO1107 and VO1108 still own the shared authoritative export extractor and stale-interface gates. Native export checking remains fresh; source-only discovery remains provisional.
