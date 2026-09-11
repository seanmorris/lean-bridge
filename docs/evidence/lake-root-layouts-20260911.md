# Custom Lake root layouts, 11 September 2026

This VO1239 milestone follows `7a87024`. Locked npm/WASM and native/CPAN builds accept custom root package and library source directories with explicit module selection in `lean-bridge.exports.json`.

## Source selection and compiler checks

Planning uses the configured Lean module name to locate one root file with the corresponding path suffix. `Shop.Api` can select `lean-src/Shop/Api.lean`. Multiple matching files, missing modules, and two names selecting one file fail before staging. This lookup does not evaluate Lake or establish module ownership.

The compilation plan binds each selected name to its provisional path and source digest. The pinned Lake resolver must confirm that exact name/path pair. Both native compilation and WASM compilation reject a different path. The WASM linker checks the same binding against the recorded resolution. Tests use a captured decoy file to verify rejection before compilation or linking can accept it.

Locked compilation plans list selected root modules, not path-derived names for every captured Lean file. Lake supplies the actual transitive import closure and compilation order. Unused root files remain in the snapshot and build identity without becoming compiler inputs. No-lock builds keep their existing module and dependency behavior.

Analysis reports now include an optional `sourceModule` field for each export candidate. Generated adapters preserve that name instead of converting the whole project-relative file path into a module name. Source-only export discovery remains provisional. This milestone does not complete the shared elaborated extractor in VO1107 or the stale-interface gates in VO1108.

## Executed acceptance

Shop uses `lakefile.toml` with library `srcDir = "lean-src"`. Telemetry uses `lakefile.lean`, a package source directory named `source tree`, and a library source directory named `lib`. Both import a local dependency and a transitively pinned Git dependency. A separate compiler test resolves `Shop.Api` and `Shop.Internal` under a custom directory.

The npm tests cover default and custom layouts for both projects. Each pair of relocated builds produces identical execution requests, target-C manifests, execution reports, package receipts, and npm archives. Compilation succeeds after the original workspaces and their dependency paths become unavailable. Offline installation with scripts disabled returns `[6, 90, 4]` for Shop and `[6, 132, 3]` for Telemetry at UInt32 inputs `0`, `42`, and `4294967295`.

Both custom layouts also produce identical relocated native receipts and CPAN archives. Installed Perl calls return `12` for Shop and `15` for Telemetry at input `3`. Source files, modes, modification times, change times, and Git metadata remain unchanged. Existing native scalar, resource, callback, and packaging regressions continue to pass.

The publication dry-run tests now use a custom-root Shop project. Two clean Git clones share the captured dependency snapshot, reproduce the release, and verify its publication manifest. Changing a dependency between builds rejects authorization. Local tests substitute the Nix command transport while running the real compiler, linker, packaging, and receipt checks. Nix is unavailable locally; these results do not claim a local Nix execution.

Custom-layout npm SHA-256 identities:

```text
Shop
  snapshot: 687fc715b220025c9848fe42c7f570bc0dc02b986603266df218dba90da66088
  target C: c15cac077561b4f74ea38e72a81516b6eb15799a2055c679c0f4c6f1f6d4d332
  archive:  1c1b68d1e9ef657b92e4a18d749872ecfd4e46d47ed8b993c79dae21128bdc61
Telemetry
  snapshot: 534fe39817f2b65b723b6acac20f5f53fbbe8c761d782836cf61fcadea5d4c67
  target C: ab53aa0404576fe73554ca54b509851c52f277e47d80721ded5d80eb993d400d
  archive:  d19d9d751d2b6f3343d74a0b49ac9697be9d87d4c5f8e6b8e1178a2c9d72fdf0
```

Verification commands:

```sh
node --test tests/lake-dependency-snapshot.test.mjs tests/lake-component-input.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs
LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 \
  LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/lake-workspace.test.mjs
```

The local glibc override is for this host only. The production floor remains 2.38. The combined snapshot/planning suite passes 67 checks and the real Lake/native suite passes 35, both as the unprivileged `nobody` user. All eight WASM groups and three existing Perl groups pass. Another 48 analyzer, adapter, compiler, linker, engine, and canonical-build regressions pass. Source evidence hashes are refreshed after verification without promoting type/profile cells.

## Remaining work

Custom source directories currently require explicit module names and a unique matching root file. The planner does not evaluate arbitrary Lake configurations to disambiguate duplicate filenames or discover custom roots automatically.

Declared generated/native prerequisites remain unsupported. Enabling them requires closed input and tool identities, private execution, recorded generated outputs, and profile-specific native compilation. Arbitrary Lake targets, precompiled modules, and extra compiler/linker flags still fail explicitly. Private staging alone does not sandbox hostile Lean or Lake code. VO1239 stays open, and nothing is pushed or published by this milestone.
