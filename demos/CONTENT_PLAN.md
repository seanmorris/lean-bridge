# Verified algorithms content plan

Status: implemented under VO1193, within the [React documentation-site plan](../docs/architecture/react-documentation-site-plan.md), phase 1185. The site uses the shared documentation shell and `/docs/concepts/` routes. Root and nested artifacts include the guides; public deployment remains a separate task.

## Delivered concept pages

Routes are relative to the configured site base. Canonical Markdown, route metadata, search, and pagination use the existing documentation registry.

| Route under `/docs/concepts/` | Reader's question | Canonical guide |
| --- | --- | --- |
| The section root | Where should I start? | [Understand and adopt a verified core](../docs/concepts/index.md) |
| `change-risk/` | What happens when a change breaks a guarantee? | [Use proofs to check a change](../docs/concepts/change-risk.md) |
| `auditable-claims/` | What evidence can I inspect? | [Audit a correctness claim](../docs/concepts/auditable-claims.md) |
| `reusable-cores/` | Is the algorithm tied to its screen? | [Reuse the algorithm](../docs/concepts/reusable-cores.md) |
| `trust-boundaries/` | Which integration decisions need tests? | [Check the integration](../docs/concepts/trust-boundaries.md) |
| `lean-to-wasm/` | How does checked code become browser code? | [From proof to browser result](../docs/concepts/lean-to-wasm.md) |
| `shared-runtime/` | Do consumers manage a Lean heap? | [Combine Lean packages](../docs/concepts/shared-runtime.md) |
| `ownership/` | What needs cleanup? | [Ownership and cleanup](../docs/concepts/ownership.md) |
| `adoption/` | How should a team evaluate a verified core? | [Plan an adoption](../docs/concepts/adoption.md) |
| `dijkstra/` | What does a returned shortest path guarantee? | [Dijkstra on a delivery graph](../docs/concepts/dijkstra.md) |
| `flood-fill/` | What do reachability and capability closure guarantee? | [Flood fill with keys and permissions](../docs/concepts/flood-fill.md) |
| `benchmarks/` | What do the timing numbers measure? | [Read the benchmarks](../docs/concepts/benchmarks.md) |

The homepage's three business cards link to the change-check, audit, and reuse guides. The explanation stays below the three cards. Deeper integration and adoption material lives in the guides.

## Contract-backed reference

Four pages under `/docs/reference/` cover [CLI commands](../docs/reference/cli.md), [generated package APIs](../docs/reference/package-api.md), [types and values](../docs/reference/types.md), and [all twelve local algorithm APIs](../docs/reference/algorithms.md).

The generator reads executable CLI contracts, actual generated declarations, scalar capabilities, demo exports, and proof receipts. It checks selected theorem names and source hashes. Contributors edit reviewed templates and explicitly regenerate the canonical Markdown. A stale reference fails the site build.

The existing versioned consumer-support contract remains the owner of runtime support claims. Reference generation does not add a second support inventory.

## Executable examples and acceptance

The change-check lesson runs the strict Lean tutorial check and requires rejection of both a broken implementation and an admitted proof. Dijkstra, flood fill, and cleanup snippets run against the maintained compiled adapters. Package API and composition snippets run against installed archives in Node, strict TypeScript, Chromium, Firefox, and WebKit.

The site audit checks links and anchors, route aliases, reading widths, scrollable code and tables, grouped pagination, search, keyboard navigation, and no-JavaScript article parity. Prose routes do not fetch Wasm. Concept links open their corresponding running workbench.

The [reference-documentation evidence](../docs/evidence/reference-documentation-20260909.md) records source owners, prerequisites, tested revisions, expected results, commands, and artifact identities.

## Remaining publication work

VO1194 owns the combined release acceptance, rollback artifact, and exact Pages cutover handoff. VO1145 owns deployment after explicit authorization. Contributor instructions for site deployment stay under [Contributing](../docs/contributing/github-pages.md), separate from publishing library packages.

Further algorithm walkthroughs can follow the Dijkstra and flood-fill pattern when a concrete reader question warrants one. Application case studies need measured application workloads and outcomes; the current solver benchmarks do not establish a financial return or a general application speedup.
