# Canonical Package Manifest Evidence

Status: the compile-once handoff now has a closed, versioned, language-neutral schema, a semantic validator, canonical serialization, a content hash, and one reviewed Alpha fixture.

## Boundary

The canonical package manifest sits between the pinned flake build and registry packaging backends. The flake and resolved graph write it. Npm, Cargo, PyPI, C, C++, and later backends read it. A backend cannot add semantic fields, select another component version, replace the dependency graph, or change a core artifact hash.

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
- npm, Cargo, PyPI, C, and C++ names, versions, targets, eligibility, and public artifact selections;
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

The Alpha fixture hash is `aa39b00b770b98193a0facf31ad56718a6e5bd2761aab3c9873d5925407351ee`. Canonical serialization sorts object keys, so insertion order cannot change that identity. Array order remains meaningful for entry points, dependency resolution, and package projections.

## Current fixture

The fixture marks the browser target and npm package eligible. It marks native FFI and WASI targets ineligible with specific reasons. This reflects the fixture's current artifact inventory. It does not claim that the generated C, Rust, or Python bindings are impossible to package. Node 829 will build the first complete release bundle. Node 830 will add non-JavaScript package projections from that same bundle.

## Reproduce

Run:

```sh
node --test tests/canonical-package-manifest.test.mjs
```

The tests cover the closed schema, reviewed hash, order-independent canonical identity, provenance completeness, version and graph drift, target contradictions, artifact targeting, and proof laundering.
