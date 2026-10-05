# Locked Lake input capture, 11 September 2026

This VO1239 milestone starts from local commit `3f53133`. It adds an offline dependency snapshotter, its JSON schema, and 48 tests. The build commands do not use it yet. No type/profile cells advance.

## Captured inputs

`prepareLakeDependencySnapshot` reads the root `lake-manifest.json` and `lean-toolchain`, then captures the flat package list in that lock, including inherited entries. It accepts manifest versions 1.0.0, 1.1.0, and 1.2.0, full Git commit pins, relative local paths, and exact Lean release toolchains. Dependency toolchain declarations must match the root release.

The implementation follows the manifest fields, configuration filename defaults, package cache paths, and override filename in the pinned Lake source at Lean commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. An omitted configuration filename tries `lakefile.lean`, then `lakefile.toml`. Explicit filenames and null dependency manifests retain their Lake meaning. This milestone inspects the format and captures existing locks; it does not run Lake dependency resolution.

Local packages contribute regular files, including native C sources, headers, binary data, and executable flags. Git subdirectory packages contribute the whole checkout so sibling native files remain available. Capture excludes `.git`, `.lake`, `.direnv`, `.toolchains`, `.venv`, `node_modules`, `build`, `dist`, `target`, `.env`, `.env.*`, `.npmrc`, and `.lean-bridge-*` path components. A Git pin that tracks an excluded path fails instead of silently omitting it.

Default limits are 1,024 packages, 100,000 files, 16 MiB per file, and 256 MiB of captured file contents, with a 128-directory nesting limit. Callers may set the package, file, and byte limits. Root inputs count toward aggregate limits. Package names and snapshot paths must satisfy the portable-path checks in the implementation.

## Git and filesystem checks

Capture requires cached checkouts at their pinned commits. It hashes raw commit bytes, reconstructs and hashes every Git tree, and compares worktree bytes with the resulting blob identities. Tests cover SHA-1 and SHA-256 object databases, replacement refs, corrupted objects, modified files, missing files, extra source files, and executable-mode changes.

Git runs with lazy fetching disabled and an empty protocol allowlist. It does not run filters, fsmonitor hooks, or package scripts. A partial-clone test removes a required tree object and configures an executable remote helper. Capture fails without invoking the helper or changing Git metadata.

The reader rejects symlinks, submodules, nonregular files, missing declared inputs, and active package overrides. It bounds reads and checks file identity and metadata during capture, then rereads the inputs before returning private captured bytes. Tests compare file hashes, modes, directory entries, and modification/change times before and after capture.

`writeLakeDependencySnapshot` requires a new directory outside every input project. It writes the captured bytes, so later source edits cannot change an existing snapshot. Cancellation removes only the newly created partial output. Existing destinations remain intact. Verification compares the written files, modes, and manifest with the immutable capture held by the same process; a copied JSON document cannot substitute for that capture.

## Acceptance

The 48 snapshot tests pass as root and as the unprivileged `nobody` user. Relocated local packages and cached Git repositories produce identical identities and output bytes. Larger explicit file limits survive writing and verification. Tests reject malformed manifests, traversal, overlapping output paths, tampered files, manifest drift, and cancellation.

```sh
node --test tests/lake-dependency-snapshot.test.mjs
runuser -u nobody -- node --test tests/lake-dependency-snapshot.test.mjs
npm run check:core
node --test tests/engine-execution-request.test.mjs tests/perl-contract.test.mjs
npm run site:test
npm run site:typecheck
npm run docs:reference
npm run types:check
```

The core check passes lint, checked JavaScript types, and 484 contract tests, including CLI archive/install checks. The engine and Perl contract run passes 11 tests, including both Nix source-closure checks. Nix is unavailable on this host; no Nix build is claimed. The site passes 101 tests, typechecking, and all 16 generated reference checks. Test fixtures clean up their temporary directories.

The type inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells, and 32,230 required stage gaps. Plan 1208 remains incomplete.

## Remaining work

The staged directory contains dependency inputs plus the root lock and toolchain, not an executable Lake workspace. It preserves the original lock bytes and does not capture the root project's complete source tree. Fresh Lake resolution must still verify the declared dependency/import closure, map packages into isolated staging, and identify native inputs outside package roots. Builder integration must bind source, compiler, and fresh interface identities and pass relocated offline compilation tests. Detached snapshot verification also needs an authenticated expected identity before use across processes.

VO1239 remains open, as do authoritative elaboration and stale-interface gates in VO1107 and VO1108. No source-regex authorization, dependency-enabled build claim, registry upload, push, or deployment was added.
