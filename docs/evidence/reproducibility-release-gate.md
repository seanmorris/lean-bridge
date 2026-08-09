# Reproducibility release gate evidence

## Result

The release gate authorizes an exact artifact inventory only after two clean builds produce identical files and modes:

```text
analyze
  ↓
generate
  ↓
build A in clean source clone A
  ↓
build B in clean source clone B
  ↓
compare bundle and package inventories
  ↓
write reports and in-toto statement
  ↓
authorize the exact candidate identity
```

The gate requires a clean committed Git tree. It rejects tracked changes and untracked Git-visible files before building. It clones the commit twice without local hard links and checks out the same detached revision in each clone.

Docker remains the default backend. Each build runs in a new container overlay with its own writable Nix store. Both containers start from the same hash-locked Debian builder image. Native Nix remains the fallback. The gate assigns each native build a different `local?root=` store under its private scratch directory, so the two runs do not share writable Nix state.

## Complete consumer artifact comparison

The gate inventories every regular file under these roots:

- `bundle`, which contains Wasm and native artifacts, side modules, generated bindings, TypeScript declarations, Python stubs, C headers, Rust sources, validators, schemas, documentation, graph locks, proof and trust metadata, SBOM data, and provenance;
- `packages`, which contains every selected registry projection, package archive, backend plan, publication index, and publication attestation.

Each ordered inventory record contains the relative path, media type, target, runtime profile, byte count, Unix file mode, and SHA-256 digest. The candidate identity covers the source revision, Git tree, flake lock, canonical manifest, compiled core identity, and complete artifact inventory hash.

`build-report.json` is the only excluded build output. It contains execution-only Nix store paths. No registry package consumes it. The gate records both build identities and the exclusion reason in its evidence instead.

## Blocking diagnostics

A missing file, extra file, mode change, or byte change blocks authorization. The JSON report includes every differing path, both sizes, both modes, both hashes, and a bounded text or JSON preview when the bytes are safe to display.

Diagnostics label possible entropy categories as investigation leads. They do not claim a cause. Categories cover timestamps, absolute paths, archive metadata, compiler build IDs, environment values, locale, ordering, random identifiers, and unpinned inputs.

A failed gate still writes:

```text
evidence/reproducibility.json
evidence/reproducibility.md
```

It does not write `release-authorization.json`.

## Passing evidence and authorization

A passing gate writes:

```text
reproducibility-gate/
├── evidence/
│   ├── reproducibility.json
│   ├── reproducibility.md
│   └── reproducibility.intoto.json
├── release/
│   ├── bundle/
│   └── packages/
├── release-authorization.json
└── release-authorization.sha256
```

The authorization inventories every file permitted to reach publication. It names the exact candidate and hashes the machine report, human report, and in-toto statement. `verifyReleaseAuthorization` rejects a changed report, changed authorization hash record, changed canonical manifest, missing artifact, extra artifact, byte change, or mode change.

The gate performs no registry writes. The later external publisher must verify this authorization against the candidate before it reads credentials or uploads a package.

## CLI and CI

Run the complete local path with:

```sh
lean-bridge publish --dry-run --output build/reproducibility-gate
```

The command builds its own release candidate. It rejects `--bundle` in dry-run mode because accepting a prebuilt bundle would skip clean build A.

The GitHub workflow runs the same gate with repository read permission. It verifies the authorization, archives the release directory to retain Unix modes, and uploads one immutable workflow artifact. A separate `release-ready` job downloads that archive and verifies the authorization again. Future registry jobs must depend on `release-ready`; no current job receives registry credentials or writes to a registry.

## Independent verification

An independent developer or build service can check the same commit with:

```sh
git clone https://github.com/seanmorris/lean-bridge
cd lean-bridge
git checkout <source revision from reproducibility.json>
npm ci
npm run release:reproducibility -- --output build/reproducibility-gate
npm run verify:release-authorization -- --authorization build/reproducibility-gate --candidate build/reproducibility-gate/release
```

The machine report records the platform, backend version, builder definition digest, runtime profile, flake lock, source revision, source tree, artifact hashes, durations, and reproduction commands. The current supported build platform is Linux x86-64. The trusted bootstrap includes Git, Docker or Nix, the pinned OCI base images, the flake lock, Nix, the Lean compiler, Emscripten, the bridge generators, and the target runtime.

## Tests

[`tests/reproducibility-gate.test.mjs`](../../tests/reproducibility-gate.test.mjs) verifies independent clean cloning, byte differences, mode differences, bounded diagnostics, complete authorization generation, changed-candidate rejection, failed-report retention, and closed report schemas.

Run the focused gate without compiling the full toolchain twice:

```sh
npm run test:release-authorization
```
