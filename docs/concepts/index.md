# Understand and adopt a verified core

Lean proofs let a team check a stated property across every input covered by that statement. A package makes the checked implementation callable from application code. These guides connect that claim to a small example, a running demo, and the files a reviewer can inspect.

## Choose a question

| Your question | Guide | What to inspect next |
| --- | --- | --- |
| What happens when a change breaks a guarantee? | [Proofs as a change check](change-risk.md) | A working theorem and two rejected edits. |
| How can I review a correctness claim? | [Audit a claim](auditable-claims.md) | The theorem, source receipt, and compiled artifact. |
| Is the algorithm tied to the demo? | [Reuse the core](reusable-cores.md) | A graph with no grid or webpage. |
| Which integration decisions still need tests? | [Check the integration](trust-boundaries.md) | Units, adapters, inputs, and release identity. |
| How does the code reach the browser? | [From proof to browser result](lean-to-wasm.md) | The Lean-to-Wasm build sequence. |
| Do application users manage a Lean runtime? | [Combine packages](shared-runtime.md) | Automatic initialization and runtime dependencies. |
| What needs cleanup? | [Ownership and cleanup](ownership.md) | Values, resources, and late async results. |
| Will this meet my application's needs? | [Plan an adoption](adoption.md) | A measured pilot and a release checklist. |

## Try a small problem

[Dijkstra](dijkstra.md) finds a least-cost delivery route. [Flood fill](flood-fill.md) finds which locations become reachable as capabilities are acquired. Both guides include a small graph that you can run with the maintained compiled adapter.

For text, dependency, cache, limiter, and geometry problems, use the [algorithm reference](../reference/algorithms.md). It links all twelve live demos, their exported adapter functions, selected theorems, and receipts.

## Pick an implementation path

Application developers should begin with a [prepared package](../consume.md). Lean authors can [build a component](../lean/first-component.md) from their own source. The demo recipes use local compiled adapters and identify that separate path explicitly.

The [benchmark guide](benchmarks.md) explains which costs the live charts include. Use it before turning a solver ratio into an application-level performance claim.
