# Component build pipeline

This directory turns accepted project inputs into audited component artifacts through a closed execution request.

## Responsibilities

- Compilation plans identify source closure, compiler adapters, targets, flags, and runtime requirements.
- Component engines execute the same request through pinned Docker or Nix paths.
- Artifact manifests and side-module audits record byte identity and structural constraints.
- Engine comparison verifies that authorized build paths produce equivalent outputs.

[`canonical-build.mjs`](canonical-build.mjs) coordinates the build. [`component-engine.mjs`](component-engine.mjs) owns backend selection, and [`component-artifact-manifest.mjs`](component-artifact-manifest.mjs) records the result.

Registry packaging does not belong here. [`../release`](../release/README.md) consumes completed artifacts without compiler access.

See the [native component engine evidence](../../docs/evidence/native-component-engine.md) and [component input closure evidence](../../docs/evidence/component-compilation-input-closure.md).
