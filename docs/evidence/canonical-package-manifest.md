# Canonical Package Manifest Evidence

Status: the compile-once handoff now has a closed, versioned, language-neutral schema, a semantic validator, canonical serialization, a content hash, and one reviewed Alpha fixture.

## Boundary

The canonical package manifest sits between the pinned flake build and registry packaging backends. The flake and resolved graph write it. npm, Cargo, PyPI, C, C++, and WIT/WASI backends read it. A backend cannot add semantic fields, select another component version, replace the dependency graph, or change a core artifact hash.

The manifest records:

- component and version identity;
- flake lock, resolved graph lock, and input closure identities;
- source revision, path, and hash;
- Binding IR file and semantic identities;
- shared runtime ABI, Lean revision, patch set, profile, and ownership scope;
- every artifact path, role, media type, target, byte count, hash, executable bit, and core-artifact bit;
- target eligibility, platform constraints, capabilities, reasons, and entry points;
- dependency manifest identities;
- provided capabilities, required hosts, and explicit target gaps;
- npm, Cargo, PyPI, C, C++, and WIT/WASI names, versions, targets, eligibility, and public artifact selections;
- generated documentation and license files;
- proved, trusted-boundary, and unverified claims with theorem, assumption, subject, and artifact links; and
- builder, toolchain, source epoch, closure, SBOM, and provenance identities.

## Contradiction checks

The validator rejects:

- unknown or missing fields;
- a component ID whose version differs from the component version;
- a registry version that differs from the component version;
- runtime and graph profile drift;
- private runtime declarations;
- absent, duplicate, unlisted, or mistargeted artifacts and entry points;
- eligible targets with failure reasons, or ineligible targets with entry points;
- packages that claim eligibility for an ineligible target;
- capabilities that a target both provides and lists as a gap;
- proof claims without theorem identities;
- trusted-boundary claims without assumptions;
- source, lock, Binding IR, closure, SBOM, assurance, or provenance identity drift; and
- self-dependencies or repeated registry names.

The Alpha fixture hash is `3bdd977fe975f8d573b44b9c4d51adfdef8d82d14767b87be75522b8937d1146`. Canonical serialization sorts object keys, so insertion order cannot change that identity. Array order remains meaningful for entry points, dependency resolution, and package projections.

## Current fixture

The small fixture marks the browser target and npm package eligible while keeping native FFI and WASI ineligible with specific reasons. The full Nix bundle adds the native and Component Model artifacts and makes all six package mappings eligible. Keeping both forms tests success and fail-closed behavior.

## Reproduce

Run:

```sh
node --test tests/canonical-package-manifest.test.mjs
```

The tests cover the closed schema, reviewed hash, order-independent canonical identity, provenance completeness, version and graph drift, target contradictions, artifact targeting, and proof laundering.
