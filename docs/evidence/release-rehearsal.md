# No-publish release rehearsal evidence

## Result

The release rehearsal reads one verified canonical bundle, invokes every eligible registry backend, and writes registry-ready archives under one local output directory. It does not contact a registry, open network access, sign with an external key, or publish an artifact.

The full Nix Alpha bundle produces ready npm, Cargo, PyPI, C, C++, and WIT/WASI packages with no omission. A source-only unit fixture produces npm and records five explicit omissions, preserving coverage of the fail-closed path. An omitted package receives no archive or backend plan.

A reviewed test fixture enables the generated C source package without changing any artifact byte. That rehearsal produces npm and C archives from one canonical manifest and exercises deterministic multi-ecosystem orchestration without compiling package contents.

## Publication index

`publication-index.json` records:

- no-publish mode, disabled network access, and disabled external registry writes;
- the component, version, source revision, canonical manifest hash, and core artifact identity;
- the exact flake lock, graph lock, Binding IR, Lean runtime, ABI, patch set, and runtime profile;
- every package name, version, target, status, omission reason, backend plan, archive, and preserved core artifact; and
- the path and predicate type of the accompanying in-toto statement.

Each package repeats the canonical manifest, flake lock, graph lock, Binding IR, and core artifact identities. Validation fails if one package names another identity, a copied core artifact changes, package counts drift, a ready package lacks an archive, an omitted package carries output, or an unknown field appears.

`publication-index.sha256` records the canonical index hash. `publication-index.intoto.json` uses an in-toto Statement v1 envelope. Its subjects include the index, every registry archive, and every backend projection plan. The statement can receive an external signature without changing the index or archives.

The timestamp comes from the canonical source date epoch. Paths are output-relative. Two rehearsals in independent directories therefore produce byte-identical indexes, attestations, npm archives, and C archives.

## Tests

[`tests/release-rehearsal.test.mjs`](../../tests/release-rehearsal.test.mjs) verifies:

- the source-only bundle invokes npm and records five explicit omissions;
- no package directory is created for an ineligible backend;
- the reviewed C fixture invokes npm and C from one bundle identity;
- independent rehearsals produce identical indexes, attestations, and archives;
- all ready packages share the same canonical manifest, flake lock, graph lock, Binding IR, and core identity;
- the in-toto statement names the index, backend plans, and registry archives; and
- validation rejects enabled network access, unknown fields, and package identity drift.

Run the focused gate:

```sh
npm run test:release-rehearsal
nix --extra-experimental-features 'nix-command flakes' build .#release-rehearsal --no-link
```

Run the CLI against an existing bundle:

```sh
npm run release:rehearse -- --bundle build/universal-release-bundle --output build/release-rehearsal
```

The command accepts only input and local output paths. External publication remains outside the POC.
