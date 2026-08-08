# Lean and Emscripten Patch Policy

## Current decision

**No Lean or Emscripten patch is currently required by the recommended baseline.** The design first uses existing extension points:

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
