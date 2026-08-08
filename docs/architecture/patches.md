# Lean and Emscripten Patch Policy

## Current decision

**The pinned Lean 4.32.2 runtime requires one minimal Emscripten-only source patch to compile.** The architecture-testing POC proved this after first using the existing CMake extension point unchanged. The version-locked patch is [`patches/lean4-4.32.2-emscripten-runtime-signatures.patch`](../../patches/lean4-4.32.2-emscripten-runtime-signatures.patch).

The stock build reaches the runtime's Emscripten stubs and fails because two definitions disagree with their headers and generated Lean ABI:

- `lean_uv_event_loop_alive` is declared as returning `uint8_t` for `BaseIO Bool`, but its Emscripten definition returns `lean_obj_res`;
- `lean_uv_os_get_group` is declared and called with a `uint64_t gid`, but its Emscripten definition accepts no argument.

The patch changes only those two Emscripten stubs. It is applied to a content-addressed build copy; the pinned toolchain checkout remains pristine. The same mismatches were still present on upstream `master` commit `f29e9e488ea8242c875806e4b0564820c2d553b2` when checked on 2026-08-08, so there is not yet an accepted upstream equivalent to prefer.

No Emscripten patch is currently required. The rest of the design uses existing extension points:

- Lean-generated C and the public runtime/FFI surface;
- explicit C/C++ adapter code and generated module initializers;
- Lake/custom facets for Wasm link inputs and generated artifacts;
- Emscripten main/side modules, exported symbols, preload/locator hooks, and JS libraries or `EM_JS` where appropriate;
- generated ESM descriptors and application-level registries.

## Patch admission test

A proposed upstream or fork patch is admitted only after a minimal reproducible experiment proves that existing hooks cannot meet a required invariant. The patch record must include:

1. exact pinned upstream revision and failing command;
2. smallest source-level blocker and why an adapter cannot solve it;
3. effects on all six permanent lenses;
4. smallest isolated patch surface and feature gate;
5. ABI, compatibility, maintenance, and security cost;
6. tests covering success, failure, and no-patch behavior;
7. upstream contribution path and fallback if rejected; and
8. migration/removal conditions.

Local Emscripten patches in existing user repositories are relevant evidence, especially for bundler asset discovery, but must not be silently copied into this project or made mandatory without this test. Accepted upstream equivalents should be preferred when they satisfy the same requirement.
