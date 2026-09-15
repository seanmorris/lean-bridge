# Ordinary PHP-Wasm builds through the public CLI

Date: 15 September 2026. VO1216, following the installed-package milestone `cac8b0897bd6035c591e4fd07ff5f743f90d1f4d`.

## Public build and configuration

`lean-bridge build --target php-wasm` now accepts ordinary Lake source projects. `targets.php-wasm.npm` and `targets.php-wasm.composer` each contain only `name` and `version`. Configuration validation and JSON Schema reject ambiguous top-level package fields, reserved runtime names, malformed coordinates and unsupported options.

The command captures source inputs, verifies the pinned wasm32 runtime, compiles fresh Lean exports and packages the startup descriptor. Output remains private until the component, package inventory and original source identities pass their checks. Existing output directories, supplied Binding IR, the universal fixture, unsupported cache directories and missing compiler inputs fail without exposing a release.

## Installed CLI acceptance

```sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

The suite packs and installs the CLI offline, then invokes its public command for Willow and Aspen. Each project supplies 44 ordinary exports and compiles twice from relocated sources. Both package sets execute after the original source and build directories disappear. Embedded PHP, Composer autoloading and Vite-bundled assets each call all 88 exports, repeat requests and share one runtime. The ordinary consumer guide additionally executes the exact upper `UInt32` value, `4294967295`.

Pinned inputs: Lean 4.32.2, Emscripten 3.1.68, PHP headers 8.4.1 and `php-wasm` 0.1.0. The installed host is Node 22.23.2. Runtime identity: `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`.

| Archive | SHA-256 |
| --- | --- |
| Shared npm runtime | `88cb5998a91d222bb8244b3d11c98d0962e5c53e2989a143345971ee403e927a` |
| Willow npm component | `ac998759af878fb19797c34f17eb16f65551b4c84cf0a0a0607fced0ca611039` |
| Willow Composer API | `d53162263448e916b13de82daea0346e686d0721a94ab4a8e30f797b4c0dec46` |
| Aspen npm component | `824bc65d861f16b24536f138791ae1df2bd3f4b4ef4a27d0dfb7f01eeeb08993` |
| Aspen Composer API | `17e07591a415ed368f346968224e4c88fa8499200e240af6ce049b883fdba3f0` |

## Combined release acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_PHP_MULTI_PROFILE_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-reporter=spec tests/php-wasm-multi-profile.test.mjs
```

The locked Telemetry fixture imports local and pinned Git dependencies through a custom source layout. It uses aliases, notation and inferred function signatures. Its source API identity is `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`.

The test builds npm/native-PHP/PHP-Wasm, reverses that target order in a relocated checkout, then builds each PHP-Wasm pair separately. Every selection compiles once per ABI and retains each requested package. The three-profile manifests reproduce exactly; every archive matches its recorded digest. Native models remain 64-bit and PHP-Wasm models remain 32-bit. After offline installation, source/build directories are hidden and each selected consumer returns `66` for the same input. The native/PHP-Wasm pair succeeds with the JavaScript runtime path deliberately unavailable.

The local check runs the real component compiler through an injected command transport. CI invokes the pinned Nix component engine. Native PHP uses PHP 8.2.33 NTS, Composer 2.5.5 and the explicit local glibc 2.36 test override; the production floor remains 2.38.

Unit tests reject source, compiler, extractor, pointer-width and API drift, duplicate aliases and unsupported targets. A late PHP-Wasm failure removes an already staged npm result. Existing cancellation checks and the relocated npm/Perl Telemetry acceptance also pass.

## Remaining work

At this milestone, ordinary loading was startup-only and Vite assets had executed in Node-hosted PHP, not a browser engine. The subsequent [Chromium acceptance](php-wasm-browser-20260915.md) executes those installed packages and the browser guide in a real browser. Lazy loading, generic CLI receipt verification and prepared compiler-input distribution remain open. No registry publication occurred. Installed type-inventory coverage remains 656 cells; neither milestone promotes the separate Alpha or reviewed-IR mappings.
