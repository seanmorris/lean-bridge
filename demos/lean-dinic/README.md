# Proven Lean maximum flow and minimum cut

Dinic's algorithm finds the largest flow a directed capacity network can carry from a source to a sink. The result includes a flow for every original edge and a minimum cut separating the terminals. Lean proves that the flow respects capacities, conserves flow at intermediate vertices, and equals the cut capacity. Every feasible integer flow is bounded by that same cut.

## Interaction

The opening network carries nine units per second. Its two links into Sink have capacities four and five. Select **Widen C → Sink to 9** to raise throughput to fourteen. The highlighted minimum cut moves to the two source links, whose capacities are eight and six.

Select a link or its flow/capacity label to edit its capacity in the right-hand controls. Zero closes a link without removing it from the editor. Reset restores the original network. Outlined packets travel along links carrying positive flow; zero-flow links stay still. The page also lists the links crossing the displayed cut. Pausing animation does not change the solution. Reduced-motion preferences start the animation paused, with a Play control to enable it explicitly.

A saturated link need not belong to the displayed minimum cut, and several minimum cuts can tie. Only links directed from the returned source side to the sink side contribute to that cut's capacity. Node badges and region shading show membership. On narrow screens, the network scrolls horizontally to preserve readable labels.

## Generic graph API

```js
import { prepareGraph } from "./runtime.mjs";

const solve = await prepareGraph({
  vertexCount: 4,
  source: 0,
  sink: 3,
  offsets: new Uint32Array([0, 2, 3, 4, 4]),
  targets: new Uint32Array([1, 2, 3, 3]),
  capacities: new Uint32Array([8, 6, 4, 5])
});
const result = solve();
// value: 9, cutCapacity: 9
// flows: Uint32Array([4, 5, 4, 5])
// sourceSide: Uint32Array([1, 1, 1, 0])
// phaseCount, augmentationCount, usedFallback
solve.dispose();
```

The Lean core uses natural-number capacities and vertex IDs. It has no layout, timing, or application-specific rules. The demo labels capacity as units per second; callers can choose their own units.

The adapter accepts 2–65,536 vertices and at most 1,000,000 directed edges. Source and sink must be distinct in-range vertices. CSR offsets contain `vertexCount + 1` entries, start at zero, are monotone, and end at the edge count. Targets and capacities have equal lengths. All three arrays must be `Uint32Array` instances. Every capacity can use the full unsigned 32-bit range.

Each CSR entry remains a distinct edge, including parallel edges, antiparallel edges, self-loops, and zero-capacity links. Returned flows follow that original edge order. `sourceSide` contains one 0/1 flag per vertex. Disconnected terminals return zero flow and a zero-capacity cut.

Preparation snapshots input and configuration before its first await, builds the residual graph once, and returns an independently owned synchronous solver. Each call starts with zero flow and returns independently owned arrays. Disposal is idempotent; further calls throw. `solveGraph(request)` prepares, solves, and disposes in one call. `solveGraphTotal(request)` exercises the proved exhaustive reference directly and should only be used with tiny diagnostic networks.

Explicit reference calls, including `solve(true)`, reject networks above 12 vertices, 24 edges, or 100,000 possible flow assignments before enumeration. This guard does not change the automatic reference branch in the Lean solver.

Flow and cut totals can exceed one machine word. Lean serializes them as low/high 32-bit words, and JavaScript reconstructs exact Numbers. The input limits keep aggregate capacity below JavaScript's exact integer limit. The wire header has eleven words:

| Words | Meaning |
| --- | --- |
| 0 | Success status, zero |
| 1–2 | Flow value, low/high words |
| 3–4 | Cut capacity, low/high words |
| 5–6 | Vertex count and original edge count |
| 7 | Dinic phase count |
| 8–9 | Augmentation count, low/high words |
| 10 | Whether the total reference was used, 0/1 |

The header is followed by one flow word per original edge, then one cut-membership word per vertex. Phase and augmentation counts describe the actual Dinic search; direct reference runs report zero for both.

## Algorithm and proofs

Each original edge owns a forward residual arc and its reverse. This preserves the identity of parallel and antiparallel edges. Lean builds CSR adjacency for both directions. A breadth-first pass assigns levels; current-arc pointers and an explicit depth-first stack find paths through that level graph. Augmentation spends forward residual capacity and restores the paired reverse capacity. Later phases can cancel earlier choices through reverse arcs. The implementation uses structural loop budgets and avoids recursion on the host stack for graph traversal.

The executable certificate makes linear passes over edges and vertices. It checks every edge capacity, accumulates signed vertex balances, checks terminal value and intermediate conservation, verifies cut membership, and compares cut capacity with flow value. `certificateCheck_sound` proves that acceptance establishes a maximum flow and a minimum cut.

