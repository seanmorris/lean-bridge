# Component build pipeline

This directory turns accepted Lean project inputs into audited component artifacts. It defines a closed build request, executes that request through an authorized engine, links the resulting side module, and records enough identity information to compare independent builds.

## Architecture position

```text
project analysis + Binding IR + compiler adapter
                         |
                         v
              compilation and build plans
                         |
                         v
                engine execution request
                         |
                  +------+------+
                  |             |
                native        Docker
                  |             |
                  +------+------+
                         |
                         v
             side module audit + artifact manifest
```

The build layer owns compilation, linking, and structural validation. It does not choose registry layouts or publication destinations. [`../release`](../release/README.md) consumes completed artifacts without compiler access.

## Module map

| Modules | Responsibility |
|---|---|
| [`component-compilation-plan.mjs`](component-compilation-plan.mjs), [`component-plan.mjs`](component-plan.mjs) | Validate project inputs and prepare the files, targets, flags, runtime requirements, and output paths needed for a build. |
| [`compiler-adapters.mjs`](compiler-adapters.mjs) | Generate and validate the adapter plan that connects analyzed declarations to the component boundary. |
| [`engine-execution-request.mjs`](engine-execution-request.mjs) | Close over engine identity and build inputs, serialize the request, and verify it when read back. |
| [`canonical-build.mjs`](canonical-build.mjs), [`component-engine.mjs`](component-engine.mjs) | Select an authorized native or Docker path and coordinate request execution. |
| [`lean-component-compiler.mjs`](lean-component-compiler.mjs), [`component-side-linker.mjs`](component-side-linker.mjs) | Compile reviewed Lean sources and link the component side module. |
| [`side-module-audit.mjs`](side-module-audit.mjs) | Inspect Wasm structure, imports, exports, and side-module constraints before packaging. |
| [`component-artifact-manifest.mjs`](component-artifact-manifest.mjs) | Record the output set, hashes, target, and toolchain identity. |
| [`engine-output-comparison.mjs`](engine-output-comparison.mjs) | Compare output sets from independent authorized engines. |
| [`process-runner.mjs`](process-runner.mjs), [`build-error.mjs`](build-error.mjs) | Normalize subprocess execution and report canonical build failures. |

## Closed request model

An engine request identifies every repository input that can affect the result, the selected flake output or container definition, compiler adapters, and expected output paths. Readers verify the request before execution. This makes the build input closure reviewable and prevents a runner from silently selecting additional project files.

Native and Docker engines consume the same logical request. The Docker entrypoint delegates to the pinned Nix closure, so the two paths differ in isolation mechanism rather than compiler policy. Output comparison checks file sets and bytes instead of assuming equivalent commands produce equivalent artifacts.

## Artifact boundary

A successful build produces an audited component artifact set and a component artifact manifest. The manifest is the handoff to release code. Build modules do not write npm, Cargo, Composer, or other registry metadata, and release modules do not reach back into a project checkout to compile missing files.

Side-module auditing occurs before that handoff. A structurally invalid Wasm file is a failed build even if the compiler and linker exited successfully.

## Changing the pipeline

When adding a compiler input or flag:

1. Add it to the compilation plan and the engine request identity.
2. Update both native and Docker execution paths.
3. Extend request round-trip and source-closure tests.
4. Confirm engine output comparison still covers every emitted file.
5. Update the artifact manifest if the public output set changes.

When adding an execution engine, keep the existing request contract. An engine adapter should translate that contract into process execution, not create a second build definition.

## Verification and evidence

Unit and integration coverage lives in [`../../tests`](../../tests/README.md), including canonical build, compilation plan, component engine, request identity, side-module audit, and output comparison tests. The [native component engine evidence](../../docs/evidence/native-component-engine.md), [Docker engine evidence](../../docs/evidence/docker-component-engine.md), and [component input closure evidence](../../docs/evidence/component-compilation-input-closure.md) record executed paths and limitations.
