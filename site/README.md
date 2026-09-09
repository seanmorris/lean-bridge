# Develop the documentation site

This directory owns the React presentation layer. Lean algorithms, C bridges, runtime APIs, proof sources, and benchmarks remain in `demos/`.

The site renders the documentation and the Myers, sweep-and-prune, and Dinic workbenches. The other nine demos remain standalone. Author, consumer, publisher, contributor, and concept guides share searchable Markdown, grouped navigation, and previous/next links. Building this site does not publish an algorithm package.

## Develop

Use Node.js 22.22.0 or newer. The Pages workflow pins 22.23.2. Run commands from the repository root and install the locked dependencies:

```sh
npm ci --ignore-scripts
npm run site:dev
```

The development server serves the existing demo artifacts through the same allowlist as the static assembler. If they are missing or stale, run `npm run build:demos` first. Canonical Markdown is compiled before startup; restart the command after changing a guide. TSX and CSS use Vite's development updates.

## Build and check

```sh
npm run site:typecheck
npm run site:test
npm run bootstrap
npm run test:docs
npm run test:docs:proof
npm run demos:verify
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
```

Install the audit browsers with `npx playwright install --with-deps chromium firefox webkit`. `CHROMIUM_PATH` can select an existing Chromium binary. Browser checks serve the assembled artifact themselves; they do not require a running development server.

`demos:verify` runs the twelve proof builds, differential suites, and benchmark regression checks. `site:test` covers the content pipeline, copy allowlists, staged publication, proof services, benchmark teardown, and the three React workbench models. Browser checks add no-JavaScript guides, direct loads, navigation, exact-text editing, IME, dragging, animated flow, proof failure recovery, and repeated resource cleanup.

`test:docs` checks copyable author files against the maintained fixture, theorem metadata, public consumer imports, numeric input guards, and a local demo-API example against the compiled solver. `test:docs:proof` uses the pinned Lean version and commit to check the tutorial theorem, require an empty axiom set, and reject changed-implementation and `sorry` variants. It reads the fixture and passes mutations through stdin without changing source files. Pages CI runs both commands after toolchain bootstrap.

Full author and installed React/worker acceptance are described in [Build example packages and run checks](../docs/contributing/testing.md). Those checks use the author toolchain and the exact archives produced by the author acceptance run. Neither check publishes a package.

## Static publication

Follow [Publish the documentation and demos](../docs/contributing/github-pages.md) to choose the hosting base, assemble and preview `build/github-pages`, check the artifact, and review Pages deployment. The assembler stages a complete site before replacing the previous output. Its unsigned build identity is separate from package-release authorization.

## Claim ownership

| Area | Canonical document |
| --- | --- |
| Project goal, benefits, examples, selected measurements, and current support summary | [Project README](../README.md) |
| Architecture requirements and decisions | [Architecture index](../docs/architecture/README.md) |
| Executed commands, measurements, artifact identities, and limitations | [Evidence index](../docs/evidence/README.md) |
| Versioned downstream support states and blockers | [Consumer support contract](../docs/consumer-support.v1.json) |
| Current implementation inventory | [Status](../docs/status.md) |
| Long-term direction | [Vision](../docs/vision.md) |

The root README is a landing page. It links to canonical records and selects current evidence; raw inventories and test logs belong in the detailed records. Follow the [contributor workflow](../CONTRIBUTING.md#contributor-workflow) when behavior changes so implementation, contracts, evidence, and guides stay consistent.

## Style and references

Follow the [documentation checklist](../CONTRIBUTING.md#documentation-changes). Use project URNs for identifiers; no project web domain is assumed. Use repository-relative links in committed Markdown. Keep examples on public generated APIs and omit private ABI names, raw pointers, and internal transport imports.

Evidence pages should identify the command, environment, source revision, artifacts, result, and limitation. A design expectation belongs in architecture; a command that passed belongs in evidence. Do not write future intent as an observed result. Link to raw measurement and acceptance records rather than translating them into vague claims.

Run `npm run test:docs` before committing. The documentation test checks local links, forbidden workspace paths, punctuation, support-table consistency, and public example boundaries.

## Content and ownership

- `registry.mjs` maps the existing demo manifest and canonical Markdown sources to public routes. Register each canonical source once; compatibility pages use separate Markdown sources and remain outside primary navigation and search.
- `app/routes/guides/` gives each guide a separate route chunk. Guides import generated MDX instead of duplicating prose.
- `scripts/generate-site-content.mjs` compiles the explicit allowlist with MDX, GFM, and build-time Shiki highlighting. Output lives in `build/site-content`.
- `site:build` compiles the routes into `build/react-site/client`. `demos:site` combines that output with the raw demo artifacts in `build/github-pages`.
- Source-relative Markdown links become documentation routes or revision-pinned GitHub links. Unknown images, raw HTML, private paths, untracked source links, and broken fragments fail generation.
- Documentation search loads its separate index only on use. Prose pages do not import or request a Wasm runtime. The initial JavaScript budget is 200 KiB gzip per landing or documentation page.
- `app/components/DocSidebar.tsx` retains the desktop rail's scroll position across guide navigation and reloads using tab-scoped storage for the deployment base. Mobile navigation leaves that offset intact; blocked storage falls back to in-page memory. Article scroll history remains independent.
- `demos/shared/site.css` supplies the header styles for both React and standalone pages. `app/root.tsx` and `demos/shared/site-nav.mjs` render the same brand, navigation, active section, and mobile menu. `site:browser` checks their layout and links across all twelve demos, along with guide-rail scroll restoration.
- `app/components/ProofViewer.tsx` owns source loading and controls. Framework-neutral proof services verify hashes and construct checker payloads; legacy pages use the same services.
- `BenchmarkPanel.tsx` owns one scoped controller and prepared solver. The controller owns metric and histogram leaves. Unmount disposes observers, listeners, animation frames, and prepared handles.
- Each React route supplies its benchmark copy and summary projection; workload modules and sample counts stay unchanged. `app/components/demo-page.css` supplies shared proof, receipt, and benchmark styling.
- Myers keeps exact text, selections, mode, and history in page-memory across React routes. History retains at most 100 edits or 8 MiB per editor, dropping oldest history before current text. A reload starts fresh. The Wasm initialization promise remains cached for the browser document; prepared handles do not survive route departure.
- Sweep-and-prune retains scene inputs, seed, axis, and selection across React routes. Dinic retains capacities and selected edge. Leaving either route stops its animation and cancels pending work. A full reload restores the default example. Each visited algorithm keeps its own initialized Wasm module for the browser document; prepared handles are released separately.

The old `/lean-myers/`, `/lean-sweep-and-prune/`, and `/lean-dinic/` addresses redirect to `/demos/<slug>/`, preserving query and fragment in JavaScript and providing normal no-JavaScript links. Raw sources, loaders, Wasm, and receipts remain at their original addresses. The other nine demo URLs do not change.

The [migration plan](../docs/architecture/react-documentation-site-plan.md) tracks the remaining nine ports and deeper author, consumer, publishing, reference, and concept work.