If Dinic's candidate fails certification, a total reference enumerates all bounded integer edge-flow assignments and all separating cuts. It selects a maximum feasible flow and a minimum cut. Its search spaces have sizes `∏(capacity[e] + 1)` and `2^V`; it is exponentially expensive. Normal compiled tests and benchmarks require the candidate to pass certification without entering this reference.

The result guarantee covers the combined solver. Local Dinic proofs establish residual-pair conservation, positive progress, path-capacity safety, and bounds on the implemented phase and augmentation counters. They do not establish that Dinic's search budgets always suffice. The certificate and total reference give the unconditional output guarantee when a search stops early.

The proof of flow-cut equality also covers the reference. A residual walk can be shortened to a simple path with distinct original edge IDs. Augmenting such a path by one unit preserves capacity and vertex conservation while increasing flow value. A maximum flow therefore has no residual source-to-sink route. Its residual reachable set forms a cut whose forward crossings are saturated and reverse crossings carry zero flow. Summing vertex balances shows that this cut matches the flow. Consequently, any independently selected maximum flow and minimum cut have equal values.

Key checked theorems include:

- `flow_cut_upper_bound`: every feasible flow is bounded by every separating cut.
- `matching_flow_cut_optimal` and `matching_cut_edges`: matching flow/cut values prove both optima and saturation of the cut's forward links.
- `findPath_fits`, `augmentArc_pair_sum`, and `augmentArc_positive_progress`: the path search respects residual capacities and augmentation preserves paired capacity while making progress.
- `maximumFlow_minimumCut_equal` and `referenceSolve_certificate`: max-flow/min-cut equality applies to every valid network and to the executable reference result.
- `solve_total`: every valid network prepares and returns a solution, without a search-success or fuel premise.
- `exported_optimal`, `exported_flow_cut_equal`, and `exported_certificate`: the exact serialized edge flows, cut flags, and reconstructed value satisfy the proved guarantees.
- `solveExport_words_bounded` and `totalCapacity_javascript_exact`: adapter limits keep every serialized word within 32 bits and displayed totals within exact JavaScript integer range.

All maintained Lean modules appear in the syntax-highlighted viewer, build receipt, and both browser checker bundles. The build checks the proofs and executable guards before compiling the solver and certificate. The receipt hashes the checked sources. The proofs contain no unchecked declarations or native replacement hooks. C owns and copies values; JavaScript translates CSR inputs and displays the result.

## Verification and benchmark

```sh
bash demos/lean-dinic/build.sh
node --test demos/lean-dinic/test.mjs
node demos/lean-dinic/benchmark.mjs --assert
```

Compiled tests compare with an independent BigInt Edmonds–Karp implementation and exhaustive cuts on small graphs. They cover all 729 three-vertex capacity-0/1/2 graphs with all six terminal pairs, all 4,096 four-vertex unit-capacity directed topologies, random multigraphs, reverse-edge rerouting, wide totals, disconnected networks, a 10,000-node chain, input snapshots, output ownership, and disposal. Separate Lean guards reject corrupted capacities, conservation, value, and cut witnesses. Tiny tests exercise the total reference directly.

The browser automatically benchmarks a 130-vertex, 496-edge layered network against a typed-array JavaScript Dinic implementation. Both return all original edge flows and cut membership. Preparation is excluded, but Lean certification and both implementations' output allocations remain inside timing. Every measured pair is validated against the independent optimum and checked for capacity, conservation, and flow-cut equality. Five excluded samples warm both implementations before 100 measured pairs. Adaptive batching handles coarse browser timers; measurement order alternates. The CLI also checks a 386-vertex, 1,504-edge network.

With the demo served locally, run `node demos/lean-dinic/browser-animation-check.mjs http://127.0.0.1:8765/demos/lean-dinic/` to check moving packet positions and rendered pixels, pause/resume, and reduced-motion behavior in Chromium. Set `CHROMIUM_PATH` if Chromium is installed somewhere other than `/usr/bin/chromium`.

On September 7, 2026, the local Chromium benchmark measured a 0.54 ms Lean median against 0.17 ms JavaScript on the 130-vertex network, a 3.2× relative cost. A second 100-sample run measured 0.54 ms against 0.16 ms, or 3.3×. Lean p95 was 0.71 ms and 0.76 ms respectively. These measurements describe this browser and machine; the page measures the visitor's environment directly.

## Sources

The search follows the level-graph and blocking-flow formulation in [Yefim Dinitz's account of his algorithm](https://www.cs.bgu.ac.il/~dinitz/Papers/Dinitz_alg.pdf). The proof structure uses the standard residual-network and flow-cut arguments also developed in [Lammich and Sefidgar's formalization of network flow algorithms](https://www21.in.tum.de/~lammich/max_flow/). This directory contains a new Lean implementation and proofs, not a translation of the Isabelle source.
