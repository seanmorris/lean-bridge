# Tutte's squared rectangles

An interactive illustration of the Brooks–Smith–Stone–Tutte electrical-network construction. The page pairs exact square coordinates with their Smith diagram. Select a square or wire, inspect the current balance at a horizontal seam, enlarge a square to break the fit, and compare simple and compound rectangles. The voltage selector scales all lengths together.

The selector includes the first 20 simple perfect squared rectangles, ordered by square count, then width and height: two with nine squares, six with ten, and twelve with eleven. Previous and next buttons browse the list. The separate compound example adds one 33-square below the first rectangle. It still has unequal side lengths, but its original nine squares form a proper subrectangle. This distinguishes **simple** from **perfect**.

`constructions.mjs` generates coordinates from compact Bouwkamp tablecodes using an integer skyline. Its data contains the 30 order 9–11 entries in [David Moews's catalogue](https://djm.cc/simple-perfect-rects-to-16.txt); `generateConstructions(20)` reconstructs the first 20. This is catalogue reconstruction, not a search for new planar networks. Rotations, reflections, and rescalings are not counted as extra constructions. The page needs no network request to generate them. Lean checks each selected construction with the same unchanged certificate.

The voltage selector offers integer scales up to 3× within the checker's 256-unit dimension limit. Selecting a larger construction reduces the scale if needed, without rounding coordinates or weakening the check.

The third step adds the external pole-to-pole edge and lets visitors delete up to two junctions. Deleted vertices and incident edges fade; surviving components have different colors. The compound example provides a button to display a separating pair.

## Checked mathematics

`TutteCore.lean` implements exact natural-number checks for integer-coordinate tilings, electrical assignments, unequal side lengths, rectangular subsets, and vertex connectivity. `Tutte.lean` proves their acceptance guarantees:

- `coverage_exact`: every unit cell of an accepted rectangle belongs to exactly one square. All squares have positive side lengths and lie within the outer boundary.
- `current_eq_side` and `junction_balanced`: every accepted wire has unit resistance, its voltage difference equals the square side, and every internal junction conserves current. Terminal current equals the outer width.
- `closed_walk_zero`: voltage differences around every closed walk sum to zero, for arbitrary integer potentials.
- `no_rectangular_sublist`: no proper subsequence with two or more squares has area equal to its bounding box when the simplicity check accepts. For the accepted disjoint tilings, such an equality identifies a rectangular sub-tiling.
- `threeConnectedCheck_sound`: an accepted augmented graph has at least four vertices, and every removal of zero, one, or two vertices leaves paths from a surviving root to every other surviving vertex. Paths avoid deleted vertices and follow actual edges.
- `exported_certificate`: the first two flags of the exported Lean report establish the tiling and electrical predicates for the exact decoded input.

The full planar-network correspondence is illustrated, **not formalized**. In particular, this does not prove the general existence of a tiling for every suitable plane network, or derive 3-connectivity from geometric simplicity. The page checks both properties separately for its examples. The browser constructs and draws the Smith diagram from maximal connected horizontal segments. Segments at equal heights are not merged unless they touch. The proof covers the supplied integer geometry and graph, not this browser construction or rendering.

The C bridge only copies natural-number inputs and the result. The webpage uses the compiled Lean report for its certificate badges and junction totals. JavaScript independently computes selected graph-component highlights and a compound outline. Changing one square preserves the original seams so the failed voltage and current equations remain visible.

## Use the checker

```js
import { createChecker } from './runtime.mjs';
import { createScene, certificateInput } from './scenario.mjs';

const check = await createChecker();
const result = check(certificateInput(createScene()));
console.log(result.tiling, result.electrical); // true, true
console.log(result.simple, result.perfect, result.threeConnected);
```

Inputs are `{width, height, levels, squares}`. Dimensions are integers in 1–256. `levels` and `squares` must be `Uint32Array` values. There are 2–26 junctions and 1–12 square records; each record is `[x, y, side, topJunction, bottomJunction]`. All words are at most 256. The first and last junctions are the terminals. Invalid geometry returns failed predicates; malformed transport inputs throw. Each call owns its returned balances and leaves inputs unchanged. Runtime initialization is shared and failed loads can be retried.

Classification flags describe separate predicates. `perfect` requires at least two squares with distinct side lengths. Do not call invalid geometry a simple or perfect *tiling* merely because its classification flag is true. Require `tiling` and `electrical` first, as the page does. The simplicity check enumerates subsets and is exponential; these bounds intentionally limit it to teaching examples.

## Verification and benchmark

```sh
bash demos/lean-tutte/build.sh
node --test demos/lean-tutte/test.mjs
node demos/lean-tutte/benchmark.mjs --assert
node site/tutte-browser-check.mjs http://localhost:5173/
```

The build checks Lean proofs and executable guards, compiles that checker to WebAssembly, validates the module, and hashes the proof sources. The existing proof viewer provides syntax highlighting, the build receipt, and both external Lean checker links.

Compiled tests compare all presets and scales with independent JavaScript raster, subset, and adjacency checks. Negative cases include holes, overlaps, zero-sized squares, wrong potentials and junction indices, repeated sizes, and every single-square enlargement. Tests also cover disconnected equal-height seams, input limits, output ownership, repeated calls, and proof-receipt integrity.

Catalogue tests check numeric ordering, primitive units, uniqueness under all eight rotations/reflections, reconstruction errors, and acceptance of all 30 source entries. Browser checks select every displayed construction, browse in both directions, and change from a 3× small rectangle to a larger one requiring 1×.

The shared lazy browser benchmark compares the complete five-predicate certificate against JavaScript on the nine-square 33 × 32 example. Five excluded runs precede measured samples. Input setup and runtime startup are excluded; all predicates, returned current totals, adapter copies and output allocation are timed. Results are compared outside timing. This measures certificate checking, not synthesis of arbitrary squared rectangles.

## Source

R. L. Brooks, C. A. B. Smith, A. H. Stone, W. T. Tutte, [The Dissection of Rectangles into Squares](https://carlo-hamalainen.net/stuff/Brooks,%20Smith,%20Stone,%20Tutte%20-%20The%20dissection%20of%20rectangles%20into%20squares%20(1940).pdf), Duke Mathematical Journal 7 (1940), 312–340. Sections 1 and 4 describe the electrical correspondence; section 5 discusses simple rectangles. The demo source, diagrams and Lean proofs are new implementations.
