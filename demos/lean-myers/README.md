# Proven Lean Myers shortest edit scripts

Myers finds a shortest insertion/deletion script between two finite sequences. Lean proves that the returned operations reconstruct the target and that every valid script has at least the returned edit cost. Keeping an equal item costs zero. Removing or adding an item costs one; replacing an item therefore costs two.

## Interaction

Edit either document. The comparison updates automatically and shows the minimum edit count, additions, removals, and unchanged context. The opening example changes two settings: two line removals and two additions, for four edits. Character mode shows the smaller changes within those lines. Presets also cover prose, repeated lines, Unicode, mixed line endings, and an empty target.

Red and green spans come from the selected Lean script. Line mode treats each whole line, including its terminator, as one item. Character mode uses Unicode code points, not UTF-16 code units or grapheme clusters. It runs a separate compiled line comparison to align preview rows; this layout result does not determine the displayed character edit count or character highlights.

Spaces, tabs, accents, and terminators are significant. The adapter preserves LF, CRLF, CR, and a missing final newline. Newline badges expose these differences. JavaScript retains the original source separately from the textarea's normalized value and reconciles edits, paste, and native undo/redo. No input is silently truncated. If the selected mode exceeds the token limit, the page keeps the text and displays a recoverable error.

Several shortest scripts can tie, especially with repeated text. The demo shows one valid minimum script. A reordered line can appear as a removal and an addition; moves and one-step substitutions are not operations in this cost model.

## Generic API

```js
import { prepareDiff, diffTokens } from "./runtime.mjs";

const before = Uint32Array.of(10, 20, 30);
const after = Uint32Array.of(10, 40, 20, 30);
const result = await diffTokens(before, after);
// distance: 1
// operations: Uint32Array([0, 2, 0, 0])
// usedFallback: false

const solve = await prepareDiff({ before, after });
const first = solve();
const second = solve();
solve.dispose();
```

The core compares token identities. It has no text, newline, layout, or browser rules. The generic proof specification works over arbitrary element types; the compiled API uses natural-number IDs supplied as unsigned 32-bit values. Zero and the full `0xffffffff` value are valid IDs.

Both arguments must be `Uint32Array` instances. Their combined length must not exceed 4,096. Either or both may be empty. Preparation snapshots both arrays before its first await. Each solver call starts a fresh comparison and returns an independently owned operation array. Separate prepared solvers do not share caller-visible state. Disposal is idempotent; later calls throw.

Read the operation array from left to right with a cursor in each input:

| Code | Operation | Source cursor | Target cursor | Cost |
| --- | --- | --- | --- | --- |
| 0 | Keep equal tokens | Advance | Advance | 0 |
| 1 | Delete source token | Advance | Stay | 1 |
| 2 | Insert target token | Stay | Advance | 1 |

Both cursors end exactly at their input lengths. The compact output encodes insertion positions; the target input supplies inserted values. `exported_patch_reconstructs` additionally proves that the source and extracted insertion payload suffice to reconstruct the target without retaining the rest of the target.

`diffTokensTotal(before, after)` and `solve(true)` run the proved reference directly for diagnostics. The JavaScript adapter rejects explicit reference calls above twelve combined tokens before enumeration. Normal solves use the optimized certified implementation. A `usedFallback` result indicates that the Lean solver entered its exhaustive reference, not that it used the general band certificate.

Lean serializes six header words: status (zero), edit distance, source length, target length, operation count, and the 0/1 reference flag. Operation words follow the header; the C bridge copies these words into the output buffer. Lean proves the decoded script is optimal and reconstructs the target, that the output fits `6 + sourceLength + targetLength` words, and that every word fits unsigned 32 bits under the adapter's input bound.

## Algorithm and proofs

The search keeps the furthest reachable source position on each diagonal at each edit depth. It follows equal-token runs without charging edits, then explores insertion and deletion steps at the next depth. Compact triangular trace rows preserve enough information to reconstruct the complete script. Empty inputs and identical sequences have direct paths that avoid unnecessary wavefront history.

The executable solver validates the actual candidate script and matches its cost to a proved lower bound. Array-indexed validation, cost counting, and array-based reconstruction are proved equivalent to their list specifications; these paths avoid copying whole inputs into linked lists.

1. A bounded token score gives a lower bound on every script. Assigning each token a score between −1 and 1 means one insertion or deletion can change the total score by at most one. Hash histograms choose scores, but the checker independently computes the weighted difference over the actual inputs. It accepts only when that difference equals the candidate edit cost. Collisions can weaken this certificate, so the solver tries two bucket counts before proceeding.
2. For order-sensitive changes and unresolved collisions, a truncated edit-graph potential supplies the lower bound. Every deletion/insertion edge may increase the potential by at most one; a matching edge may not increase it. Outside the strict diagonal band, the potential is the candidate distance. Lean proves all omitted edge inequalities too, including paths that leave and reenter the band.
3. If both certificates reject the candidate, a total reference searches the recursively smaller edit problems and returns a proved optimal script. This reference is exponential. Normal compiled tests and benchmarks require certification without entering it.

