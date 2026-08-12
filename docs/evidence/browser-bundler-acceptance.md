# Browser, bundler, worker, and React acceptance

Status: verified for the architecture POC. Raw browser ESM, a module worker, Vite, Rollup, Webpack, and React Strict Mode execute the real Lean runtime and Alpha side module through the native generated API.

## Command

```sh
npm ci
npx playwright install chromium
npm run test:browser-bundlers
```

The command rebuilds the unthreaded browser launcher, regenerates the JavaScript projection artifact, builds each consumer, launches Chromium, and calls Lean. It writes per-consumer import-to-first-call measurements to `build/browser-bundler-tests/report.json`.

## Pinned acceptance environment

| Tool | Version |
|---|---:|
| Playwright and Chromium runner | 1.62.1 |
| Vite | 8.2.1 |
| Rollup | 4.62.4 |
| Webpack | 5.109.2 |
| React and React DOM | 19.2.8 |
| Rollup JSON plugin | 6.1.0 |
| Rollup import-meta asset plugin | 3.0.0 |

`package-lock.json` fixes the transitive JavaScript dependency graph. These tools change more frequently than Lean, Emscripten, and the runtime ABI. They remain a separate acceptance layer so a bundler update cannot silently change the compiler or runtime closure.

## What the matrix proves

Every fixture performs the same operations:

1. Import an ordinary ESM entry.
2. Create one lazy runtime.
3. Load Alpha as an independently compiled side module.
4. Construct `new Box(42)`, call `read()` and `identity()`, then dispose it.
5. Pass a typed record containing a boolean, unsigned integer, UTF-8 string, `Uint8Array`, and integer array through Lean without JSON serialization.
6. Observe exactly one Lean runtime initialization.

React's development Strict Mode runs the effect twice. Both calls share one runtime promise, one library loader, and one initialization domain. The active effect receives the result after two effect entries, while the runtime initialization counter remains one.

The browser launcher excludes Node built-ins. The build emits the JavaScript binding projection before runtime use, so a browser never imports the binding compiler or Node's hashing implementation. Literal `new URL(..., import.meta.url)` references expose the main Wasm file and side modules to bundlers. A generated locator map translates the bundler's hashed asset names back into Emscripten's dynamic-library lookup.

Vite and Webpack need no Lean Bridge plugin. Rollup uses its standard JSON plugin and import-meta asset plugin because core Rollup does not load JSON or copy `new URL` assets. Application source contains no Wasm initialization, linker calls, handles, underscore-prefixed symbols, or ownership flags.

## First-call sample

One Chromium run on 2026-08-09 produced these import-to-first-call values after the Lean artifacts and JavaScript dependencies were built:

| Consumer | Time |
|---|---:|
| raw ESM | 86.0 ms |
| module worker | 75.2 ms |
| Vite output | 81.0 ms |
| Rollup output | 87.0 ms |
| Webpack output | 81.1 ms |
| React Strict Mode | 136.4 ms |

The machine-readable report records each run instead of enforcing these host-dependent values as thresholds.

## Adoption boundary

A JavaScript application can replace an unverified package with the generated package at its import site and keep normal function and class calls. Handwritten Wasm loaders and wrapper functions disappear. The package retains the runtime singleton, asset map, marshaling, identity cache, and cleanup protocol.

The Python projection emits ordinary modules, frozen value classes, context-managed resources, callables, exceptions, iterators, awaitables, and stubs from the same Binding IR. The native Python wheel now installs this projection with its component and lazy runtime adapter. [PyPI package evidence](pypi-package.md) records that release path.
