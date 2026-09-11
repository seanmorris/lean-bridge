# Declared Lake C inputs, 11 September 2026

This VO1239 milestone follows `e5f80fd`. Locked npm/WASM and native/CPAN builds compile captured C translation units declared through Lake `input_file` targets and referenced by a library's `moreLinkObjs`.

## Resolution and compilation

The pinned Lake resolver checks the loaded target declarations without fetching or executing their build bodies. Each selected input must be a captured `.c` file owned by its declaring package. Cross-package references require a direct declared dependency. Missing targets, missing files, package escapes, prebuilt objects or archives, and unsupported target facets fail before compilation. Pure-Lean resolution retains version 1; resolutions containing C inputs use version 2 and bind each input to its captured file identity.

The shared C compiler helper deduplicates translation units and compiles them once per selected profile. Native objects use `native-library-v1`; WASM objects use `side-module-2` with the existing exception, LTO, and floating-point contraction settings. Compiler flags from common ambient override variables are removed. Date/time macros fail compilation.

Before compiling, the helper asks the compiler for the full include closure, including system headers. Project files must match the captured snapshot. Other headers must lie under the selected compiler's reported system roots or the supplied Lean/runtime include roots. The helper hashes the executable, included files, and resulting objects. It compares the preprocessor and compilation dependency lists and rechecks their contents and the complete snapshot after linking. Failed compilation removes its private object directory.

Receipts record logical paths, file sizes, SHA-256 hashes, compiler version, and the selected flags. Native receipts include `nativeCompilation`; WASM link manifests use the same field and the [closed compilation schema](../../schema/lake-native-compilation.schema.json). Compiling from relative captured paths prevents absolute staging paths from entering LLVM bitcode identities. Both engine source inventories include the helper. The standalone CLI archive carries the helper and its schema.

## Executed acceptance

Shop imports local Catalog and pinned Git Units. Telemetry imports local Metrics and pinned Git Reading. Their Git packages declare `native code/conversion.c`, which includes a captured `factor.h` and the toolchain's `stdint.h`.

The npm suite passes 11 groups. Each C-input project builds twice after its original workspaces become unavailable, produces identical target-C manifests, native compilation records, execution reports, receipts, and archives, then installs offline with npm scripts disabled. Named JavaScript calls return `[6, 90, 4]` for Shop and `[6, 132, 3]` for Telemetry. Default and custom root layouts remain covered. Publication dry runs reproduce a custom-root project with the C input and verify its publication manifest; changing a dependency rejects authorization. These local dry runs substitute only the Nix command transport while executing the real compiler, linker, packaging, and verification code. Nix execution was unavailable locally.

The Lake/native suite passes 52 checks as root and as the unprivileged `nobody` user. Both projects combine custom root layouts with declared C inputs, produce identical relocated native receipts and CPAN archives, install, and return `12` and `15` through their Perl APIs at input `3`. Author source bytes, modes, timestamps, and Git metadata remain unchanged. Include tests reject outside headers, changed headers, extra captured files, changed objects, changed compiler executables, and date macros. An independently linked C driver executes the compiled C object and returns `42`.

The installed Lean APIs in these positive fixtures remain pure Lean. They establish that declared C inputs compile, link, and retain reproducible evidence without changing the existing API. They do not establish foreign-call support. Separate native and WASM tests select `@[extern]` functions and confirm that the fresh implementation checker rejects them without a reviewed contract.

The Node-only snapshot, component-input, C-metadata, engine-inventory, and CLI-archive checks pass 80 tests. Another 48 analyzer, adapter, compiler, linker, audit, native-contract, and canonical-build regressions pass. All three existing native Perl groups pass on 5.38.2-threaded, including 183 installed API checks. Source evidence hashes are refreshed after these runs without changing type/profile support.

`npm run check:core` passes lint, checked JavaScript, and 506 contracts. Site tests pass 101 checks; site typechecking and all 16 generated reference pages pass. The type inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells, and 32,230 required stage gaps.

## Recorded identities

```text
npm Shop
  snapshot: 98636b05a97380fd79461e460f3567b4988b9dab084c8b020e76e41a59f23e31
  target C: 6fcef7fd4b4adafb28d1501dea57a4f89960233caac2bbb29b59609fd58141f4
  archive:  b734739b4b28e08eb71b389aab93e38c3221b64f46270875378c36c4b6b96911
npm Telemetry
  snapshot: 439e3340bf28a69f58e4bbe529a18e167abe76f15fb698e72cabf6b3d57682ac
  target C: 345211b7e59abad8c2d5e9bf760873d144b51d1244474007e8a19c1bbb7c41ca
  archive:  f7b6e022c17224548b27d1dc1157e3c4d3bb8319ecf4ad644d27e7052bc59560

CPAN Shop with custom root
  snapshot: c50fc8e1671a5a314cb60a3d586c0d628622e854b559ce353e05f688c5cdf607
  library:  89ff279d2afa0edaee4e293cf6ca920702207011b4f7e48cc1dadf422f696250
  archive:  dd241f6bd073c9c7f8e3f20f06a7c3bd15397f6ad7533b4f4089b28336dc6ebc
CPAN Telemetry with custom root
  snapshot: 6d110990572905eb289dcd73a81c238a10c5e9221f949bd2de8cb5f11e5f0140
  library:  069d6544684f49ab1165a9eb1e9f9715135ea8d5f1bdef8abfb657c8442efa10
  archive:  2f7e761dfe7c04f95865a51325a7357e838a74c504fd43cb729e88084c3840c6
```

Verification commands, after `source scripts/env.sh`:

```sh
node --test tests/lake-native-inputs.test.mjs tests/lake-dependency-snapshot.test.mjs tests/lake-component-input.test.mjs tests/engine-execution-request.test.mjs tests/cli-npm-package.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs
LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/lake-workspace.test.mjs
```

The local glibc override matches this host. The production floor remains 2.38.

## Remaining work

Custom generators, `needs`, `extraDepTargets`, `extern_lib`, prebuilt native libraries, precompiled modules, and extra compiler/linker options remain rejected. The next VO1239 slice must authenticate generator inputs and tools, execute only selected prerequisites in isolated staging, distinguish generated outputs from captured files, and carry output identities through both profiles and relocated installed acceptance. Private staging is not an operating-system sandbox for hostile Lean, Lake, or C code.

Reviewed foreign-function contracts remain under VO1238. The shared authoritative export extractor and stale-interface cutover remain under VO1107/1108. Source-only export discovery is still provisional. No type/profile cells advance from this milestone, and VO1239 remains open. Nothing is pushed or published.
