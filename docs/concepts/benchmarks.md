# Read the demo benchmarks

Each demo compares its compiled Lean implementation with a JavaScript implementation on a fixed workload. The result answers a specific question: how much does this operation cost in this browser, with these inputs and these output requirements?

## Read the four numbers

| Metric | Meaning |
| --- | --- |
| Lean median | The middle measured Lean/Wasm latency. Half the samples are at least this fast. |
| Lean p95 | The latency at the 95th percentile of the measured Lean samples. |
| JS median | The middle measured JavaScript latency for the matched workload. |
| Relative cost | The median of the paired Lean/JavaScript timing ratios, using unrounded samples. |

A relative cost of `2×` puts Lean at twice the JavaScript duration in the median paired comparison. `0.8×` puts it at four-fifths. This can differ from dividing the two displayed medians. The ratio does not describe download size, startup time, React rendering, or an entire application.

Pairs with a zero JavaScript duration do not contribute to the ratio. If every JavaScript duration is zero, the panel shows `Timer floor`.

Read the absolute time beside the ratio. An extra fraction of a millisecond and an extra second can have the same ratio but very different consequences for a product.

## What the samples measure

The automatic browser run excludes five warmup samples, then collects 100 measured comparisons. Warmup lets module initialization and early runtime optimization settle before the displayed distribution. A cold page load is a separate measurement.

The shared timing helpers repeat fast operations in adaptive batches and divide elapsed time by the repetition count. Batching reduces the effect of the browser timer's resolution. A sample can therefore contain more than one solver call.

The histogram groups the measured Lean latencies into ten bins. Its horizontal axis is time, and its bar heights count samples in each range. The median marker shows where the middle observation falls.

The [benchmark controller](../../demos/shared/browser-benchmark.mjs) owns warmup, progress, cancellation, and display. Each algorithm's workload owns its inputs, JavaScript baseline, and result checks.

## Compare equivalent work

Sweep-and-prune returns two complete pair arrays from both implementations. Its benchmark times sorting, the sweep, all-axis checks, and result construction. Input preparation and independent oracle checks occur outside the timed calls. Dense projections can produce many candidates even when few boxes overlap, so changing the distribution can change the cost substantially.

Dinic returns all edge flows and cut membership. Its Lean call also performs its certificate check. Removing that check, returning only a scalar, or comparing a prepared solve with a full one-shot API call would change the comparison.

Follow the [Sweep workload](../../demos/lean-sweep-and-prune/benchmark-workload.mjs) and [Dinic workload](../../demos/lean-dinic/benchmark-workload.mjs) for the exact timed boundaries. Other demos document their own workload and setup costs.

## Run a useful comparison

Keep the device, browser, workload, and tab visibility the same. Close unrelated heavy work, let the page settle, and use Run again to see whether the distribution repeats. Investigate a long tail instead of selecting only the fastest sample.

For a command-line regression check from the repository:

```sh
node demos/lean-sweep-and-prune/benchmark.mjs --assert
node demos/lean-dinic/benchmark.mjs --assert
```

These commands exercise the CLI workloads and their regression limits. A passing limit does not establish parity with JavaScript; the output reports the actual timings and ratios.

Measure cold downloads and application responsiveness separately. The React migration evidence records fetched JavaScript, unchanged Wasm bytes, route cleanup, and cold readiness independently of solver timing.

Next, [run the box-overlap example](../../demos/lean-sweep-and-prune/index.html) or [call its local API](../demo-api.md) with inputs from your own application.
