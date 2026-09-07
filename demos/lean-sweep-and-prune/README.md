# Proven Lean sweep-and-prune collision pairs

Sweep and prune discards pairs whose projections cannot overlap, then checks the remaining pairs on every axis. Lean proves that this implementation returns every overlapping pair exactly once. The browser uses actual axis-aligned rectangles, so overlap on every axis is an exact test for the shapes it draws.

## Interaction

The six-box opening scene starts paused. A and B overlap horizontally but have a vertical gap. C and D overlap in both directions. E and F are separate. The X sweep reduces fifteen possible pairs to two candidates and one overlap.

- Drag a box to change its position. Dragging pauses motion and shows immediate feedback.
- Choose X or Y to change the sweep axis. Candidate pairs can change; the final overlap pairs do not.
- Play motion or advance one step. Boxes pass through one another; the demo detects overlaps without simulating a collision response.
- Select a box to inspect its named pairs. Arrow keys and the nudge buttons move it; Shift moves it farther.
- Replay the projection sweep to inspect interval activity. Each lane flattens one box onto the selected axis.
- Create a new scene or enter a seed to reproduce an arrangement. The Example button restores the six-box explanation.

Dashed gold links show chosen-axis candidates; solid coral links identify confirmed overlaps. A selected box has a matching projection highlight. Both sets of IDs come from compiled Lean. JavaScript moves the bodies and filters which returned links to display; it does not substitute a browser pair-finding algorithm.

The adapter rounds each displayed snapshot to integer world coordinates before sending it to Lean. Touching edges, corners, points, and zero-width boxes count as overlaps. The theorem concerns each sampled frame. It does not detect a fast-moving box crossing another box between frames.

## Generic API

```js
import { prepareSweep, findOverlaps } from "./runtime.mjs";

const request = {
  dimensions: 2,
  axis: 0,
  // Per box: lower X, lower Y, upper X, upper Y.
  boxes: Int32Array.of(0, 0, 4, 4, 2, 8, 6, 12, 2, 2, 6, 6)
};
const result = await findOverlaps(request);
// candidates: all three unordered pairs (all share X).
// overlaps: Uint32Array([0, 2]).

const solve = await prepareSweep(request);
const first = solve();
const second = solve();
solve.dispose();
```

The Lean interval specification works with integer bounds and an arbitrary dimension count. The checked browser export accepts two or three dimensions, a valid axis index, and up to 1,024 boxes. It contains no scene, screen, motion, or rendering rules.

Pack each box as `[min0, …, minD−1, max0, …, maxD−1]`. In 3D that is `[minX, minY, minZ, maxX, maxY, maxZ]`. Every lower coordinate must be at most its upper coordinate. Inputs must be `Int32Array` instances with complete boxes. The full signed 32-bit range is supported, including −2,147,483,648 and 2,147,483,647. Coordinates use exact integer comparisons; the caller chooses units or a fixed-point scale.

IDs are zero-based input positions. Both returned arrays contain flattened pairs `[first, second, …]`, with `first < second`. Neither array contains duplicate pairs. The candidate array contains exactly the chosen-axis overlaps. The overlap array contains exactly the all-axis overlaps and is a subset of the candidates. Enumeration order is not an API guarantee.

Preparation snapshots the coordinates before its first await and validates them in both JavaScript and Lean. Sorting and sweeping happen on every solver call. Prepared handles are independent, and each result owns its output arrays. Editing a returned array cannot change another result. Disposal is idempotent; calls after disposal throw. Empty input is valid.

Lean serializes six header words: status (zero), box count, dimensions, axis, candidate count, and overlap count. Flattened candidate pairs follow, then flattened overlaps. The C bridge copies the exact words into the output buffer. Lean proves the decoder recovers the result, each word fits uint32, and the output fits `6 + 4 × n × (n − 1) / 2` words. JavaScript's maximum output buffer is just under 8 MiB at 1,024 boxes.

## Algorithm and proofs

The solver sorts box starts on the selected axis with Lean's merge sort. At each start it removes active intervals whose upper endpoint is strictly smaller, preserving edge-touching candidates. Every remaining active interval contributes one canonical pair. The solver checks candidate boxes on all axes for the final result.

The compiled loop prunes active intervals and emits candidates and confirmed overlaps in the same traversal, using the current and active boxes directly. `pruneEmit_refines`, `sweepPruned_refines`, and `solveFused_refines` establish equality with the semantic candidate/filter result. Checked `@[csimp]` function-equality theorems select that implementation during compilation, eliminating repeated traversals and ID lookups. Dimension checks recurse directly without allocating an axis list for each pair.

The proofs cover:

