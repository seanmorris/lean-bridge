# Package a Lean library

Turn a Lake project into a component, build local npm archives, and call its public functions from JavaScript. The worked example exports `add` and `isEmpty` and checks a theorem about `add`.

Install a prepared CLI archive, or use a checkout when developing Lean Bridge. No public CLI registry release is available yet.

## Prerequisites

[Set up the author tools](lean/setup.md): Node 22, Git, Lean 4.32.2, and Nix or Docker. The prepared CLI includes the shared runtime; the setup page also covers manual runtime builds for checkout users.

## Create a plain Lake project

[Build your first component](lean/first-component.md) gives every source file, the proof-check command, and the expected outputs. The source needs no publishing annotations or handwritten host wrappers.

## Analyze, build, and perform a dry run

The [first-component workflow](lean/first-component.md#analyze-the-public-functions) analyzes the project, builds the component, compares two clean builds, and verifies the local package receipt. Its final JavaScript call uses the generated archives.

For the theorem and its recorded relationship, read [Proofs and assurance metadata](lean/proofs-and-assurance.md). The package retains the analyzer's `unverified` relationship; the strict Lean check runs separately.

## Current export rules

[Choose an export shape](lean/export-decisions.md) explains supported source types, skipped declarations, adapter questions, and the call shapes implemented by the ordinary-project npm runtime.

## Adapter questions

[Resolve analysis decisions](lean/export-decisions.md#resolve-required-decisions) before building. The CLI reports required choices without changing Lean source or inventing an adapter.

## Exit codes

[Diagnose an author command](lean/diagnostics.md#exit-codes) lists exit codes and remedies for source, output-directory, toolchain, and runtime failures.

## Common failures

Use the [diagnostic table](lean/diagnostics.md#match-the-diagnostic), keeping the command's code and build log. A local dry run creates archives; it performs no registry write. Continue with [ordinary component publishing](publish/npm.md#publish-an-ordinary-component) when preparing a release.
