# Native consumer acceptance

Verified 2026-08-11 on x86-64 Linux with glibc 2.38 or newer.

The pinned Nix build produces one process-wide Lean runtime and one Alpha component library. Both libraries use an `$ORIGIN` search path, contain no Nix store reference, and dynamically require only the platform glibc libraries. The artifact manifest records the measured glibc floor. The canonical release bundle binds those exact libraries to deterministic Python, Cargo, C, and C++ packages. `npm run test:consumer:native` installs each package in a clean directory and executes the generated public API.

The acceptance calls cover retained `Box` identity and disposal, copied `Payload` values, a host callback invoked by Lean, and a Lean closure called by the host. Python uses its generated lazy native adapter. Rust uses its generated runtime implementation. C uses the generated C11 API. C++ uses the generated C++20 RAII projection.

The test invokes no Lean compiler from any consumer directory. Package generation copies the immutable native libraries recorded by `native-artifacts.json`.
