# Cargo package evidence

## Result

The canonical Alpha bundle is eligible for Cargo projection on x86-64 Linux with glibc 2.38 or newer. The backend writes a deterministic `.crate` containing generated Rust sources, the native runtime adapter, the Alpha component library, the shared Lean runtime, licenses, assurance, provenance, and canonical identities. Packaging has no compiler access and runs no Cargo, Rust, Lean, C, C++, or linker command.

The generated adapter locates its immutable component relative to `CARGO_MANIFEST_DIR`, loads its typed C symbols without a package build script, and installs one process-wide runtime implementation on the first public call.

## Consumer acceptance

`npm run test:consumer:native` extracts the `.crate` into a clean vendor directory and builds an offline Rust 2021 consumer. The public crate executes real Lean for `Box`, `Payload`, a host closure invoked by Lean, and a returned Lean `Transform`. Rust `Drop` releases retained resources.

[`tests/cargo-package.test.mjs`](../../tests/cargo-package.test.mjs) verifies deterministic archive projection and failure-closed artifact selection. [Native consumer acceptance](native-consumer-acceptance.md) records installed execution.