- Sorting preserves every input entry and orders starts monotonically.
- The active set contains exactly the earlier intervals that have not expired.
- An expired interval cannot overlap any later start.
- Sweep output matches the complete mathematical chosen-axis relation.
- Input IDs stay distinct, and each canonical pair appears once.
- All-axis filtering matches exact box intersection.
- Packed input coordinates, output decoding, pair counts, and buffer bounds preserve these guarantees.

`solve_total` states the complete guarantee for the decoded exported result. It has no search-success, runtime-certificate, or fallback premise. The implementation is directly refined to the proved sweep. There is no quadratic runtime verifier and no exhaustive fallback. The build checks all maintained modules and emits a source-hashed receipt; the viewer and both checker bundles use those same files.

For `n` boxes, `k` chosen-axis candidates, and `d` dimensions, sorting takes `O(n log n)` and the sweep/filter work is `O(n + kd)`. Dense projections can produce `n(n−1)/2` candidates even when few boxes overlap in all dimensions. Returning both full pair lists also requires output-proportional storage. These are snapshot solves: the implementation does not retain sorted endpoints or a pair cache between animation frames.

## Verification and benchmark

```sh
bash demos/lean-sweep-and-prune/build.sh
node --test demos/lean-sweep-and-prune/test.mjs
node demos/lean-sweep-and-prune/benchmark.mjs --assert
```

Tests compare both complete pair sets against an independent quadratic oracle. They cover 2,592 exhaustive tiny two-box/axis cases, 432 tied-start three-box/axis cases, 600 seeded moving-frame/axis comparisons, empty and singleton input, 3D separation, containment, equal bounds, touching edges/corners, signed extremes, sparse input at the 1,024-box limit, dense output, malformed requests, independent handles, and output ownership. A maximum-size coincident scene also exercises the full output buffer, checking 523,776 unique pairs in each list. Lean checks explicit edge cases and a three-box corpus during the build.

The automatic browser benchmark excludes five warmup samples, then measures 100 pairs of calls in alternating order. Both implementations receive identical prepared input snapshots and return both complete owned pair arrays. Sorting, active-set work, all-axis checks, serialization, and output copies are timed. Input preparation, rendering, and oracle verification are excluded. Adaptive batches handle browser timer resolution; every measured pair is checked outside timing.

The JS baseline uses typed-array ID sorting, an in-place compacted active set, reusable scratch buffers, and fresh result arrays. It skips the already-proven sweep axis when checking other dimensions. The CLI covers sparse 2D, sparse 3D, and dense scenes, with separate absolute/relative regression gates.

One local Node run on September 7, 2026 measured these warmed medians. Timings and ratios depend on the machine and workload:

| Scene | Candidates / overlaps | Lean | JavaScript | Relative cost |
| --- | ---: | ---: | ---: | ---: |
| 256 sparse 2D boxes | 1,939 / 132 | 0.436 ms | 0.067 ms | 6.5× |
| 768 sparse 3D boxes | 9,132 / 8 | 1.819 ms | 0.339 ms | 5.4× |
| 128 dense 2D boxes | 8,128 / 8,128 | 1.764 ms | 0.218 ms | 8.1× |

Ratios use unrounded timings. The allocation refinements reduced Lean latency by about 18–24% from the first implementation. JavaScript remains faster on all three cases. The browser displays fresh measurements for its default 256-box workload.

Local Chromium's automatic 100-sample run measured a 0.40 ms Lean median, 0.59 ms p95, and 6.4× JS relative cost. A second 100-sample run measured 0.36 ms, 0.53 ms p95, and 6.1×. Both runs checked the complete candidate and overlap lists with no page errors.

For real browser interaction checks, serve the repository and run:

```sh
node demos/lean-sweep-and-prune/browser-ux-check.mjs
```

The helper defaults to `http://127.0.0.1:8765/demos/lean-sweep-and-prune/`; pass an assembled Pages URL as its first argument. It uses `/usr/bin/chromium`, overridable with `CHROMIUM_PATH`.

## Sources and provenance

[Cohen, Lin, Manocha, and Ponamgi's I-COLLIDE paper (1995)](https://www.cs.princeton.edu/courses/archive/spr01/cs598b/papers/cohen95.pdf), especially sections 4.2 and 5.1, describes axis projections, sweep-and-prune, and overlap filtering. Its incremental endpoint maintenance exploits coherence between frames. This demo implements the snapshot sort-and-sweep variant and does not reproduce I-COLLIDE's polyhedral narrow phase.

We also studied [Bullet 3.25's axis sweep implementation at commit `2c204c49`](https://github.com/bulletphysics/bullet3/blob/2c204c49e56ed15ec5fcfa71d199ab6d6570b3f5/src/BulletCollision/BroadphaseCollision/btAxisSweep3Internal.h), including its active-pair management and all-axis tests. Bullet's source carries a zlib license. This directory contains newly written Lean code, proofs, and a JS baseline; it does not vendor Bullet code or claim to port an existing formal proof.
