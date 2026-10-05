# Plan an adoption

Start with one operation whose required behavior is easy to state and whose inputs already have a clear model. A useful pilot replaces that operation, measures the complete call path, and keeps an explicit rollback route.

The goal is evidence for a shipping decision, not a rewrite of the application around a proof tool.

## Choose a bounded pilot

A dependency scheduler can require either a complete legal ordering or an explicit cycle. A route service can require a valid least-cost route. A cache can require a capacity bound and a particular eviction rule.

Write down the requirement before selecting a theorem. Then read the selected theorem's inputs, assumptions, and result. The [algorithm reference](../reference/algorithms.md) lists the available examples; [Audit a claim](auditable-claims.md) describes the review.

## Check the distribution path

If you are consuming a library, obtain its prepared release and follow the [language guide](../consume.md). Confirm that its generated API exposes the operation you need. The [runtime support contract](../consumer-support.v1.json) records tested environments, not universal compatibility for every Lean signature.

If you own the Lean source, follow the [author tutorial](../lean/first-component.md). Ordinary-project npm components currently compile pure primitive signatures. A local graph demo adapter is not automatically an installable algorithm package; packaging that API is separate work.

## Measure the whole feature

| Cost | Measure |
| --- | --- |
| First use | Downloaded bytes, initialization, and first useful result. |
| Repeated call | Input preparation, compiled operation, and result copying. |
| User interaction | Input-to-display latency during realistic editing or requests. |
| Long-lived session | Resource counts and memory after repeated creation and cleanup. |
| Author or release workflow | Clean build, proof checks, package creation, and verification time. |

Use your input distribution, including empty, dense, disconnected, repeated, and maximum-size cases where applicable. A warm solver microbenchmark cannot answer a cold-start or whole-feature question. The [benchmark guide](benchmarks.md) explains how to interpret the existing live results without inventing a general speedup.

## Define acceptance before replacing the call

Record the target runtime and package version, input limits, expected error behavior, performance requirements, and memory observations. Compare results with the current implementation or an independent reference. Test the adapter's units and ID mapping separately.

Decide how the feature behaves when an artifact cannot load. A fallback must be visible in diagnostics so an unverified fallback is not reported as the compiled verified result. Keep the old release artifact available for rollback.

## Record the decision

A short adoption record should name the operation, theorem, prepared artifact, tested revision, workload, cold and warm measurements, cleanup result, and unresolved integration work. Link the commands and reports. State the observed benefit; do not infer a financial return from a solver timing ratio.

The source owners are the algorithm's API and theorem files, the package's release metadata, and the application's adapter. The publisher owns the [release handoff](../publishing.md); the application team owns deployment and its integration tests.

Next, run a small [Dijkstra](dijkstra.md) or [flood-fill](flood-fill.md) problem, or install the [prepared tutorial package](../javascript-typescript.md).
