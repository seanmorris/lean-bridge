# Contributing to Lean Bridge

Contributors maintain Lean Bridge's implementation, documentation, demos, and release tooling. To package your own Lean library, start with the [author guide](docs/lean-author-guide.md). The project is an architecture-testing proof of concept; changes need reproducible checks and evidence for the behavior they claim.

## Choose a contribution

| Your change | Start here |
| --- | --- |
| Edit a guide, navigation, or the React presentation | [Develop the documentation site](site/README.md) |
| Change an algorithm demo, proof receipt, or benchmark | [Develop and verify demos](demos/README.md) |
| Build example archives or run contributor acceptance | [Build example packages and run checks](docs/contributing/testing.md) |
| Extend package projections or release machinery | [Release tooling and package extensions](src/release/README.md) |
| Deploy this repository's guides and workbenches | [Publish the documentation and demos](docs/contributing/github-pages.md) |

## Before changing code

1. Read the [project overview](README.md) and [architecture index](docs/architecture/README.md).
2. State effects on all eight [permanent architecture lenses](docs/architecture/README.md#permanent-review-lenses).
3. Preserve the one-runtime application boundary.
4. Change Lean declarations or bridge metadata before generated public artifacts.
5. Attach a reproducible command and raw evidence to architectural claims.
6. Satisfy the [patch admission policy](docs/architecture/patches.md) before introducing a Lean or Emscripten patch.

Generated files carry source/schema hashes and must not be edited manually. Runtime tests are evidence, not machine-checked proof. A reproducible binary is not itself a behavioral proof.

Preserve unrelated work in a dirty tree. Limit each change to named project paths and stop when an unexpected conflict makes that impossible.

## Contributor workflow

When behavior changes:

1. Update the owning implementation and test.
2. Update the machine-readable contract if support state or schema shape changed.
3. Execute the relevant workflow and record fresh evidence.
4. Update the detailed guide or status page.
5. Change the root README only when its selected summary has become stale.
6. Run `npm run test:docs` to validate links, paths, examples, support consistency, and writing rules.

The [source map](src/README.md#finding-the-right-change-point) identifies the modules that own each change. The [script index](scripts/README.md) explains command boundaries, and the [test index](tests/README.md) explains coverage and isolation. Use those indexes to find implementation; keep canonical design requirements in [architecture](docs/architecture/README.md) and executed results in [evidence](docs/evidence/README.md).

## Documentation changes

Documentation changes must:

- lead with the supported outcome or measured result;
- distinguish current evidence from planned product behavior once, without repeating caveats;
- use plain punctuation and active voice;
- replace broad claims with named systems, measurements, consequences, or explicit unknowns;
- link historical and technical claims to primary sources; and
- avoid presenting tests, reproducible builds, provenance, or type checking as behavioral proof.

The [documentation-site guide](site/README.md#claim-ownership) identifies the source that owns each claim. Its [style and reference rules](site/README.md#style-and-references) cover portable links, public examples, and evidence records.

## Run checks

Run the local documentation and downstream-support contract before opening a change:

```sh
npm run test:docs
```

The [contributor testing guide](docs/contributing/testing.md) covers the heavier author and clean-package checks through the pinned Nix and Docker toolchains. Site and demo changes also need their own focused checks before the complete deployment audit.
