# Toolchain Inventory

Status: installed and pinned for the architecture-testing POC on 2026-08-08 UTC.

| Tool | Version or identity | Role |
|---|---|---|
| Lean | 4.32.2, `f3b06c705e6c85f5314019d5d3baab0fec5b580c` | source compiler and matched runtime |
| Lake | 5.0.0-src+f3b06c7 | Lean build orchestration |
| elan | v4.2.3 archive, SHA-256 `df0b2b3a439961ffcbb3985214365ffe40f49bc871df04dff268c7d8e21ca8b2` | project-local Lean toolchain manager |
| emsdk | 6.0.6 tag, `9981799f744be74ac67b1c1813ff172f63be0630` | project-local Emscripten SDK manager |
| Emscripten | 6.0.6, `ce75e06884093bcefb86a6b8fd56a5d62a4cc245` | Wasm compilation and main/side linking |
| Node | 22.23.1 system; emsdk also carries 24.19.0 | POC host and test runner |
| Nix | Debian 2.8.0 | derivation/closure experiments; flake input is separately locked |
| WABT | Debian 1.0.32 | Wasm structural inspection |
| wasm-tools | environment-provided | validation and metadata inspection |
| LLVM/Clang | Debian 14 plus Emscripten's pinned upstream toolchain | native probes and symbol inspection |

Reference host: Linux x86_64, 8 logical CPUs, approximately 24 GiB RAM. Exact inventory is printed by `npm run env:check` and must accompany benchmark evidence.

The APT package versions are environment conveniences. Lean and Emscripten correctness claims use the project-owned pinned toolchains under `.toolchains`, which is ignored and reproducible through `scripts/bootstrap-toolchains.sh`.
