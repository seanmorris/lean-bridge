# React gallery and documentation-site plan

Status: foundation and first graph-port batch complete, 8 September 2026. VO phase 1185 extends portfolio plan 1123. Tasks 1186, 1187, and 1189 delivered the foundation, documentation shell, and Myers pilot. Under task 1188, commits `1beacee`, `2f28d8d`, and `a89b456` add sweep-and-prune and Dinic. See the [foundation evidence](../evidence/react-site-foundation-20260908.md) and [graph-port evidence](../evidence/react-graph-migration-20260908.md). Nine ports remain. The user selected expanded documentation as the next batch; that work is in progress. No push or deployment occurred.

Audit prerequisite: commit `949b5005f85fee13a270e80361c85014925c19a6`, recorded in the [twelve-demo audit](../evidence/demo-portfolio-audit-20260908.md). VO task 1144 is complete. Gallery integration task 1143 and publication task 1145 remain open.

## Product outcome

Give a visitor three clear starting points: write a Lean component, use a component in an application, or publish a release. Keep the twelve interactive algorithms as runnable examples beside their APIs, proofs, and measurements.

Use [PHP-Wasm's documentation](https://php-wasm.seanmorr.is/getting-started/home.html) as the information-design reference: shared navigation between overview, demos, and documentation; grouped task-oriented guides; highlighted examples; and direct links to runnable code. Its [installation guide](https://php-wasm.seanmorr.is/getting-started/install-and-include.html) and [custom-build guide](https://php-wasm.seanmorr.is/compiling/custom-builds.html) separate consumer and author work in a useful way.

Retain this gallery's visual design: navy surfaces, compact headers with a bottom border, the 1440px outer rail, readable type, and small nested corner radii. Documentation gets a narrower reading column within that rail. On mobile, collapse the sidebar and page outline so neither squeezes the article. Replace the current page shell when adding React; do not wrap it in a second shell.

The migration changes presentation and lifecycle management. Lean specifications, proofs, and algorithm interfaces remain independent of React, grids, and other demo models.

## Current contracts to preserve

| Existing surface | Migration requirement |
| --- | --- |
| Twelve standalone demos with `runtime.mjs`, C bridges, and compiled Wasm | Reuse their generic APIs. An individual demo is not currently an installable npm algorithm package. |
| Required proof declarations and exported-function relationships | Preserve every existing check and receipt. A UI-only port should leave Lean sources and Wasm bytes unchanged. |
| Automatic, prewarmed comparisons against JavaScript | Keep workloads, sample counts, correctness checks, cancellation, and current regression budgets. Measure React rendering separately. |
| Both external proof checkers and downloadable Lean sources | Preserve highlighted sources, theorem/axiom output, valid Comparator challenges, popup recovery, and stable launch labels. |
| Existing Pages URLs and relative asset paths | Keep bookmarks, hashes, query strings, and raw source/Wasm/receipt downloads working under any configured site base. |
| Independent prepared handles and explicit disposal | Preserve input snapshots, retryable initialization, use-after-dispose checks, and cancellation across navigation. |
| Canonical guides, support JSON, and evidence records | Render or reference the owning record instead of creating a second support inventory. |

The audited baseline includes 153 demo/site tests, 295 core contracts, 261 required theorem entries across the proof receipts, and 36 demo/browser combinations plus seven Chromium interaction scripts. These numbers identify the starting evidence, not a substitute for preserving the named checks.

## Reader paths and routes

Routes below are relative to the configured deployment base, not a domain root.

| Route family | Reader's task | Required content and next action |
| --- | --- | --- |
| `/` | Understand the project and choose a starting point | Short explanation, three audience entry points, selected demos, and links to current support. Keep the existing business explanation concise. |
| `/demos/` | Find an algorithm | Search and categories for graphs, text, systems, and geometry; named guarantees and direct demo links from the manifest. |
| `/demos/<slug>/` | Run and understand an example | Interactive workbench, API example, proof/source view, benchmark, build receipt, and an explanation linked to the generic core. |
| `/docs/lean/` | Turn an ordinary Lean library into a component | Prerequisites, Lake project, definitions and proofs, analysis, export decisions, checked build, reproducible dry run, diagnostics. |
| `/docs/consume/` | Install and call a component | Receipt verification, JS/TS, React, browser/worker assets, values and errors, ownership, and target-specific guides. Include a separate local-demo-API recipe. |
| `/docs/publish/` | Release a package or update this site | Local candidate, sandbox rehearsal, approved production publication, consumer handoff, recovery, and a separate GitHub Pages procedure. |
| `/docs/reference/` | Look up a contract | CLI options and exit codes, supported types and call shapes, generated APIs, runtime compatibility, artifacts, receipts, and ownership. |
| `/docs/concepts/` | Understand the mechanism or assess adoption | Proof-to-Wasm compilation, generic cores, shared runtime composition, proof evidence, benchmark interpretation, and the existing business concept plan. |
| `/status/` | Check whether a workflow is supported | Versioned consumer profiles, tested revisions, current release controls, and links to executed evidence. |

Each tutorial states its audience, prerequisites, files to create, exact commands, expected result, likely failures, and next action. Technical reference pages link back to one runnable tutorial. A Lean author should reach a local package without learning the internal binding protocol; a consumer should call public exports without reading Lean proofs first.

## Proposed architecture

Use React with Vite and React Router's [static prerendering](https://reactrouter.com/how-to/pre-rendering), with repository-owned Markdown/MDX for documentation. Set `ssr: false` and enumerate every documentation and demo path from the page registry; `prerender: true` alone does not expand dynamic slugs. Emit real HTML for every public route, retain the generated client-navigation data files, and include a meaningful 404 page. GitHub Pages needs no application server. Verify and pin the compatible React, router, Vite, and MDX versions in task 1186 before adopting the configuration.

Follow Vite's [Pages base-path configuration](https://vite.dev/guide/static-deploy.html). Preserve today's published `<base>/<lean-slug>/` routes as generated aliases to the new demo routes. Test source-preview `/demos/<lean-slug>/` paths too. Alias pages preserve query strings and anchors and provide a normal link without JavaScript. Raw artifact aliases serve the actual files with the correct content type, never the HTML app fallback.

Proposed ownership:

The implemented foundation places components in `site/app/components/`, route modules in `site/app/routes/`, and the content registry in `site/registry.mjs`. Compiled Markdown lives only in the ignored `build/site-content/` directory.

| Location | Responsibility |
| --- | --- |
| `site/` | React routes, shared shell, accessible controls, documentation layout, and build configuration. This is a new directory. |
| `site/components/` | `SiteShell`, `DocsLayout`, `DemoWorkbench`, `ProofViewer`, `BuildReceipt`, `BenchmarkPanel`, and code examples. |
| `site/content/` | Page registry, audience/order metadata, and explicit mappings to canonical Markdown. Do not copy whole guides into parallel files. |
| `demos/` | Lean, C/Wasm artifacts, framework-independent models/adapters, manifest, tests, and benchmark workloads. |
| `docs/` | Canonical author/consumer guides, reference contracts, architecture, and executed evidence. |
| `scripts/` | Content/route generation, artifact copying, example checks, and the assembled-site gate. Keep `build/github-pages` as the final artifact. |

Use an explicit content allowlist. Never import environment files or arbitrary repository directories into the site. Compile only trusted repository MDX; editor text and user examples must remain escaped data. Generate navigation, search, previous/next links, page titles, and outlines from one page registry. Keep code overflow inside its code block.

Resolve Markdown links relative to their canonical source file before mapping them through the page registry. Preserve anchors; map repository-only references to revision-pinned source links and downloadable proof files to their published assets. Copy images through an explicit allowlist. Validate the resulting HTML links as well as the original Markdown links.

### Runtime and React lifecycle

- Initialize Wasm only in client-side demo code or an explicitly started example. Generated packages can initialize through top-level `await`, so importing one during prerender can execute the runtime in Node. Prose routes must not download Wasm until the visitor explicitly starts an example.
- Share initialization promises within their intended lifetime, but clear failed attempts so retry works. Dispose prepared resources after unmount, including resources whose asynchronous preparation finishes after unmount.
- Balance effects under React's [Strict Mode setup/cleanup cycle](https://react.dev/reference/react/useEffect). Release timers, observers, pointer capture, keyboard listeners, and animation frames. Cancel obsolete revisions before they can change results.
- Retain visibility pauses and `pagehide`/`pageshow.persisted` handling independently of React unmount. Browser history restoration can preserve a mounted tree while its resources need reconstruction. Implement route-change focus, announcements, and scroll restoration; hash-only source/tab changes must preserve workbench state and focus. Follow the router's [accessibility guidance](https://reactrouter.com/how-to/accessibility).
- Keep high-frequency animation and pointer state in a scoped controller or refs. React can render controls and summaries without rerendering the entire workbench every frame. Keep algorithm timing outside render work.
- Measure memory across repeated visits to all demos. Disposing a prepared handle does not unload an entire Wasm module. Record the module-cache policy and consider a route-owned worker only if measured retention or responsiveness requires it.
- Load proof sources and checker payloads on demand without changing their hashes or theorem content. Provide explicit loading, retry, cancellation, unavailable-capability, and verification-failure states.

The React port does not merge the twelve standalone Wasm runtimes into the bridge's shared-runtime package format. That packaging change requires its own design and evidence.

## Tutorials and handoff flows

### Lean author

Adapt the [author guide](../lean-author-guide.md) into a first runnable project and focused reference pages. Start with the existing `onboarding-small` definitions, add a checked theorem relationship as a separately tested lesson, and show the resulting assurance metadata. A theorem is an assurance reference, not a host-callable export. A compiled definition without a theorem relationship must not acquire a proof claim in the UI.

The executable sequence remains:

```sh
lean-bridge analyze --project . --check --output build/analysis
lean-bridge build --project . --target npm --output build/lean-bridge-release
lean-bridge publish --project . --target npm --dry-run --output build/lean-bridge-dry-run
```

Document Node 22, Git, the pinned Lean toolchain, Nix or Docker, and the prepared shared runtime before these commands. The source project must be committed for the reproducibility dry run. Explain each emitted directory, including analysis decisions, the component-neutral bundle, archives, and receipts.

Keep three capabilities separate: source analysis, generated binding types, and execution through a particular package runtime. The current [plain-component npm runtime](../../src/release/component-npm-package.mjs) supports `Nat × Nat → Nat` and `String → Bool`. The analyzer's broader type table and richer Alpha fixture do not establish that every ordinary-project declaration runs through this package path. Every tutorial must execute its exact generated archive; unsupported shapes need a documented diagnostic or a separately implemented adapter.

### Downstream consumer

Use the [JS/TS guide](../javascript-typescript.md) for the first package example, with receipt verification before installation. Show ordinary package imports, `Nat` as `bigint`, generated TypeScript checks, initialization failures, and cleanup where the public API owns resources.

Add a clean React fixture that builds the documented author project, installs its runtime and component archives with scripts disabled, imports the package by name, and executes it under Strict Mode. The existing [React loader fixture](../../tests/fixtures/browser-consumer/react-runner.mjs) and [installed browser-package check](../../scripts/test-browser-package-consumer.mjs) exercise different paths; neither alone proves this combined author-to-React tutorial.

Provide separate browser asset and worker recipes, then link to the existing [consumer](../consumers.md), [PHP](../php.md), and [.NET/JVM/Ruby](../dotnet-jvm-ruby.md) guides. Generate support labels from [consumer-support.v1.json](../consumer-support.v1.json). Thirteen tested profiles do not imply every component or platform supports every feature.

For each algorithm, document its current local adapter, accepted data, return values, and disposal using a minimal non-demo-specific example. Do not add an algorithm `npm install` command until that algorithm has a package projection, exact-archive receipt, clean installation, and public API evidence.

### Publishing and verification

| Flow | Producer action | Consumer or operator check |
| --- | --- | --- |
| Local package handoff | `publish --dry-run` builds two clean copies and emits local archives, candidate manifest, and component receipt. It reads no registry credentials and makes no registry write. | The standalone local verifier checks consistency before installation. Then a clean consumer imports and calls the exact archive. |
| Sandbox rehearsal | Explicitly select the npm sandbox and exercise the authorized candidate, registry transaction, and recovery cases. | Compare the immutable registry tarball with the authorized archive; keep the sandbox separate from production. |
| Production package release | Rehearse the exact candidate, obtain the required approvals, validate the deployment profile, sign the decisions, and publish with explicit opt-in. | Verify the completed signed receipt, exact coordinate/archive hash, and separately trusted signer-policy hash before installing. |
| GitHub Pages update | Rebuild proofs/Wasm, run tests and browser gates, prerender routes, bind artifact identity, and deploy the exact approved static artifact. | Check public routes, source/receipt/Wasm hashes, nested-base assets, and build identity. Retain the previous verified artifact for rollback. |

The [release pipeline](../../src/release/README.md#publication-and-receipts) owns publication controls. The installed CLI includes the npm adapter. Production execution checks the reviewed deployment profile before credential access and requires credentials, signer policy, and explicit opt-in. Other registry adapters must not appear as working tutorial paths merely because an archive projection exists.

Explain all three verification records precisely: gallery hashes identify emitted files; a local component receipt checks archive consistency; a signed release receipt authenticates the completed release against a separately trusted policy. An adjacent policy file cannot authenticate itself. Include negative examples for a modified archive, a substituted policy, and a partial publication, with safe retry/recovery instructions.

Documentation CI uses local artifacts and sandbox rehearsals. It must never publish to production or expose credentials in commands, browser bundles, screenshots, or logs. Actual package publication and Pages deployment require separate authority.

## Delivery sequence in VO

| Task | Deliverable | Dependency and exit check |
| --- | --- | --- |
| 1186 | Route, asset, package, and performance inventory; static React prototype | Start here. Pin compatible dependencies, verify nested-base prerender and raw assets, and record load/render/memory budgets. |
| 1187 | Shared shell, audience hubs, documentation navigation, and search | After 1186. HTML is readable without JavaScript; mobile navigation and the single-shell layout pass. |
| 1189 | Myers React pilot and shared proof/receipt/benchmark components | After 1187. Preserve Unicode, raw newlines, history, checker flows, and benchmark behavior; pass lifecycle and old/new parity checks. |
| 1188 | Remaining eleven React demos | After 1189. Start with sweep-and-prune for pointer/animation stress, then Dinic and the remaining nine. Port in reviewable batches with legacy aliases and interaction parity. |
| 1190 | Lean author tutorials and executable source examples | After 1186; publish into the shell when ready. The exact documented source produces and verifies its package. |
| 1191 | Downstream tutorials and clean installed React fixture | After 1190. No repository-private imports; exact archives execute, TypeScript checks pass, and Strict Mode cleanup works. |
| 1192 | Package-release and Pages-publication guides | After 1190. Local/sandbox flows and rejection cases pass; production operations remain explicitly gated. |
| 1193 | Generated reference, status, search content, and concept guides | After 1187, integrating 1190 through 1192. Canonical links, snippets, source ownership, and support labels agree. |
| 1194 | Full acceptance evidence and Pages cutover handoff | After all delivery tasks. Preserve rollback artifacts and hand the verified result to publication task 1145. |

The author and publishing work can proceed alongside the UI migration after the initial contracts are recorded. Task 1143's gallery/navigation requirements are fulfilled through 1187, 1188, and 1193; they are not marked complete by this plan. The earlier [concept-page plan](../../demos/CONTENT_PLAN.md) supplies content for `/docs/concepts/`, not a second competing site implementation.

## Release acceptance

1. All maintained Lean builds, required theorem/axiom audits, exported-function checks, differential tests, and benchmark budgets pass. Receipt regeneration or proof removal requires review; React cannot bypass these gates.
2. The three-browser matrix runs against the prerendered artifact under a nested base. Extend it for React routes and retain touch, keyboard, rapid edits, animation, reload, failed download, checker, clipboard, cancellation, and restored-page regressions.
3. Every declared route and legacy alias survives direct navigation, refresh, and client navigation, including generated navigation-data requests under a nested base. Anchors and query strings survive aliasing. Missing routes show a useful 404, and missing Wasm/source files never return HTML with status 200.
4. Gallery links and documentation content render without JavaScript. At 320 through 1920 pixels, navigation, code, graphs, and workbenches do not cause page overflow. Check focus order, keyboard operation, touch dragging, contrast, reduced motion, and screen-reader labels.
5. Repeated Strict Mode mounting, route switching, cancellation, and failed initialization leave no stale updates or live prepared handles. Memory and render costs stay within the measured budgets from 1186. Prose pages download no Wasm before the visitor explicitly starts an example.
6. Copyable author and consumer examples run in clean directories against their exact generated archives. Test unsupported call shapes, wrong value types, mutated archives, and untrusted policies. Support claims come from the versioned contract and executed evidence.
7. Build metadata identifies the source revision and emitted artifact hashes. Content generation uses an explicit allowlist; secrets and arbitrary repository files never enter the site. Documentation examples cannot initiate production publication.
8. Preserve the previous verified static artifact, record the cutover and rollback commands, and verify the deployed routes only after deployment is authorized. A completed React build alone does not close publication task 1145.

The implementation lives in [site/](../../site/README.md). It uses explicit route modules for each canonical guide, a shared React shell, and route-owned Myers, sweep-and-prune, and Dinic workbenches. The other nine demos retain their standalone pages and all twelve retain their raw artifact URLs.

The next selected batch expands author, consumer, and publisher documentation under tasks 1190 through 1193. The remaining nine ports stay under task 1188. Do not treat written instructions as completion of their executable acceptance gates.
