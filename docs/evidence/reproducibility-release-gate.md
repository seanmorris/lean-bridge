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

The report carries an ordered candidate state history: created, analyze, generate, build A, build B, compare, report, authorize, and publish. The gate runs project analysis before compilation and binds the generate transition to the discovered Binding IR identity. Build, comparison, report, and authorization transitions each require SHA-256 evidence. The state machine rejects skipped, repeated, stale, and cross-candidate transitions. Dry run stops at authorize. The external publisher remains responsible for the final publish transition after it verifies the authorization.

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
├── release-authorization.sha256
├── publish-manifest.json
└── publish-manifest.sha256
```

The authorization inventories every file permitted to reach publication. It names the exact candidate and hashes the machine report, human report, and in-toto statement. `verifyReleaseAuthorization` rejects a changed report, changed authorization hash record, changed canonical manifest, missing artifact, extra artifact, byte change, or mode change.

The CLI derives the publish manifest after the gate verifies the authorization. The manifest binds ordered package actions and idempotency keys to the candidate and publication index. It names required credential environment variables but contains no values. The gate and manifest writer perform no network access, credential reads, or registry writes.

## CLI and CI

Run the complete local path with:

```sh
lean-bridge publish --dry-run --output build/reproducibility-gate
lean-bridge publish --manifest build/reproducibility-gate/publish-manifest.json
```

Dry run builds its own release candidate. It rejects `--bundle`, `--authorization`, and `--manifest` because accepting prebuilt inputs would skip or mix clean-build evidence. Execute mode consumes only the generated manifest and optional target constraints that exactly match the dry run.

The GitHub workflow runs the same gate with repository read permission. It verifies the authorization, archives the release directory to retain Unix modes, and uploads one immutable workflow artifact. A separate `release-ready` job downloads that archive and verifies the authorization again. Future registry jobs must depend on `release-ready`; no current job receives registry credentials or writes to a registry.

## Independent verification

An independent developer, build service, or agent can verify a published gate directory or HTTPS tar archive with one command:

```sh
npm run verify:independent-release -- \
  --repository https://github.com/seanmorris/lean-bridge \
  --published ./reproducibility-gate.tar \
  --output build/independent-confirmation \
  --verifier example-auditor
```

The verifier validates archive paths and rejects links before extraction. It reads the authorized revision, checks out that exact commit, runs the two-build gate, compares the rebuilt candidate identity with the published identity, and exits nonzero on any difference. An optional `--revision` must equal the revision in the published authorization. Local and HTTPS archives are limited to 1 GiB. HTTPS redirects must remain on HTTPS.

A successful verifier writes an append-only `independent-confirmation.json` and SHA-256 record. The confirmation names the candidate, source revision, source tree, artifact inventory, optional verifier identity, platform, hashed rebuild environment, published authorization, rebuilt authorization, rebuilt report, optional report URL, and confirmation time. A second write to the same output path fails. Confirmation count never changes the theorem or reproducibility result; it records who independently reproduced the same bytes.

The machine report records the platform, backend version, builder definition digest, runtime profile, flake lock, source revision, source tree, artifact hashes, durations, and reproduction commands. The current supported build platform is Linux x86-64. The trusted bootstrap includes Git, Docker or Nix, the pinned OCI base images, the flake lock, Nix, the Lean compiler, Emscripten, the bridge generators, and the target runtime.

## Tests

[`tests/reproducibility-gate.test.mjs`](../../tests/reproducibility-gate.test.mjs), [`tests/independent-verifier.test.mjs`](../../tests/independent-verifier.test.mjs), and [`tests/independent-confirmation.test.mjs`](../../tests/independent-confirmation.test.mjs) verify independent clean cloning, byte differences, mode differences, bounded diagnostics, complete authorization generation, publish manifest derivation, target-selection locking, changed-candidate rejection, failed-report retention, archive safety, one-command verification, append-only confirmation records, and closed report schemas.

Run the focused gate without compiling the full toolchain twice:

```sh
npm run test:release-authorization
node --test tests/independent-verifier.test.mjs tests/independent-confirmation.test.mjs
```
