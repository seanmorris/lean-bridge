# Documentation expansion, 8 September 2026

The site now renders 24 canonical documentation pages across author, consumer, publishing, concept, and reference sections. Together with the landing page, gallery, 404, and three React workbenches, it has 30 prerendered routes.

## Delivered guides

- Author setup, first component, theorem checking, export decisions, and diagnostics.
- Installed JavaScript/TypeScript, React, module workers, and a separate local algorithm API recipe.
- Local package handoff, sandbox rehearsal, production-release prerequisites, and GitHub Pages publication.
- A proof-to-browser walkthrough and an explanation of the actual benchmark sampling and ratio calculation.

All pages use maintained Markdown rather than duplicated route prose. The site generates syntax highlighting, headings, search entries, source hashes, and links from those files. Navigation preserves audience groups and supplies previous/next links. The old author-guide anchors still resolve.

## Executed examples

The [author acceptance](documentation-author-20260908.md) checks the exact tutorial source with pinned Lean, rejects a broken implementation and an admitted proof, compares two clean builds, verifies the package receipt, and installs the archives outside the source project.

The [consumer acceptance](documentation-consumer-20260908.md) uses byte-identical archives in a separate Vite project. It checks production React, development StrictMode, module workers, input bounds, stale-result cleanup, missing-asset recovery, and prefixed asset URLs in Chromium, Firefox, and WebKit.

The demo API test executes the JavaScript block from `docs/demo-api.md` against the unchanged sweep-and-prune binary. It returns overlap IDs `[0, 2]`, three candidates, and releases the prepared solver in `finally`.

## Permanent checks

```sh
npm run check:core
npm run test:docs
npm run test:docs:proof
npm run site:test
npm run site:typecheck
SITE_BROWSERS=chromium,firefox,webkit npm run site:browser
```

Core checks cover lint, checked JavaScript, and 303 contract tests. The focused documentation suite has 20 tests; the site/model/service suite has 60. The separate proof command checks the Lean version and commit before elaboration, then requires both negative examples to fail with the expected diagnostics.

Pages CI runs the documentation contracts and strict proof check after toolchain bootstrap. Its site browser gate now also checks every guide's reading layout and pagination. Full local package construction and installed consumer acceptance remain explicit commands; CI does not publish a tutorial package.

The publisher review ran 53 release and CLI tests, including missing authorization, production opt-in, signer requirements, and checks before credential access. No registry credentials were requested and no external write was made.

## Browser audit

The audit uses Chromium 152.0.7977.75, Firefox 153.0, and WebKit 26.5. It checks every static route without JavaScript and measures the landing page plus all 24 documentation pages in each engine. Documentation must fetch no algorithm runtime, and each measured page must remain below 200 KiB of fetched JavaScript after gzip.

The focused reading audit checks each guide at 320, 390, and 1440 pixels, including scrollable code and tables, a single shell/main/heading, exact group-neighbor pagination, mobile navigation, identical static and hydrated article text, and concept links that open the running Sweep workbench.

Reports and screenshots are retained under `build/react-site-audit/{root,prefixed}/` and `build/documentation-site-audit/{root,prefixed}/`. Build identities record the exact source revision, deployment path, route map, and file hashes. The runtime algorithms, their proofs, and their compiled artifacts were not changed for this documentation batch.

## Findings and remaining work

Ordinary package analysis retains `unverified` theorem relationships after compilation. The tutorial checks its theorem separately and displays that metadata without promoting it. The stricter demo proof-receipt pipeline is documented separately.

The installed tutorial package fails above the Wasm small-Nat boundary. Its example validates nonnegative inputs and a sum no greater than `2^31 - 1`. VO1195 records the runtime defect and required installed-package boundary tests; this documentation change does not repair the runtime.

VO1193 still contains generated CLI/API reference, shared-runtime composition, further algorithm explanations, and adoption guidance. Nine remaining React workbench ports stay under VO1188. Public package and Pages publication remain separately authorized.
