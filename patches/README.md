# Upstream patches

This directory contains reviewed changes applied to the pinned Lean 4.32.2 source during the Nix build. Each patch addresses a concrete Wasm or offline-build requirement that the pinned upstream tree does not yet satisfy.

## Patch inventory

| Patch | Purpose |
|---|---|
| [`lean4-4.32.2-emscripten-conditional-pthreads.patch`](lean4-4.32.2-emscripten-conditional-pthreads.patch) | Makes pthread-specific build and runtime behavior conditional so the selected Emscripten profile can build without importing the threaded runtime path. |
| [`lean4-4.32.2-emscripten-runtime-signatures.patch`](lean4-4.32.2-emscripten-runtime-signatures.patch) | Supplies the runtime signatures needed when Lean runtime objects cross the component compilation and linking path. |
| [`lean4-4.32.2-offline-libuv-source.patch`](lean4-4.32.2-offline-libuv-source.patch) | Replaces an implicit libuv fetch with the pinned source supplied by the Nix derivation. |

The exact patch order and source revision are defined in [`../nix/wasm-toolchain.nix`](../nix/wasm-toolchain.nix). File names include the targeted Lean version so an upstream update cannot silently reuse an unreviewed patch set.

## Why patches live here

Toolchain patches are build inputs. Keeping them as standalone unified diffs makes the changed upstream lines reviewable, hashable, and reproducible. Runtime shims, generated adapters, and repository implementation changes belong elsewhere; this directory is only for changes applied to external source trees.

A patch should correspond to a reproduced upstream extension-point failure. It should be the smallest change that permits the required target or input model. Broad refactors and speculative cleanup make upstream upgrades harder to audit.

## Patch lifecycle

When adding or revising a patch:

1. Record the failing upstream command and source revision.
2. Confirm that repository configuration or an existing upstream option cannot express the requirement.
3. Create a focused diff against the pinned source.
4. Add it to the Nix derivation in an explicit order.
5. Rebuild the affected runtime, component, and clean-consumer paths.
6. Record patch identity and test evidence in the toolchain inventory.

When updating Lean, test whether upstream incorporated the change. Remove obsolete patches instead of carrying no-op or partially applied diffs forward. If the change remains necessary, regenerate it against the new source and review the complete diff.

## Verification and policy

Patch application is exercised by the pinned Nix runtime and component builds. The [patch policy](../docs/architecture/patches.md) defines when an upstream modification is acceptable. The [toolchain inventory](../docs/evidence/toolchain-inventory.md) records source revisions and patch hashes, while component and runtime evidence records the executed outputs.
