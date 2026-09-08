# React sweep-and-prune and Dinic migration

Date: 8 September 2026. First two ports under VO 1188, within phase 1185 and portfolio plan 1123.

Commits `1beacee` and `2f28d8d` add framework-independent sessions, disposable solver controllers, React workbenches, shared benchmark configuration, and browser checks. Commit `a89b456` prevents Firefox from restoring stale proof-control states during reload. No push or deployment occurred.

## Behavior retained

Sweep-and-prune retains live pointer and touch dragging, keyboard nudges, axis selection, candidate and overlap inspection, deterministic scene seeds, projection playback, and motion controls. A displayed pair set belongs to the exact Lean-checked input snapshot. Offscreen animation stops without preventing an initial or manually requested solve.

Dinic retains capacity inputs and sliders, selectable links, the widening example, flow packets, the minimum-cut view, reduced motion, and mobile graph scrolling. Its initial flow is nine; widening C to Sink raises the example to fourteen.

Inputs and selections survive React navigation in memory. A full reload restores the example. Route departure cancels work, disconnects observers, stops animations, and releases prepared handles, including preparations that complete late. Each visited algorithm retains one initialized module for the browser document.

Both routes use the shared proof viewer, receipt layout, and automatic benchmark. Workloads, five excluded warmups, 100 measured comparisons, and result checks are unchanged. Old URLs redirect with query strings and fragments intact; raw artifacts keep their addresses.

## Verification

- Core checks: lint, type checking, and 295 contracts passed.
- Site/model/service checks: 57 tests passed. Documentation checks: 12 passed before the subsequent documentation expansion.
- All twelve Lean/C/Wasm builds passed. The assembled demo/site suite passed 156 tests and all twelve algorithm benchmark gates passed.
- All 36 demo/engine combinations passed across Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5. Seven existing Chromium interaction scripts also passed.
- The React audit passed all sixteen static routes and five additional Chromium scripts at both `/` and `/lean-bridge/`.
- The graph lifecycle gate passed in development Strict Mode and production. It covers stale imports, input restoration, full reload, hidden tabs, restored pages, touch capacity edits, proof sources, and benchmark cancellation/rerun.

The portfolio run initially exposed Firefox restoring enabled proof buttons before hydration even when sources were still loading or had failed. The fix opts those controls out of browser state restoration and guards empty checker URLs. The gate now holds a source request and checks all source/checker controls, then repeats the checks after a successful load followed by failure.

All 36 Wasm, loader, and receipt hashes match the pre-port revision `a38ebcd3968b60d9a2885a3e8a7ddc631fdc40f9` and agree between root and prefixed builds. All 261 required theorem entries remain. No Lean implementation, proof, runtime API, or benchmark workload changed.

The proof checks validate source receipts and external-checker payloads with controlled popup behavior. They do not claim a fresh hosted-checker execution.

## Resource and load observations

After three warmup visits and six measured return visits, both production pages left exactly 351 collected DOM nodes and 200 listeners on the documentation route. Each snapshot recorded zero live prepared handles, outstanding input/output buffers, animation frames, or observers. Native prepare/release counts matched, with no invalid releases or frees.

A heap snapshot found a Dinic resize updater retained by React's pending update queue. Its lexical scope captured the graph DOM. Queuing a plain dimensions object removed that retention; the original resource limits then passed. Proof-workspace compression also accepts cancellation on unmount.

Cold-load measurements use isolated Chromium pages at 1440 by 1000, reduced motion, and per-file gzip level nine. The legacy baseline came from the clean pre-port artifact; timings were captured during other local work.

| Page | Legacy JavaScript, gzip estimate | React JavaScript, gzip estimate | Wasm bytes, unchanged |
| --- | ---: | ---: | ---: |
| Sweep-and-prune | 40,339 | 138,822 | 1,311,483 |
| Dinic | 40,637 | 138,125 | 1,338,944 |

These figures describe the graph-port artifact before the next documentation expansion. They are download estimates, not algorithm latency or evidence of a speed improvement. Reports remain under `build/react-site-audit/` and `build/demo-browser-audit/`.

## Continue the migration

Myers, sweep-and-prune, and Dinic now use React. Nine standalone demos remain under VO 1188: Dijkstra, flood fill, union-find, topological sort, Aho-Corasick, LRU, A*, Tarjan, and token bucket. The user selected documentation expansion as the next batch. Publication remains separate.
