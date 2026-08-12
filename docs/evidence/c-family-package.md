# C and C++ package evidence

## Result

The canonical Alpha bundle projects deterministic C11 and C++20 archives for x86-64 Linux with glibc 2.38 or newer. Both contain the process-wide Lean runtime, Alpha component library, pkg-config metadata, CMake package metadata, licenses, assurance, provenance, and canonical identities.

The C package exports `lean_alpha.h` and direct prefixed functions. The C++ package exports `lean_alpha.hpp` with typed copied values, move-only resources, callbacks, returned callables, exceptions, and deterministic RAII. Both CMake packages expose `LeanBridge::Alpha`.

The packaging backend only selects, copies, arranges, and archives canonical artifacts. CMake, pkg-config, and host compilers run after packaging in clean consumer directories.

## Consumer acceptance

`npm run test:consumer:native` builds one clean C consumer and one clean C++ consumer through generated CMake discovery. Both link the packaged component and execute a real Lean `Box`. The C++ consumer also checks identity, a host callback invoked by Lean, and a returned Lean closure.

[`tests/c-family-package.test.mjs`](../../tests/c-family-package.test.mjs) verifies deterministic archives and failure-closed mappings. [Native consumer acceptance](native-consumer-acceptance.md) records real Lean execution.