The result theorem covers this combined solver without a candidate-success or fuel premise. Local wavefront lemmas cover progress, bounds, and matching runs. The implementation does not claim a direct proof that every optimized wavefront trace is already optimal before certification.

The wavefront uses compact trace storage proportional to the squared edit depth. The score certificate adds linear input work and a fixed bucket array. The general certificate uses at most `(sourceLength + 1) × min(2 × distance − 1, targetLength + 1)` stored values, with no band allocation at distance zero. Worst-case large differences can still require quadratic work and storage. JavaScript's tokenization, rendering, and C ownership/copying are outside the Lean proofs.

The 4,096-token limit is a size limit, not a latency promise. A local stress check replacing all 2,048 source tokens with 2,048 different tokens took 1.34 seconds and increased process RSS by about 43 MB. It returned the full 4,096-edit script without fallback. The demo solves synchronously, so a maximal-difference comparison can briefly block editing.

Checked guarantees include exact replay from the source and insertion payload, global minimum cost, cost symmetry, the length-difference lower bound, zero cost exactly for identical inputs, legal opcodes, complete input consumption, and bounded serialization. All maintained Lean modules appear in the source viewer and both checker bundles. The build receipt hashes them after compilation checks. No unchecked declarations or native algorithm replacement hooks are used.

## Verification and performance

```sh
bash demos/lean-myers/build.sh
node --test demos/lean-myers/test.mjs
node demos/lean-myers/benchmark.mjs --assert
```

Tests compare complete scripts against an independent quadratic dynamic-programming oracle. They cover all 16,129 binary-sequence pairs through length six, all 1,600 ternary pairs through length three, seeded random comparisons in both directions, the paper's example, repeated-token ties, full uint32 IDs, 4,096-token empty-side cases, ownership, disposal, malformed results, Unicode, and exact line endings. Lean guards reject invalid keeps, malformed operations, incorrect costs, valid but nonminimal scripts, corrupted potentials, and misleading hash collisions. Tiny tests exercise the total reference directly.

The browser automatically runs five excluded warmup samples followed by 100 measured pairs. Lean and a typed-array JavaScript Myers baseline receive identical pre-tokenized sequences and return complete owned operation arrays. The JS baseline trims common prefixes/suffixes and stores compact trace rows. Preparation and tokenization are excluded; Lean certificate checks, reconstruction, result serialization, and both output allocations remain timed. Measurement order alternates, and adaptive batching handles timer resolution. Every measured pair is replayed and compared with the independent optimum outside timing.

The default workload compares 384 source tokens with 386 target tokens and fourteen edits. The CLI also tests 1,024 tokens with repeated values and a 128-token block reorder that needs the order-sensitive band certificate. Benchmarks compare complete scripts, not a full Lean result against a JS distance-only function.

One local Node run on September 7, 2026 measured these warmed medians. They describe this machine and these inputs, not a universal speed ratio:

| Workload | Lean | JavaScript | Relative cost |
| --- | ---: | ---: | ---: |
| 384 → 386 tokens, 14 edits | 0.034 ms | 0.005 ms | 7.4× |
| 1,024 → 1,026 repeated tokens, 14 edits | 0.076 ms | 0.009 ms | 8.7× |
| 128-token block reorder, 8 edits | 0.360 ms | 0.001 ms | 249.6× |

Ratios use unrounded timings. The block reorder has unchanged token counts, so score certificates cannot certify it; the general certificate dominates its runtime. Its high ratio is a remaining optimization opportunity. The CLI guards each workload with both an absolute and a relative regression limit, allowing headroom for CI variation. The browser displays fresh measurements on the user's machine.

Local Chromium's automatic 100-sample default run measured 0.03 ms Lean median, 0.05 ms p95, and 6.0× JS relative cost. A second 100-sample run measured 6.2×. Both runs replayed every measured result and reported no errors.

With the demo served, run `node demos/lean-myers/browser-ux-check.mjs` for real Chromium interaction checks. The helper defaults to `http://127.0.0.1:8765/demos/lean-myers/` and accepts another demo URL as its first argument. It covers paste, undo/redo, newline edits, Unicode, empty inputs, limits, rapid updates, HTML escaping, and responsive layouts. Set `CHROMIUM_PATH` to override `/usr/bin/chromium`.

## Sources and provenance

The search and trace reconstruction follow [Eugene Myers's 1986 paper](https://neil.fraser.name/writing/diff/myers.pdf). The paper presents the shortest-edit problem, furthest-reaching diagonals, and reconstruction from saved wavefronts.

We also studied [jsdiff 8.0.2 at commit `4f5c473662bedd672809b689771037d5401bdcc6`](https://github.com/kpdecker/jsdiff/blob/4f5c473662bedd672809b689771037d5401bdcc6/src/diff/base.ts), including its boundary handling and reconstruction. That reference is [BSD-3-Clause licensed](https://github.com/kpdecker/jsdiff/blob/4f5c473662bedd672809b689771037d5401bdcc6/LICENSE). This directory contains newly written Lean code, proofs, and a typed-array JS baseline; it does not vendor jsdiff or claim to port an existing formal Myers proof.
