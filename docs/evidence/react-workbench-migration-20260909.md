# Remaining React workbench ports

Date: 9 September 2026. VO task 1188, within phase 1185 and portfolio plan 1123. Working-tree implementation based on commit `15a9bc7dd958e7b599de91d6417a20acb9c0e68e`; no deployment is part of this change.

## Presentation and ownership

All twelve demos have canonical React routes under `/demos/lean-<algorithm>/`. This batch ports Dijkstra, flood fill, union-find/percolation, topological sort, Aho–Corasick, LRU, A*, Tarjan, and token bucket. Myers, sweep-and-prune, and Dinic were already React workbenches.

React renders each page's header, guide, controls, drawing containers, benchmark scaffold, and proof viewer. `WorkbenchHost.tsx` loads the editor on the client. The scoped controllers retain the existing grid, canvas, graph, and uncontrolled-input interactions; they do not inject complete HTML pages or use iframes. Shared layout, proof, receipt, and benchmark styles stay separate from each algorithm's scoped styles.

`workbench-scope.mjs` owns listeners, timers, animation frames, resize observers, pointer capture, and prepared handles. Cleanup copies model inputs before releasing resources. A handle that resolves after unmount is disposed instead of reaching a departed editor. Explicit disposal is idempotent, and prepared solver functions retain their identity rather than acquiring a proxy in the timed call path.

Inputs survive client navigation in page memory. Playback returns paused. A full reload starts a new session. The restored inputs include walls and endpoints, room maps and ledges, keys and door settings, maze seeds and permanent walls, graph names and connections, patterns and text, cache history, weighted terrain, component selections, and bucket history and balance. Token-bucket restoration reconstructs its balance through the compiled API at the saved virtual timestamp.

Original raw runtime, Wasm, Lean source, and receipt URLs remain valid. Every old page URL redirects to its React route while preserving query and fragment; no-JavaScript visitors receive a normal link. Source-preview HTML pages mount the same scoped controllers.

No Lean source, C bridge, generic runtime API, reference algorithm, or benchmark workload changed. The existing five excluded warmups and 100 measured comparisons remain in place. Proof viewers retain source hashing, syntax highlighting, both external checkers, and theorem-specific comparator challenges. Pages with no supporting source files omit the empty supporting-source picker.

The UI builds reused the unchanged Lean/C artifacts and validated their receipts and hashes. This migration did not require recompiling those artifacts.

## Acceptance checks

The assembled site contains 69 React routes, including twelve demos and 54 documentation routes. Root and `/nested/lean-bridge/` builds preserve canonical pages, aliases, raw assets, and build identities.

- Core and site type checks passed.
- The complete twelve-demo browser suite passed in Chromium 152, Firefox 153, and WebKit 26.5.
- The 69-route site audit passed at the root in Chromium and under the nested base in all three engines.
- All 69 site unit tests and 25 assembled-artifact tests passed.
- All 34 documentation tests and the documentation proof check passed.
- All nine ports passed input restoration and six repeated route lifetimes in Chromium, Firefox, and WebKit.
- The same nine lifecycle cases passed against the development server with React Strict Mode enabled. Benchmark comparisons were checked separately against the production artifact.
- Flood-fill checks cover drag painting, key placement, two-direction ledge painting and erasure, door-key changes, open/closed controls, and restoration in all three engines.
- Failed Wasm downloads recover through the workbench retry button for every new port. Pending controller imports can leave the route and return without stale mounts.
- Original source-preview pages load and compute without console errors.

Native instrumentation counted each prepared handle's creation and release. Every measured route departure left zero live handles, zero workbench observers, and zero animation frames. Chromium garbage collection found no growing detached-DOM or listener counts across the measured visits. Dijkstra, flood fill, union-find, topological sort, and Aho–Corasick retain their existing document-lifetime scratch buffer; its allocation count remains one. LRU, A*, Tarjan, and token bucket retain no adapter allocation after departure.

The browser checks also exercise proof receipts, checker payloads, clipboard recovery, automatic benchmarks, cancellation and reruns, no-JavaScript content, aliases, navigation, and responsive layouts. Prose routes remain within the existing JavaScript budget and do not request Wasm before an explicit example action.

Two existing browser-test fixtures were corrected during the audit. Myers and sweep-and-prune now test for horizontal overflow rather than requiring content width to equal the viewport width. Dinic's motion fixture hides only the decorative rounded selection outline, which Chromium rerasterizes while stationary, and disables both legacy and React benchmark entry points. Exact packet transforms, SVG/CSS clocks, and rendered motion checks remain intact. With that decoration isolated, paused frames differed by zero pixels in both motion-preference modes.

## Reproduction

```sh
npm run typecheck
npm run site:typecheck
npm run site:test
npm run test:docs
npm run test:docs:proof
npm run lint
npm run demos:site
node --test demos/site.test.mjs
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
SITE_BROWSERS=chromium npm run site:browser
```

For a nested deployment, build with `LEAN_BRIDGE_SITE_BASE=/nested/lean-bridge/` and run the browser checks against that assembled artifact. `site/workbench-browser-check.mjs` and `site/workbench-recovery-check.mjs` accept a served site URL. `WORKBENCH_BROWSERS` selects the lifecycle engines; `WORKBENCH_SKIP_BENCHMARK=1` excludes the comparison when it is covered by the separate browser suite.

Generated reports live under `build/react-site-audit/` and `build/demo-browser-audit/`. The lifecycle reports record native ownership and observer counts for each algorithm. See the [site development guide](../../site/README.md) for the build and preview commands and the [migration plan](../architecture/react-documentation-site-plan.md) for the remaining documentation and publication work.
