# React documentation foundation and Myers pilot

Date: 8 September 2026. VO tasks 1186, 1187, and 1189, under phase 1185 and portfolio plan 1123.

This batch implements the site foundation, documentation shell, and Myers pilot. It does not port the other eleven demos, publish algorithm packages, push commits, or deploy GitHub Pages.

Implementation commits: `cb9eec9` extracts the framework-independent proof services and editor lifecycles; `649d242` adds the React site, documentation pipeline, Myers workbench, and acceptance gates.

## Implemented contracts

The site has fourteen static routes: landing, gallery, a not-found route, eight canonical Markdown guides, two audience hubs, and Myers. GitHub Pages also receives `404.html`. Documentation is rendered into readable HTML without JavaScript. Each guide has a separate client route chunk; Shiki highlighting and MDX compilation run at build time.

The shell supplies a single header, the 1440px outer rail, author/consumer/publisher entry points, guide navigation, mobile disclosures, headings, source links, an outline, search, route focus, and scroll restoration. Search loads on use and validates its index before rendering. HTTP failures and malformed data remain local to search and support direct retry.

Myers runs the existing generic Lean implementation and benchmark workload. Native text bindings retain Unicode code points, CRLF/CR/LF, selections, and composition events. Exact text and model history survive React navigation in memory; full reload resets them. Each editor retains at most 100 edits or 8 MiB of history, without truncating current input. Preset and Swap actions reset history intentionally.

The shared proof service verifies the existing source hashes and constructs both checker payloads. React owns proof controls and cancels source loading on unmount. Checker tabs remain user-owned and can be focused or reopened. The benchmark keeps five excluded warmups and 100 checked samples; its controller has explicit disposal for listeners, observers, frames, and pending preparation.

The current browser document retains one initialized Myers Wasm module. Prepared solver handles are released on route departure, including preparation that finishes after cancellation. The migration does not merge or repackage the twelve standalone runtimes.

## Build and route decisions

Pinned site dependencies include React/React DOM 19.2.8, React Router 8.3.1, Vite 8.2.1, TypeScript 5.9.3, MDX 3.1.1, GFM 4.0.1, and Shiki 4.4.3. Node.js 22.22.0 is the site minimum; CI pins 22.23.2 without narrowing the bridge consumer engine declaration.

`LEAN_BRIDGE_SITE_BASE` is an explicit absolute directory ending in `/`. The router basename retains that slash to match Vite's base during preview-based prerendering. Both `/` and `/lean-bridge/` are tested. The assembler removes the deployment prefix from output directories while retaining it in public URLs.

Canonical guides use explicit route modules and a non-route `Documentation` component. This avoids route-wrapper prop replacement and lazy Suspense placeholders in static HTML. The assembler rejects missing canonical headings and hidden streaming guide fragments before replacing a published artifact.

The assembler stages the site before replacing the previous output, checks Lean sources against their receipts before and after copying, and hashes the final public files. It excludes environment files, unapproved content, tests, source maps, Vite manifests, server bundles, and SPA fallbacks. It rejects output paths that overlap maintained checkout files or the client build.

The original `/lean-myers/` page is a redirect with a readable fallback link. JavaScript preserves query strings and fragments. Raw `.lean`, `.mjs`, `.wasm`, and receipt files remain at their existing URLs. The other eleven demo pages remain standalone and receive shared Home/Demos/Docs navigation.

## Verification

The fresh build and browser reports are retained under `build/demo-browser-audit` and `build/react-site-audit`. These generated reports are not committed. The following checks form the repeatable acceptance commands:

```sh
npm run check:core
npm run site:typecheck
npm run site:test
npm run test:docs
npm run demos:verify
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

Browser coverage includes real Wasm, automatic prewarmed benchmarks, source tabs, clipboard success and denial, missing/tampered proof sources, absent compression, popup recovery, BFCache cancellation/rerun, exact-text paste, native Chromium IME, Undo/Redo after SPA return, full-reload reset, mobile guide navigation, search retry, direct loads, no-JavaScript content, rendered links, and 320-1920px layout checks. External Lean checkers are represented by their verified payloads and mocked window controls; these tests do not claim a fresh hosted-checker execution.

All acceptance commands passed locally. The core suite passed 295 contracts; the site/model suite passed 37 tests; the documentation suite passed 12 tests; and the demo/site suite passed 156 tests. All twelve Lean/C/Wasm builds and twelve algorithm benchmark gates passed. The 261 required theorem entries remain intact. No Lean source, runtime artifact, runtime API, or benchmark workload changed in this batch.

The portfolio browser audit passed all 36 demo/engine combinations and seven Chromium interaction scripts. The React audit passed all fourteen static routes and its four additional Chromium scripts at both `/` and `/lean-bridge/`. Engines were Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5. The prefix build preserves old Myers query strings and fragments and matches all 36 runtime/loader/receipt hashes from the root build. Development Strict Mode also passed the Myers, proof-control, benchmark, and search lifecycle checks.

To repeat the separate prefix audit without replacing the root artifact:

```sh
node --input-type=module -e 'import {assembleSite} from "./scripts/build-demos-site.mjs"; await assembleSite({base:"/lean-bridge/",output:"build/github-pages-prefixed"});'
SITE_ARTIFACT_ROOT=build/github-pages-prefixed SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

## Performance method

The pre-port artifact was captured at commit `2bb22df8d5b2837a38e8034650d463eb7024d70c`, source state clean. Its homepage fetched 1,257 bytes of estimated gzip JavaScript; standalone Myers fetched 38,382 bytes and a 1,332,037-byte Wasm file. These are per-file gzip estimates, not HTTP compression measurements.

The React landing and sampled guides are gated at 200 KiB gzip of fetched JavaScript. Prose routes are checked for zero Wasm/runtime/benchmark requests and no search-index request before use. Cold load and hydration times are observations from local browsers, not machine-independent speed claims. Myers measurements and repeated-navigation memory observations are recorded separately from algorithm benchmark timing.

The root performance audit at 05:45 UTC measured:

| Surface | Before React | React pilot |
| --- | --- | --- |
| Landing JavaScript, estimated gzip | 1,257 bytes | 108,014 bytes |
| Myers JavaScript, estimated gzip | 38,382 bytes | 137,398 bytes |
| Myers Wasm download | 1,332,037 bytes | 1,332,037 bytes |
| Cold Myers ready time, local observation | 945.7 ms | 352.7 ms |

The port adds 99,016 bytes of compressed JavaScript to Myers. The different cold-load timings were captured during concurrent local work and do not establish a speed improvement. A separate navigation-budget run measured 116,470 bytes for the Lean author guide and 114,306 bytes for the JavaScript/TypeScript guide, below the 204,800-byte limit. Those prose pages requested no Wasm.

After three warmup visits and twelve measured Myers-to-docs cycles, all fifteen prepared handles had matching releases, with zero invalid releases and zero live handles on the documentation page. Collected DOM nodes stayed at 351, listeners at 200, and attached documentation elements at 171. JavaScript heap grew from 5,096,980 to 5,648,644 bytes; this byte delta is recorded, not treated as proof of zero retention. The cached Wasm linear memory stayed at 17,039,360 bytes. No offscreen benchmark workload was requested. The prefixed run produced the same handle, DOM, listener, and Wasm-memory results.

## Remaining work

VO 1188 ports the other eleven demos, beginning with sweep-and-prune and Dinic. VO 1190-1193 expand executable author tutorials, downstream consumption, publication flows, reference, and concepts. This batch links and renders the existing canonical material; it does not claim those expanded flows are complete. VO 1194 retains the final site-wide acceptance gate before publication.
