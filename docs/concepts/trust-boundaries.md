# Check the integration

A proved algorithm can still receive the wrong model of an application. Review the conversion at the boundary with the same care as the algorithm choice.

For a routing feature, the concrete question is whether the graph supplied to the solver contains exactly the moves and costs that the product intends.

## Pair the guarantee with an integration check

| Core guarantee | Integration check |
| --- | --- |
| A returned Dijkstra path is shortest in the submitted graph. | Closed roads must be absent, costs must share a unit, and returned IDs must map to the right locations. |
| Flood fill returns exactly the reachable enabled vertices. | Walls and one-way ledges must create the intended directed edges. |
| Capability closure is the least stable set of reusable grants. | A consumable key must not be modeled as a reusable capability. |
| A token bucket enforces its integer credit and time model. | Select the tick scale, supply timestamps consistently, and handle clock regression. |
| Sweep-and-prune returns exact snapshot overlaps. | Snapshot sampling does not detect a collision that begins and ends between samples. |

These checks have observable failure cases. Reverse a ledge, change milliseconds to seconds in only one place, or reuse an ID for a different vertex. A boundary test should detect each mistake.

## Validate before converting

Typed arrays can narrow numbers while being constructed. For example, writing a negative integer to a `Uint32Array` wraps it into the unsigned range. A validator that sees only the finished array cannot recover the original value.

Validate untrusted domain values before packing them. Then let the adapter check its own shape and bounds. The application check and the adapter check protect different stages.

For the prepared pure-function API, pass the host type described by its generated declaration. `Nat` takes a nonnegative `bigint`; avoid routing it through a JavaScript `number` first. The [type reference](../reference/types.md) gives the numeric and copy rules.

## Keep the result attached to its input

An editor may submit a new problem before an earlier preparation finishes. A late result must not overwrite the newer problem. Use a revision or cancellation check, dispose late prepared handles, and retain the input snapshot associated with the visible output.

Errors also need a visible path. An invalid graph, failed download, or rejected certificate is not an empty successful result. Preserve the API's result and error distinctions in the UI.

## Review the delivered artifact

The named theorem, native compilation, adapter, browser, and input model are separate parts of the delivered system. The [proof-to-browser guide](lean-to-wasm.md) identifies them; [Audit a claim](auditable-claims.md) explains how the receipts connect the files.

Verify the actual package or site artifact you will use. A proof checked against a different revision does not identify the bytes in your release.

Next, [plan a measured pilot](adoption.md) or [review cleanup behavior](ownership.md) before integrating a stateful API.
