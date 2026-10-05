# First-call loading for ordinary PHP-Wasm packages

Date: 15 September 2026. VO1216, following [installed Chromium acceptance](php-wasm-browser-20260915.md).

## Executed acceptance

```sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

All four tests passed with no skips in 181.9 seconds. Inputs: Lean 4.32.2, Emscripten 3.1.68, PHP headers 8.4.1, `php-wasm` 0.1.0, Node 22.23.2, Vite 8.2.1 and Playwright 1.62.1. The browser was Chromium 152.0.7977.75 on Linux.

The suite builds Willow and Aspen twice through a tarball-installed CLI. Each component has 44 ordinary Lean exports. Relocated builds reproduce the component receipts and every npm and Composer archive. The tests install those archives offline, move the installed application, hide the original source and release paths, and remove compiler commands from the consumer's `PATH`.

The [installed Node helper](../../tests/helpers/php-wasm-packages.mjs) checks seven arrangements: embedded PHP, Composer autoloading and Vite-bundled assets, each with startup and lazy loading, plus embedded PHP with one startup component and one lazy component. Every arrangement executes all 88 exports, strict conversion failures, output-budget recovery and 20 subsequent PHP requests. Duplicate registration does not reload libraries. A test-only probe, loaded after the corpus, reports `[1,2,1,2,2,0]`: one runtime initialization, two component initializations and attachments, and zero live identities.

## Deferred downloads

The package's default descriptor remains the startup choice in `sharedLibs`. Its named `lazy` descriptor goes in `dynamicLibs`. Consumers choose either mode from the same archive without recompiling. Composer applications use `extensions` or `lazy.extensions` and their installed `vendor/autoload.php`.

The [browser helper](../../tests/helpers/php-wasm-browser.mjs) executes both modes under `/nested/app/`, with HTTP caching disabled and external requests blocked. It observes these Lean-library request counts:

| Stage | Startup | Lazy |
| --- | --- | --- |
| PHP startup and autoload | 3 | 0 |
| Invalid input rejected | 3 | 0 |
| First component's complete corpus | 3 | 2 |
| Second component's complete corpus | 3 | 3 |
| 20 subsequent requests | 3 | 3 |

The two first-call downloads are the shared Lean runtime and the called component's extension. The other component remains unfetched until called. Each library is fetched once. During deliberately delayed cold responses, a browser interval continues ticking. Both modes complete all 88 exports and the initialization probe without unexpected requests or browser errors.

The exact [browser guide](../php.md#run-in-a-browser)'s HTML, Vite configuration and JavaScript also build and execute with lazy loading. The page prints `4294967295` after two library requests, without a test probe. The unchanged Node guide retains startup loading and prints the same value.

## Loading failures

The pinned PHP host implements dynamic linking through Asyncify. The generated PHP wrapper validates inputs first, then calls `dl()` if its transport is absent. The lazy descriptor mounts a packaged text registration file alongside the PHP declarations. That marker authorizes the generated loading path; it does not fetch or initialize a library. Its path ends in `.txt` because the host treats preloaded `.so` files as libraries.

The [installed failure checks](../../tests/helpers/php-wasm-loading-failures.mjs) cover disabled `dl()`, missing descriptor registration, a missing component and a missing runtime. Configuration failures make no library requests. A link failure becomes the package's `LeanBridgeError`, and a shared failure state prevents repeated or cross-component lazy attempts in that PHP instance. The application receives its previous PHP error handler back, and ordinary PHP execution still works. Consumers must create a new PHP instance after a link failure.

Chromium separately checks disabled loading and deliberately corrupt runtime bytes. Both produce explicit errors. Calling the other component or repeating the failed call causes no further library requests. Await each `php.run()` before starting another; these checks do not establish concurrent request support.

Descriptor tests reject incompatible runtimes or loaders, conflicting components, namespace and package-path collisions, unsupported hosts, misplaced descriptors, late registration, and registering one component in both modes. The receipt tests reject resealed changes to the registration file, generated component or host JavaScript, Composer source and archive bytes.

## Reproduced artifacts

The package profile is now `php-wasm-copied-loading-v1`. The compiled ABI remains `php-wasm-copied-v1`. Runtime package versions bind the JavaScript coordinator, PHP loader, packaging implementation and runtime identity.

The runtime identity remains `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`. The compiled extension hashes are unchanged:

| Artifact | SHA-256 |
| --- | --- |
| Willow extension | `3a89efb123198569f332744f19cf13146668abba8ca22f092c604b8a18afa7a0` |
| Aspen extension | `0cd7a1ad881a62ed65efeb10c172826d31612a9da9dba13b8c7d07badb4f7630` |
| Shared runtime npm archive | `4adf1d0f8308d163cb01ccf4068d5a23716762c4c6fad648866d931f7fb29b2e` |
| Willow npm archive | `d10c7c1ff04a594ac3e451b4d77005561296ca569a4f97c3a62c56e94e6761a0` |
| Aspen npm archive | `7e6d97dbbf4ee76a2ccd9c4e2a5ca142d1360354f2b94ad46d84a3ee059b4f12` |
| Willow Composer archive | `dd4dcb49982895f433fbe2d8add3b4575b938008e5b83e9eaace384ba7d78817` |
| Aspen Composer archive | `949be46a83b697e76a91def4ba701b6b321bcf72ed085478f06201757f659619` |

## Regression checks

```sh
source scripts/env.sh
LEAN_BRIDGE_PHP_MULTI_PROFILE_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-reporter=spec tests/php-wasm-multi-profile.test.mjs
```

The mixed-profile test passed in 300.6 seconds. It builds JavaScript, native PHP and PHP-Wasm together in both orders, then each pair containing PHP-Wasm. Every selection compiles once per ABI, retains source API identity `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`, and executes installed calls after hiding the sources and build outputs. The explicit glibc override applies only to this local test; the production floor is unchanged. This local check uses the test's direct engine transport, not an installed Nix builder.

The real 32-bit Zend conversion suite passed both checks. Core contracts passed 628 tests with 52 gated skips; all 64 documentation checks and all five CLI tarball checks passed. Existing Alpha PHP-Wasm adapter/package checks passed 5/5. Lint, strict checked JavaScript, type-inventory validation, 16 reference pages, site type checking, site tests and the production site build also passed.

## Remaining work

Other browser engines, browser workers, browser Composer mounts, generic CLI receipt verification and prepared compiler-input distribution remain open. No registry publication occurred. Installed type-inventory coverage stays at 656 cells; this loading milestone does not promote the separate Alpha or reviewed-IR mappings. Package receipts verify release files; loading descriptors do not authenticate network response bytes.
