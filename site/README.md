# Documentation site

This directory owns the React presentation layer. Lean algorithms, C bridges, runtime APIs, proof sources, and benchmarks remain in `demos/`.

The initial migration covers the shared site shell, eight canonical guides, two audience hubs, and the Myers workbench. The other eleven demos remain standalone. No algorithm package is published by building this site.

## Develop

Use Node.js 22.22.0 or newer. The Pages workflow pins 22.23.2. Install the locked dependencies with `npm ci --ignore-scripts`.

```sh
npm run site:dev
```

The development server serves the existing demo artifacts through the same allowlist as the static assembler. If they are missing or stale, run `npm run build:demos` first. Canonical Markdown is compiled before startup; restart the command after changing a guide. TSX and CSS use Vite's development updates.

## Build and check

```sh
npm run site:typecheck
npm run site:test
npm run demos:verify
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
DEMO_BROWSERS=chromium,firefox,webkit npm run demos:browser
```

Install the audit browsers with `npx playwright install --with-deps chromium firefox webkit`. `CHROMIUM_PATH` can select an existing Chromium binary. Browser checks serve the assembled artifact themselves; they do not require a running development server.

`demos:verify` retains the twelve proof builds, differential suites, and benchmark budgets. `site:test` covers the content pipeline, copy allowlists, staged publication, proof services, benchmark teardown, and Myers model. Browser checks add no-JavaScript guides, direct loads, navigation, exact-text editing, IME, proof failure recovery, and repeated resource cleanup.

## Static publication

`site:build` compiles the React routes into `build/react-site/client`. `demos:site` combines them with the raw demo artifacts in `build/github-pages`, using a temporary staging directory. A failed build leaves the last assembled site intact.

```sh
# Domain-root hosting
LEAN_BRIDGE_SITE_BASE=/ npm run demos:site

# Project Pages hosting
LEAN_BRIDGE_SITE_BASE=/lean-bridge/ npm run demos:site
```

The base is an absolute directory path ending in `/`. It must match the host's deployment directory. GitHub Pages needs no application server or SPA fallback. Every registered route has HTML; `404.html` is a real not-found document. The existing Pages workflow checks and uploads this artifact. Running the commands above does not deploy it.

`/lean-myers/` redirects to `/demos/lean-myers/`, preserving query and fragment in JavaScript and providing a normal no-JavaScript link. Its raw sources, loader, Wasm, and receipt stay under `/lean-myers/`. The other eleven demo URLs do not change.

`build-identity.json` binds the revision, deployment base, route metadata, and exact output hashes. Its original 36 Wasm/loader/receipt subjects remain unchanged. This local identity is an unsigned consistency record, not a signed release authorization.

## Content and ownership

- `registry.mjs` maps the existing demo manifest and canonical Markdown sources to public routes.
- `app/routes/guides/` gives each guide a separate route chunk. Guides import generated MDX instead of duplicating prose.
- `scripts/generate-site-content.mjs` compiles the explicit allowlist with MDX, GFM, and build-time Shiki highlighting. Output lives in `build/site-content`.
- Source-relative Markdown links become documentation routes or revision-pinned GitHub links. Unknown images, raw HTML, private paths, untracked source links, and broken fragments fail generation.
- Documentation search loads its separate index only on use. Prose pages do not import or request a Wasm runtime. The initial JavaScript budget is 200 KiB gzip per landing or documentation page.
- `app/components/ProofViewer.tsx` owns source loading and controls. Framework-neutral proof services verify hashes and construct checker payloads; legacy pages use the same services.
- `BenchmarkPanel.tsx` owns one scoped controller and prepared solver. The controller owns metric and histogram leaves. Unmount disposes observers, listeners, animation frames, and prepared handles.
- Myers keeps exact text, selections, mode, and history in page-memory across React routes. History retains at most 100 edits or 8 MiB per editor, dropping oldest history before current text. A reload starts fresh. The Wasm initialization promise remains cached for the browser document; prepared handles do not survive route departure.

The [migration plan](../docs/architecture/react-documentation-site-plan.md) tracks the remaining eleven ports and deeper author, consumer, publishing, reference, and concept work.
