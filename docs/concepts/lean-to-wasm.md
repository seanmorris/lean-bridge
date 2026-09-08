# From a Lean proof to a browser result

In the sweep-and-prune demo, dragging a rectangle creates a new input snapshot. Compiled Lean returns the candidate pairs and the exact overlapping pairs. React draws that result; it does not run a replacement pair-finding algorithm.

## Start with the named behavior

For axis-aligned boxes, overlap means that their intervals overlap on every axis. Touching boundaries count. The Lean specification accepts integer coordinates, so the browser rounds its scene coordinates before submitting a snapshot.

`LeanSweep.solve_total` describes the decoded exported result. The returned candidates match overlap on the selected axis; the final pairs match overlap on every axis; each pair appears once. Selecting X instead of Y can change the candidates but cannot change the final overlaps for the same boxes.

Try that change in the [sweep-and-prune workbench](../../demos/lean-sweep-and-prune/index.html). The [algorithm guide](../../demos/lean-sweep-and-prune/README.md) explains the active set and the refinement lemmas.

## Follow the build

| Stage | Input | Result |
| --- | --- | --- |
| Lean elaboration | Definitions and proofs | Checked declarations and generated C for the implementation. |
| Demo proof audit | Maintained source files and required theorem names | A source-hashed receipt; missing theorems and unchecked declaration forms stop this demo's build. |
| Native compilation | Generated C, a small C adapter, and the Lean runtime | An ES module loader and a Wasm binary. |
| Site assembly | Checked sources, receipt, loader, and binary | Published files plus a build identity containing their hashes. |
| Browser solve | A validated box snapshot | Owned arrays of candidate and overlap IDs. |

Proof terms establish properties during checking. The browser runs the compiled implementation; it does not repeat the Lean proof on every drag. Sweep-and-prune uses proved implementation refinements, including compiler simplification lemmas, to compile its efficient loop. Its runtime does not compare every result with a quadratic oracle.

Some other demos use checked runtime certificates. Dinic, for example, returns a feasible flow and a cut with matching capacity. Read each demo's implementation section to see which computation and checks its timings include.

## Reproduce this demo

From a prepared repository checkout:

```sh
bash demos/lean-sweep-and-prune/build.sh
node --test demos/lean-sweep-and-prune/test.mjs
node demos/lean-sweep-and-prune/benchmark.mjs --assert
npm run demos:site
```

The [build script](../../demos/lean-sweep-and-prune/build.sh) selects the maintained modules. The [audit generator](../../demos/lean-sweep-and-prune/generate-proof-audit.mjs) names the required declarations. The resulting [proof receipt](../../demos/lean-sweep-and-prune/runtime/proof-audit.json) identifies those sources.

Open the proof panel to read highlighted Lean, copy a file, and prepare either external checker. The source status confirms that the downloaded text matches the receipt. The WASM checker runs Lean on the source; Comparator checks a solution against the supplied challenge. Read the challenge and the theorem it asks the solution to establish.

## Know which record you are reading

A demo receipt identifies checked source files and required theorems. The site build identity binds published file hashes to a revision. Neither record is a signed package-release authorization.

An ordinary library built with the package CLI follows a separate path. Its analyzer records theorem references as `unverified`; the author tutorial performs an explicit strict Lean check and shows that metadata without relabeling it. See [Proofs and assurance](../lean/proofs-and-assurance.md).

The sweep theorem concerns each submitted snapshot. It does not claim continuous collision detection between animation frames. The coordinates and sampling rules belong to the caller.

## Use the core elsewhere

Boxes need no canvas, scene, or React component. The [local API recipe](../demo-api.md) calls the same compiled solver with a small typed array and releases its prepared resources.
