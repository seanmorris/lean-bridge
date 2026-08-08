# Toolchain Inventory

Status: installed and pinned for the architecture-testing POC on 2026-08-08 UTC.

| Tool | Version or identity | Role |
|---|---|---|
| Lean | 4.32.2, `f3b06c705e6c85f5314019d5d3baab0fec5b580c` | source compiler and matched runtime |
| Lake | 5.0.0-src+f3b06c7 | Lean build orchestration |
| elan | v4.2.3 archive, SHA-256 `df0b2b3a439961ffcbb3985214365ffe40f49bc871df04dff268c7d8e21ca8b2` | project-local Lean toolchain manager |
| emsdk | 6.0.6 tag, `9981799f744be74ac67b1c1813ff172f63be0630` | project-local Emscripten SDK manager |
| Emscripten | 6.0.6, `ce75e06884093bcefb86a6b8fd56a5d62a4cc245` | Wasm compilation and main/side linking |
| libuv | v1.48.0, `e9f29cb984231524e3931aa0ae2c5dae1a32884e` | Lean runtime dependency built by its pinned CMake path |
| Node | 22.23.1 system; fixed Emscripten host 24.19.0 | POC test runner and Emscripten host |
| Nix | Debian 2.8.0; `nixos-24.05` flake lock | exact toolchain and full sandboxed POC build |
| WABT | Debian 1.0.32 | Wasm structural inspection |
| wasm-tools | environment-provided | validation and metadata inspection |
| LLVM/Clang | Debian 14 plus Emscripten's pinned upstream toolchain | native probes and symbol inspection |

Reference host: Linux x86_64, 8 logical CPUs, approximately 24 GiB RAM. Exact inventory is printed by `npm run env:check` and must accompany benchmark evidence.

The APT package versions are environment conveniences. `scripts/bootstrap-toolchains.sh` installs a project-local pinned Lean/emsdk path under ignored `.toolchains` for quick iterative development. The authoritative x86-64 closure is `nix/wasm-toolchain.nix`: fixed-output hashes pin the Lean 4.32.2 host release, Lean source commit, libuv source commit, Emscripten 6.0.6 release archive, and Node 24.19.0. `nix build .#wasm-poc` consumes those immutable inputs, gives Emscripten only a derivation-local writable cache, builds both profiles, verifies the graph's artifact hashes, and runs the suite without consulting `.toolchains` or a user cache.

Lean 4.32.2's stock Emscripten runtime sources fail on two ABI signature mismatches and force pthread settings into the nominally single-threaded profile. Two minimal runtime-semantic patches address those failures. A third build-only patch lets Nix inject the already pinned libuv tree into Lean's existing external-project step, eliminating its network fetch without changing runtime sources. All are documented in [the Lean runtime link spike](lean-runtime-link-spike.md) and [patch policy](../architecture/patches.md).
