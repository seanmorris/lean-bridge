# Installed ordinary PHP-Wasm packages in Chromium

Date: 15 September 2026. VO1216, following the public CLI milestone `17b4437bb5e745d7ed891a699d1fe6b4aacd5427` and CI bootstrap correction `d19e815e66010a1383f06b36919592aee64bd9e1`.

## Executed checks

```sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

All four tests passed with no skips in 151.3 seconds. Inputs: Lean 4.32.2, Emscripten 3.1.68, PHP headers 8.4.1, `php-wasm` 0.1.0, Node 22.23.2, Vite 8.2.1 and Playwright 1.62.1. The browser was Chromium 152.0.7977.75 on Linux.

The suite builds Willow and Aspen twice through the offline-installed CLI, installs the resulting npm and Composer archives offline, relocates the installed application, and hides its original source, release and archive directories. The shared runtime identity and all package hashes still match the [public CLI record](php-wasm-cli-20260915.md).

The existing Node checks pass for embedded PHP sources, Composer autoloading and Vite-bundled assets. The new [browser helper](../../tests/helpers/php-wasm-browser.mjs) serves only the relocated Vite output, the unchanged pinned PHP host and a test-only initialization probe. It blocks all requests outside that local HTTP origin.

The application runs under `/nested/app/`. Its compiled descriptor and asset URLs are relative to that nested path. The PHP host is served separately under `/php-host/`.

| Check | Result |
| --- | --- |
| Ordinary exports | 44 per component, 88 executed in Chromium |
| Copied values | All 16 primitives, arrays, acyclic records and nested values |
| Conversion errors | Invalid inputs fail; calls recover after output-budget failures |
| Exact integers | Upper-width values survive the 32-bit PHP boundary through generated `BigInteger` |
| Independent implementations | Willow and Aspen retain different results despite shared Lean module names |
| Repeated execution | 20 PHP requests after the full corpus |
| Duplicate registration | Registering Willow twice does not initialize or fetch it twice |
| Runtime composition | Probe reports one runtime initialization and two component initializations |
| Library requests | Exactly one shared-runtime fetch and one fetch per component, with HTTP caching disabled |
| Unexpected requests/errors | No external requests, missing local assets, failed requests or JavaScript errors |

## Executable consumer guide

The suite copies the consolidated [PHP guide](../php.md#run-in-a-browser)'s `index.html`, `browser.mjs` and `vite.config.mjs` verbatim into an installed consumer. Vite builds that application; Chromium loads the result under `/nested/app/guide/index.html`. The page prints `4294967295`, makes exactly two library requests for its one component and shared runtime, and reports no PHP or browser error. This guide check uses no test-only probe.

Vite bundles the Lean descriptor and its assets. It does not bundle the PHP host: `/php-host/PhpWeb.mjs` is an external import, and the host retains its packaged directory layout. The stateless example sets `autoTransaction: false`.

## CI and remaining work

The ordinary PHP-Wasm step in the downstream consumer workflow installs Chromium and enables both test flags. A failure in the browser check fails that step, the PHP result record and the final consumer gate. This requirement is covered by the documentation contract test.

Ordinary packages were startup-only at this milestone. The subsequent [first-call acceptance](php-wasm-lazy-20260915.md) adds lazy loading in Node and Chromium. Other browser engines, worker execution, browser Composer mounts, generic CLI receipt verification and prepared compiler-input distribution remain open. This browser milestone did not change production loaders or archive bytes, publish a registry package, or promote the separate Alpha/reviewed-IR type evidence. Installed type-inventory coverage remains 656 cells.
