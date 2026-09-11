# Build and publish a Lean package

Create a Lean library or adapt an existing Lake project, then deliver packages that applications can install with their own language tools.

## Choose your starting point

| Starting point | Next step |
| --- | --- |
| A new library | [Build your first component](lean/first-component.md). The npm tutorial includes every source file and a theorem check. |
| An existing library | [Adapt an existing library](lean/existing-package.md). Inspect its exports, dependencies, and target requirements before packaging. |

Choose [one or more target languages](publishing.md#choose-the-package-ecosystem) before preparing the build environment. Each target guide identifies its accepted source or prepared inputs, package format, runtime requirements, and publication tools. The [cross-language implementation](architecture/cross-language-authoring.md) tracks ordinary-source support across every target.

## Prerequisites

Use the [target-specific setup](lean/setup.md). The npm tutorial starts with a prepared CLI archive and its bundled runtime; native Perl has a different compiler and XS setup. The CLI candidate is currently distributed as an archive rather than a public npm release.

## Create a plain Lake project

The [first component](lean/first-component.md) exports `add` and `isEmpty` and checks an addition theorem. Supported declarations need no publishing annotations or handwritten host wrappers. Existing projects can enter through the [adaptation guide](lean/existing-package.md).

## Current export rules

[Choose export semantics](lean/export-decisions.md) for values, identity, refinements, errors, callbacks, and asynchronous delivery. Select declarations in the shared [author configuration](lean/existing-package.md#configure-exports), then check each target's conversion table for the mappings its installed packages implement.

## Adapter questions

[Resolve required decisions](lean/export-decisions.md#resolve-required-decisions) before building. Analysis reports unsupported or ambiguous boundaries; it does not silently edit the library or invent an adapter.

## Analyze, build, and perform a dry run

[Check the relevant proofs](lean/proofs-and-assurance.md), review the exported API, and commit the intended source. Follow the [target guide](publishing.md) to build its packages and verify them in a separate application.

For npm, [share a local package](publish/local-handoff.md) explains the reproducibility dry run, runtime and component archives, receipt, and verifier. For Perl, the [native build](publish/cpan.md) produces runtime and component CPAN archives and their native identity records.

## Publish and verify the release

Choose the package name, version, destination, and signing policy under your own release authority. Each [target-language guide](publishing.md#choose-the-package-ecosystem) includes its package-manager commands, upload checks, and recovery steps.

Publish the reviewed bytes, download them again, and run the matching [consumer example](consume.md). For several targets, retain each target's package identity and installation result. [Signed Nix packages](publish/nix.md) and [archive distribution](publish/archives.md) provide additional delivery channels.

## Exit codes

[Diagnose an author command](lean/diagnostics.md#exit-codes) using its exit code and structured diagnostics.

## Common failures

Use the [diagnostic table](lean/diagnostics.md#match-the-diagnostic) for analysis and build failures. Publication errors belong to the selected target guide. Lean Bridge's own deployment approvals and universal-release tooling are documented separately in [Contributing](../CONTRIBUTING.md).
