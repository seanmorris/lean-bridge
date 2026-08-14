# Pinned Nix inputs

This directory defines immutable compiler and runtime inputs plus the repository source boundaries consumed by the root [`flake.nix`](../flake.nix). The flake assembles derivations; these files define what those derivations may use.

## Files

[`wasm-toolchain.nix`](wasm-toolchain.nix) pins the Lean source revision, Emscripten toolchain, Node runtime, libuv source, archives, and hashes needed by component builds. It applies the reviewed patches under [`../patches`](../patches/README.md) and exposes shared toolchain attributes to flake outputs.

[`core-source-boundary.json`](core-source-boundary.json) lists repository files admitted to core runtime and universal artifact derivations. [`component-engine-source-boundary.json`](component-engine-source-boundary.json) lists the additional build modules, scripts, schemas, and fixtures needed by the component engine.

## Source-boundary model

```text
repository checkout
        |
        v
reviewed source-boundary list
        |
        v
filtered Nix source tree + pinned external archives
        |
        v
named flake derivation
```

A derivation cannot rely on an undeclared repository file merely because it exists in the checkout. Source filtering makes newly introduced inputs visible in review and keeps unrelated documentation or local files out of artifact identity.

The component-engine boundary extends the core boundary instead of replacing it. This preserves one definition for shared artifacts while admitting the implementation needed to compile a user project.

## Reproducibility responsibilities

- External sources use immutable revisions and content hashes.
- Repository inputs appear in the applicable source-boundary record.
- Toolchain patches are explicit derivation inputs.
- Flake outputs identify the runtime profile and target they build.
- Package derivations consume verified artifacts rather than compiling from a wider checkout.

Nix supplies an input closure and deterministic build definition. Independent rebuild and byte-inventory comparison provide the evidence that the closure produced matching output.

## Updating the toolchain

1. Change one upstream revision or archive at a time and update its content hash.
2. Rebase or remove the corresponding patches and document the upstream reason.
3. Add any newly consumed repository file to the narrowest source boundary.
4. Build native and Docker component-engine outputs through their repository commands.
5. Run runtime, link, package, and clean-consumer tests affected by the update.
6. Refresh the toolchain inventory and reproducibility evidence with exact identities.

Do not solve a missing source error by admitting the entire checkout. Add the specific file and verify why the derivation consumes it.

## Verification and evidence

`npm run test:nix` builds the primary Wasm proof target without creating a result link. Engine and package commands in [`../package.json`](../package.json) select the named flake outputs used by CI. The [toolchain inventory](../docs/evidence/toolchain-inventory.md), [component input closure evidence](../docs/evidence/component-compilation-input-closure.md), and [Docker engine evidence](../docs/evidence/docker-component-engine.md) record the pinned revisions, boundaries, and executed paths.
