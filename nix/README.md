# Pinned Nix inputs

This directory defines immutable toolchain inputs and source boundaries consumed by the root [`flake.nix`](../flake.nix).

- [`wasm-toolchain.nix`](wasm-toolchain.nix) pins Lean, Emscripten, Node, libuv, source archives, and hashes.
- [`core-source-boundary.json`](core-source-boundary.json) lists the reviewed files available to core derivations.
- [`component-engine-source-boundary.json`](component-engine-source-boundary.json) lists the additional files available to component-engine derivations.

Source boundaries prevent a derivation from gaining undeclared repository inputs. Build and package outputs remain defined in the root flake.

See the [toolchain inventory](../docs/evidence/toolchain-inventory.md) and [component input closure evidence](../docs/evidence/component-compilation-input-closure.md).
