# Upstream patches

This directory contains the reviewed Lean 4.32.2 patches applied by the pinned build.

- [`lean4-4.32.2-emscripten-conditional-pthreads.patch`](lean4-4.32.2-emscripten-conditional-pthreads.patch) makes pthread behavior conditional for the selected Emscripten profile.
- [`lean4-4.32.2-emscripten-runtime-signatures.patch`](lean4-4.32.2-emscripten-runtime-signatures.patch) supplies the runtime signatures required by the component build.
- [`lean4-4.32.2-offline-libuv-source.patch`](lean4-4.32.2-offline-libuv-source.patch) directs the build to the pinned offline libuv source.

Each patch is part of the source closure and artifact identity. New patches require a reproduced extension-point failure and an architecture review.

See the [patch policy](../docs/architecture/patches.md) and [toolchain inventory](../docs/evidence/toolchain-inventory.md).
