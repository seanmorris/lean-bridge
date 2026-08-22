# Verified algorithms content plan

## Goal

Extend the gallery with pages that connect four homepage claims to source files, proof receipts, benchmarks, and live demos. Business readers get plain explanations. Engineers and reviewers can follow the same claims to technical evidence.

The homepage remains the concise entry point. Deeper pages expand its claims and link to concrete proof receipts, source, benchmarks, and demos. Do not add a homepage link until its destination ships in the assembled Pages artifact.

## Information architecture

| Route | Primary question | Core content | Primary next step |
| --- | --- | --- | --- |
| `guides/` | Where should I start? | A role-based guide hub for product leaders, engineers, and reviewers. | Choose a concept or live demo. |
| `guides/change-risk/` | How does this reduce software risk? | Explain proof-checking as a build gate, contrast examples/tests/proofs, and show a deliberately rejected change. | Open a proof receipt. |
| `guides/auditable-claims/` | What evidence can a reviewer inspect? | Trace one claim through theorem, source hash, compiler receipt, Wasm artifact, and independent browser checker. | Audit either demo. |
| `guides/reusable-cores/` | Is the proof tied to one screen or product? | Show generic graph interfaces, adapters, and why Dijkstra and flood fill are not grid-specific. | View the core Lean APIs. |
| `guides/trust-boundaries/` | Where does proof coverage end? | Separate theorem, compiler, generated artifact, ABI, browser adapter, input model, and UI responsibilities. Include failure scenarios. | Read a demo-specific boundary. |
| `guides/proof-to-wasm/` | How does checked code become browser code? | A step-by-step build pipeline from Lean source to checked declaration, optimized core, C bridge, Wasm, receipt, and page. | Reproduce the build. |
| `lean-dijkstra/explained/` | What does the shortest-path proof guarantee? | Plain-language algorithm walkthrough, theorem map, benchmark interpretation, and grid-adapter boundary. | Run Dijkstra and inspect its proof. |
| `lean-flood-fill/explained/` | What does reachability and key closure guarantee? | Room/key example, directed edges and ledges, least-fixed-point explanation, theorem map, and map-adapter boundary. | Run flood fill and inspect its proof. |

## Shared page shape

Every guide should use the same reading path:

1. State the business question and answer it in the first screen.
2. Give one concrete, non-technical example.
3. Name the exact guarantee.
4. Show the evidence chain with links to repository artifacts.
5. Place the trust boundary beside the guarantee.
6. Offer a technical deep dive and a live-demo action as separate choices.

Use a shared guide template, the same 1440px content rail, existing radius tokens, and the portfolio navigation. Diagrams should be HTML or SVG so they remain accessible, responsive, and reviewable in source.

## Delivery sequence

### Phase 1: Explain the homepage promises

Build the guide hub and the four pages represented by the homepage explainer: change risk, auditable claims, reusable cores, and trust boundaries. Add links to the explainer cards only when all four routes pass the static-site checks.

### Phase 2: Connect claims to implementation

Add the proof-to-Wasm pipeline and the two algorithm-specific walkthroughs. Reuse theorem and receipt metadata from `demos/manifest.json` instead of copying names into multiple pages.

### Phase 3: Add decision evidence

Add measured build/runtime costs, adoption considerations, and a small case-study format. Keep performance measurements machine-generated and label environmental limitations. Avoid generalized ROI numbers unless the repository contains evidence for them.

## Publishing work

- Extend the gallery build script to copy `guides/` and nested demo explainer routes.
- Add guide metadata to a dedicated manifest rather than mixing editorial pages with executable demos.
- Generate shared breadcrumbs, previous/next navigation, titles, and descriptions from that manifest.
- Add structural tests for every declared route, relative asset URL, unique page title, single `h1`, and valid internal link.
- Add browser checks at desktop, tablet, and narrow-mobile widths.
- Render each page's core content before JavaScript loads. Use JavaScript for progressive enhancement.

## Definition of done

A concept page is ready when a non-technical reader can accurately summarize the claim after a five-minute read, every technical claim points to inspectable evidence, the guarantee and limitation are visually paired, the page is keyboard-readable, and the assembled GitHub Pages artifact contains no dead or domain-root links.
