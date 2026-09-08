# Demo portfolio audit, 2026-09-08

## Scope

Audit all twelve demos, their generic JavaScript/Wasm adapters, shared proof and benchmark controls, and the assembled GitHub Pages gallery. VO task 1144 tracks this work. React migration and public deployment are separate work.

The audit starts from `c8dec34167674abbd44d1094d095346ab931d8f1`. That revision passed GitHub's core quality, downstream consumer, and performance evidence workflows. The changes below add regression coverage for defects those checks did not exercise.

## Defects corrected

| Area | Reproduction and correction |
| --- | --- |
| Prepared graph ownership | Preparing another Dijkstra, flood-fill, or union-find graph could replace shared state. Each prepared solver now owns an independent handle and has idempotent disposal. Union-find also releases its owned output allocation. |
| Input lifetime | Several asynchronous adapters read caller arrays after awaiting initialization. They now snapshot those arrays before yielding. Aho and LRU also preserve inputs backed by Wasm memory before an allocation can detach the heap view. |
| Disposed matcher | An Aho stream could use a freed matcher. Scan, stream creation, and stream push now reject disposed state. |
| Runtime recovery | A rejected Wasm initialization was cached permanently. Each loader now clears only its own rejected initialization promise. Concurrent retries share one initialization, and a transient download failure can recover without reimporting the module. |
| Numeric bounds | Adapters reject allocations that overflow Wasm32 byte counts. Streaming match positions reject overflow of the exported Uint32 format. |
| Dijkstra parallel edges | Two edges to the same target could disagree with the graph's weight lookup and return an empty route for a reachable target. The public CSR adapter now explicitly rejects parallel targets within a row. |
| Large Dijkstra weights | Bucket count previously grew with the largest weight. Weights above 4095 now use the existing heap search. Lean proves the dispatch and the 4096-slot bucket bound; both branches retain the original CSR correctness certificate. Tests cover full Uint32 weights and path costs larger than Uint32. |
| Lean build guards | Dijkstra's build did not run its existing Lean test module. It now does, including the new large-weight guards. The previous `native_decide` example uses kernel-checked `decide`. |
| Benchmark lifetime | Concurrent preparation could overwrite and leak a prepared benchmark. Preparation is deduplicated within a page lifetime; stale generations are disposed. Page navigation cancels active measurement before released handles can be reused. Invalid timing samples fail before rendering NaN metrics. |
| Dijkstra editing | Touch dragging painted only the initial cell. Pointer capture, interpolation, cancellation cleanup, keyboard activation, and roving focus now support continuous editing. Reduced-motion preferences suppress the opening animation. |
| Aho editing | Text edits could cancel pending pattern compilation, leaving stale matches. Separate debounce/revision handling, empty-pattern reset, significant-space preservation, and restored-page preparation now keep results tied to the editor. |
| Playback and edge cases | LRU stops and disposes playback state during navigation and reconstructs history on restore. All-wall percolation shows finite density; exhausted non-spanning runs stop their controls. Coincident topology nodes no longer produce NaN SVG paths. |
| Proof controls | Copying used `event.currentTarget` after an await. The handler now retains the button and handles denied clipboard access. Source controls remain disabled during loading; missing or mismatched sources cannot enable the checkers. Source tabs support arrow/Home/End navigation. |
| Checker recovery | A blocked popup exposes direct links. Unsupported workspace compression leaves Lean Web available. Checker launch labels remain stable when opening, focusing, or reopening a window. |
| Firefox checker reload | Firefox could restore an enabled checker button after reloading without workspace compression, despite the new page having no checker URL. Both buttons now reset before source verification. Tests cover successful verification followed by unavailable compression or missing proof files. |
| Animation regression test | Dinic's byte-exact paused screenshot assertion intermittently failed on stationary outline antialiasing. The test now compares decoded pixels with a measured noise allowance and checks every packet transform, CSS dash clock, and SVG clock exactly. Running frames must exceed the allowance. |
| Static gallery | The gallery now contains escaped, manifest-derived links in generated HTML. Missing optional build metadata or a failed refresh does not erase those links. Homepage copy covers all twelve generic cores. |
| Artifact identity | Build identity version 2 records SHA-256 and byte lengths for each Wasm binary, loader, and proof receipt. It reports tracked modifications and untracked build inputs instead of attributing modified sources solely to HEAD. |
| Stale documentation | The README now lists the complete gallery. Publishing documentation distinguishes the installed, gated npm adapter from unsupported registry adapters and from actual public release evidence. |

## Reproduction

```sh
npm run demos:verify
npm run check:core
npm run test:docs
npx playwright install --with-deps chromium firefox webkit
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
```

`demos:verify` recompiles each maintained Lean module and its browser bridge, checks proof receipts, validates Wasm, runs differential and structural tests, and enforces the existing benchmark limits. The pinned compiler and shared Lean runtime are reused from the toolchain cache.

The browser audit hosts the assembled artifact at a nested URL. Every demo runs its real Wasm and a cancelled/restarted, prewarmed 100-sample benchmark in each engine. It checks widths from 320 through 1440 pixels, unique IDs, proof sources and receipts, clipboard success/denial, checker payloads, and browser/asset errors. Additional Chromium interaction scripts cover touch dragging, keyboard editing, exact match updates, animated playback, page restoration, and degenerate scenes.

Negative tests cover absent build metadata, a failed manifest refresh, missing/modified/delayed proof sources, unavailable compression, and blocked/reused/closed checker windows. A separate Chromium check blocks the first Wasm initialization for every algorithm, then retries through the same imported module and executes the real algorithm. The gallery is also checked with JavaScript disabled. Generated browser evidence is written to `build/demo-browser-audit/`; failures retain screenshots. The Pages workflow now runs this audit before deployment and uploads its evidence.

## Evidence and remaining limits

- All twelve Lean/Wasm builds, proof receipts, Wasm validation checks, and command-line benchmark limits passed through `npm run demos:verify`.
- The final demo/site suite passed 153 tests. `npm run check:core` passed lint, type checking, and 295 contract tests. `npm run test:docs` passed all 12 documentation tests.
- The twelve proof receipts contain 261 required theorem entries. The audit compiled 33 distinct browser-generated checker bundles locally. Complete solutions had no `sorry` warnings; challenge bundles contained their one intentional placeholder. The reported axioms were restricted to `propext`, `Classical.choice`, and `Quot.sound`. The six Dijkstra/A* payload variants were recompiled after the heap-dispatch change.
- A second `npm run build:demos` preserved all 262 tracked demo files byte-for-byte, including the generated Wasm binaries, loaders, copied Lean sources, and receipts.
- The final browser run started at `2026-09-08T04:26:39.770Z` and passed all 36 demo/engine combinations plus seven Chromium interaction/retry scripts. Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5 also passed the no-JavaScript gallery and failure-recovery checks. Its `build/demo-browser-audit/report.json` records `status: passed` and 43 successful check entries.

These checks use Linux browser engines and emulated narrow/touch views, not physical phones or a screen-reader conformance assessment. Checker payloads are compiled with the pinned local Lean compiler; the hosted Lean WASM and Comparator services are not executed by CI. Benchmark timings vary by host; the browser gate verifies successful measurements and results, while the command-line gate enforces the existing regression budgets.

The browser receipt verifies displayed source consistency. Build-identity hashes identify emitted binaries and receipts; they do not independently prove compiler correctness or authenticate an unsigned download. Direct calls to private Emscripten/C exports are outside the public JavaScript adapter contract.
