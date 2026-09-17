# Shared browser, React and worker corpus, 2026-09-17

VO 1217. The shared corpus adds `browser-javascript`, `browser-react` and `browser-worker` adapters for prepared npm releases. They use the same two independent Lean libraries, host-neutral cases and fresh Lean oracles as the [Node adapters](type-corpus-node-20260917.md). Production generators and the type-support inventory are unchanged.

## Installed packages and static deployments

The npm harness compiles `Shop.Pricing` and `Telemetry.Readings` from ordinary Lake projects with local and pinned offline Git dependencies. It checks independent function signatures, reproduces both npm archives from relocated source trees, removes the author/build trees, verifies the relocated package receipt through the public CLI, and installs each consumer offline with lifecycle scripts and compiler paths disabled.

Each browser profile gets its own npm installation. React, React DOM and Scheduler come from deterministic archives of the repository's installed, locked dependencies. The report records their versions and archive hashes. Vite audits resolved dependency paths and must bundle the installed component and shared runtime's public browser exports. Both WASM assets must survive bundling with their installed bytes unchanged.

After bundling, the harness removes the entire consumer installation and source project, leaving only static deployments. It serves those files at `/corpus/nested/` on a loopback server. Browser contexts block every request outside that deployment. Actual WASM responses must have status 200, the correct deployment path, `application/wasm`, and the installed component/runtime sizes and SHA-256 hashes. Reports retain the static file manifest and its hash, bundled dependency paths, engine versions and per-engine observations.

## Browser behavior

Chromium, Firefox and WebKit each exercise the installed public APIs. JavaScript and worker pages rerun the cases without fetching another copy of the loaded module. The worker fixture checks that execution occurs in `DedicatedWorkerGlobalScope`, reuses its worker, explicitly terminates it, starts a replacement, and requires zero live workers after the final stop.

React runs as both a production build and a development StrictMode build. Two unmount/remount cycles must return the same Lean results. The harness checks effect, cleanup, ignored-result and committed-result counts. A separate check pauses WASM loading, unmounts the component, releases the requests, and verifies that retired effects cannot commit a result. Remounting must then succeed.

Every engine/variant also gets a fresh browser context with missing WASM assets. The page must show an error without publishing results. Restoring the assets and reloading must recover and match Lean. These are consumer lifecycle checks around synchronous Lean exports; they do not establish Lean asynchronous-type support.

## Cases and report validation

Each browser profile executes 112 cases across the two libraries: 80 Lean differential results and 32 expected input rejections with recovery. Twelve array/record cases remain explicit gaps, matching Node's ordinary-source primitive projection. Unsupported arrays, records, `Option Nat` and `Except String Nat` must produce the exact source-admission diagnostics. Browser calls use the same explicit JavaScript host policies as Node.

Every selected browser must execute each required variant. The report validator rejects missing or duplicate engines/variants, wrong results or execution realms, mismatched assets, absent recovery checks, stale React effects, worker leaks, and missing installation-isolation evidence. Synthetic observations test these validation rules only and never enter installed evidence. Browser observations remain separate per engine/variant; repeating a case in another engine does not multiply type-position coverage.

## Local results

The combined npm run passes all **60 tests** in 195.7 seconds. Its ten isolated installations contain 620 profile-level case records: **560 executed and 60 unsupported**, with **160 scoped observed cells and 6,402 gaps**. The browser portion records 24 engine/variant executions: **1,344 executed cases and 144 unsupported records**. These counts exclude lifecycle reruns and recovery calls.

The run used Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5, React/React DOM 19.2.8, Scheduler 0.27.0, Vite 8.2.1, Node 22.23.2 and TypeScript 5.9.3 on x86-64 Debian 12. Lean was 4.32.2, commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. The catalog and 25 source/harness files bind corpus identity `c47e0bcd3836900139478eb39a75a12a9c757072a9dcfd20d5d30e934a8b1bda`.

| Prepared archive | SHA-256 |
| --- | --- |
| `shop-corpus-1.0.0.tgz` | `54553117879cd564941ed959fe9f12e7932624991b2793361760fe6dedf94e10` |
| `telemetry-corpus-1.0.0.tgz` | `876255a13302d11c95ff6bbc7cd051acfc0320dea349f1de0e369818ffbf8bb6` |
| Shared `@lean-bridge/runtime` archive | `2fc6399bbd9f3b2770b83eebf23c51ce70d41c56d9461b71c0a0487c1bcead30` |

These match the Node milestone's archive hashes. The runtime identity remains `2417d3571ed8c55d55f1e52be04de5feb0dd0628de0346653c9412f90ec7549d`. The complete report is `build/type-corpus/browser-javascript-browser-react-browser-worker-node-javascript-node-typescript.json`. A preceding Chromium-only run also passed all 60 tests and both Node profiles.

The combined eight-profile run passes all **60 tests** in 491.3 seconds. Its 16 isolated installations contain **932 executed cases and 60 unsupported cases**, with **283 scoped observed cells and 6,279 gaps**. All three browser engines run again. The report revalidates against the same corpus identity and compares every profile with the same fresh Lean result set, while retaining transport-specific runtime and binding IR identities. It is saved as `build/type-corpus/browser-javascript-browser-react-browser-worker-node-javascript-node-typescript-perl-python-ruby.json`. Native hosts were Perl 5.38.2 threaded, Python 3.11.2 and Ruby 3.3.12, with local native/Perl glibc floor overrides of 2.36. CI retains 2.38.

Core checks pass lint, checked-JavaScript types and 768 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass. Nix is unavailable locally; these results use the local component engine, not the Nix-pinned CI engine.

## CI and remaining work

The npm consumer job runs `npm run test:type-corpus:npm` with all three engines and the pinned component engine. It uploads `type-corpus-npm-<commit>` and fails if execution or the report artifact is missing. The separate browser package-boundary job retains its existing acceptance checks. See the [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) for setup and focused local selections.

Eight of the 17 shared-corpus adapters are implemented. The remaining nine, reviewed-IR execution, other type families and untested positions remain under VO 1217. The type-support inventory retains 656 installed-tested cells. This milestone does not publish to a package registry.
