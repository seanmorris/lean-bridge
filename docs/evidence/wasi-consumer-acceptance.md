# WIT and WASI consumer acceptance

Verified 2026-08-11 on x86-64 Linux with glibc 2.38, Wasmtime C API 42.0.1, and wasm-tools 1.245.1. On hosts with an older system glibc, the local test command invokes the archive through the pinned Nix glibc loader. The packaged executable itself retains the standard `/lib64/ld-linux-x86-64.so.2` interpreter for ordinary installations in the supported profile.

The release archive contains generated WIT, a validated Component Model binary, an independent host executable, Wasmtime, and the same process-wide native Lean runtime used by the other native packages. The component imports one typed `u32 -> u32` host function and exports it through a canonical lift and lower adapter.

`npm run test:consumer:wasi` extracts the archive into a clean directory and invokes the exported component function. Wasmtime enters the component, the component calls its generated native host import, and the host constructs and reads a real Lean `Box` through `lean_alpha.h`. The value `42` returns through the Component Model call. `wasm-tools validate --features component-model` independently validates the packaged component.

The Wasmtime archive is pinned by version, URL, and SHA-256 in `flake.nix`. The host and all packaged shared libraries are checked for Nix store references before their manifest is written.
