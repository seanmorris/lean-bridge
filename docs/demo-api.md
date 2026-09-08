# Use a demo's local API

You can call a demo's compiled algorithm without its webpage or React. This example uses the maintained sweep-and-prune adapter directly from a repository checkout. The demo is not an npm algorithm package.

## Prepare the files

Build the demo with the repository's pinned toolchains:

```sh
bash demos/lean-sweep-and-prune/build.sh
```

The adapter is `demos/lean-sweep-and-prune/runtime.mjs`. Its sibling `runtime/` directory contains the loader and Wasm binary. Keep that relative directory structure when serving the files. The adapter chooses the runtime location from its own module URL.

For a local Node example, create `overlaps.mjs` at the repository root:

```js
import { prepareSweep } from './demos/lean-sweep-and-prune/runtime.mjs';

const solve = await prepareSweep({
  dimensions: 2,
  axis: 0,
  boxes: Int32Array.of(
    0, 0, 4, 4,
    2, 8, 6, 12,
    2, 2, 6, 6
  )
});

try {
  const result = solve();
  console.log(Array.from(result.overlaps)); // [0, 2]
  console.log(result.candidates.length / 2); // 3
} finally {
  solve.dispose();
}
```

```sh
node overlaps.mjs
```

The result contains the input IDs of the first and third boxes. All three pairs share an X interval, but only boxes 0 and 2 also share a Y interval.

## Pack and interpret the input

Each 2D box uses four integers: `minX, minY, maxX, maxY`. The accepted input is an `Int32Array`; lower bounds must not exceed upper bounds. In 3D, use six integers per box: all three lower bounds, then all three upper bounds. Select an axis from zero through `dimensions - 1`.

The adapter accepts 2D or 3D input and up to 1,024 boxes. Coordinates use the full signed 32-bit range. Choose the units or fixed-point scale in the application. Touching edges and corners count as overlaps.

Each output is a flattened `Uint32Array` of pairs. IDs are zero-based input positions. The smaller ID comes first within each pair; enumeration order is not an API guarantee. The returned arrays own their data.

## Own the prepared solve

Preparation copies the input before awaiting initialization. Mutating the original typed array afterward does not change the prepared problem. Repeated calls solve that same snapshot; prepare another handle for changed coordinates.

Release a prepared solve in `finally`, including when later application work throws. `dispose()` is idempotent, and calling the solver afterward throws. Disposing a handle releases its prepared resources; the shared initialized module remains cached.

In a UI, a preparation can finish after navigation. If its owner has already left, dispose that late handle without using its result. The [React guide](react.md) covers asynchronous ownership for the separately packaged tutorial; this local prepared API additionally requires explicit disposal.

## Choose the integration path

Use the [interactive workbench](../demos/lean-sweep-and-prune/index.html) to inspect the two pair sets. Read the [algorithm's API contract](../demos/lean-sweep-and-prune/README.md) for input rejection, proofs, and differential tests.

If you want an installable package from your own Lean source, follow [Package a Lean library](lean-author-guide.md). Copying the demo adapter does not create that package or its release receipt.
