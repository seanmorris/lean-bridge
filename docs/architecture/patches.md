# Lean and Emscripten Patch Policy

## Current decision

**The pinned Lean 4.32.2 build currently requires two minimal Emscripten-runtime patches and one build-only offline-source patch.** The architecture-testing POC admitted each only after the stock behavior failed a required invariant. They are version-locked, applied to disposable content-addressed source copies, and kept independent so each can be removed when upstream catches up:

- [`lean4-4.32.2-emscripten-runtime-signatures.patch`](../../patches/lean4-4.32.2-emscripten-runtime-signatures.patch) corrects two Emscripten stub signatures and is required to compile the runtime;
- [`lean4-4.32.2-emscripten-conditional-pthreads.patch`](../../patches/lean4-4.32.2-emscripten-conditional-pthreads.patch) makes Emscripten's `-pthread` setting follow Lean's existing `MULTI_THREAD` option and is required for the ordinary non-threaded browser profile; and
- [`lean4-4.32.2-offline-libuv-source.patch`](../../patches/lean4-4.32.2-offline-libuv-source.patch) optionally copies a caller-supplied libuv source tree into Lean's existing external-project build, allowing a network-disabled Nix derivation to use the exact fixed-output source.

The stock build reaches the runtime's Emscripten stubs and fails because two definitions disagree with their headers and generated Lean ABI:

- `lean_uv_event_loop_alive` is declared as returning `uint8_t` for `BaseIO Bool`, but its Emscripten definition returns `lean_obj_res`;
- `lean_uv_os_get_group` is declared and called with a `uint64_t gid`, but its Emscripten definition accepts no argument.

The signature patch changes only those two Emscripten stubs. The same mismatches were still present on upstream `master` commit `f29e9e488ea8242c875806e4b0564820c2d553b2` when checked on 2026-08-08, so there is not yet an accepted upstream equivalent to prefer.

The conditional-pthreads patch changes three lines of policy around the existing `EMSCRIPTEN_SETTINGS`: base Wasm settings remain common, while `-pthread` is appended only when `MULTI_THREAD` is true. It adds no bridge-specific option and preserves stock threaded behavior. Without it, `MULTI_THREAD=OFF` still imports shared memory, requires SharedArrayBuffer/cross-origin isolation in browsers, emits experimental dynamic-linking warnings, and imposes pthread memory-growth costs. With it, the default `browser` profile owns one unshared growable memory while side modules import that same memory; the `threaded` opt-in profile retains one shared memory. Profile and complete ordered patch-set identity are part of the build cache key.

The offline-libuv patch changes build acquisition only. When `LEAN_WASM_LIBUV_SOURCE` is unset, the stock pinned Git path remains in effect. When it is set, CMake copies that immutable source into the disposable external-project directory, makes the copy writable, and then runs Lean's existing libuv Emscripten patch/configure/build steps. The Nix derivation verifies the libuv commit through the fixed-output source identity and a generated marker before configuring Lean. No libuv or Lean runtime implementation is changed by this patch.

No additional bridge-specific Emscripten patch is currently required beyond the two runtime patches above. The rest of the design uses existing extension points:

- Lean-generated C and the public runtime/FFI surface;
- explicit C/C++ adapter code and generated module initializers;
- Lake/custom facets for Wasm link inputs and generated artifacts;
- Emscripten main/side modules, exported symbols, preload/locator hooks, and JS libraries or `EM_JS` where appropriate;
- generated ESM descriptors and application-level registries.

The cross-compiled `Init` build requires target flags to be supplied through `LEANC_INTERNAL_FLAGS` when configuring Lean's stage CMake directly. This is configuration, not a source patch. The build invokes the generated `stdlib.make` so `LEAN_CC=emcc` is authoritative, and it audits one linked archive member as wasm32. Direct Lake invocation is forbidden because it can silently emit host objects.

## Patch admission test

A proposed upstream or fork patch is admitted only after a minimal reproducible experiment proves that existing hooks cannot meet a required invariant. The patch record must include:

1. exact pinned upstream revision and failing command;
2. smallest source-level blocker and why an adapter cannot solve it;
3. effects on all eight permanent lenses;
4. smallest isolated patch surface and feature gate;
5. ABI, compatibility, maintenance, and security cost;
6. tests covering success, failure, and no-patch behavior;
7. upstream contribution path and fallback if rejected; and
8. migration/removal conditions.

Local Emscripten patches in existing user repositories are relevant evidence, especially for bundler asset discovery, but must not be silently copied into this project or made mandatory without this test. Accepted upstream equivalents should be preferred when they satisfy the same requirement.
