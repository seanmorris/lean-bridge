# Proven Lean flood fill and capability closure

This demo compiles a graph-generic Lean 4 flood fill to WebAssembly. Its browser adapter turns a two-level room and tile map into a finite directed graph: walls disable vertices, ordinary movement creates two directed edges, ledges remove reverse edges, doors attach reusable capability requirements, and key pickups grant capabilities. A ledge tile may own one cardinal edge or an adjacent pair such as up + left; paired modes create two separate cardinal transitions and never diagonal movement.

Neither the Lean implementation nor its theorem statements contain room, tile, key, door, or grid semantics.

## Guarantees

`floodFillCsr_correct` proves that the optimized CSR result contains a vertex exactly when an enabled directed walk reaches it from the start. The runtime validates a compact parent/rank and closure certificate before returning a result.

`capabilityClosureCsr_correct` additionally proves that automatic pickup returns:

- exact reachability under the final capability set;
- a stable set containing every capability granted by a reachable vertex;
- every starting capability; and
- the least such stable set, by inclusion.

The proof audit rejects `sorry` and `admit`, hashes the displayed source, and names the exact CSR theorems used by the Wasm path. Lean erases proof terms from the compiled module after checking them.

## Public API

`runtime.mjs` exports two typed-array operations:

```js
reachable({ vertexCount, offsets, targets, allowedVertices, allowedEdges, start })

reachableWithCapabilities({
  vertexCount,
  offsets,
  targets,
  allowedVertices,
  requirements,
  grants,
  initialCapabilities,
  capabilityCount,
  start
})
```

All arrays are `Uint32Array` values. A requirement or grant equal to `capabilityCount` means “none.” Capabilities are reusable and are never consumed.

## Build and verify

From the repository root:

```sh
demos/lean-flood-fill/build.sh
node --test demos/lean-flood-fill/test.mjs
node demos/lean-flood-fill/benchmark.mjs --assert
python3 -m http.server 8080
```

Open `http://localhost:8080/demos/lean-flood-fill/`. The randomized differential suite compares the compiled operations with independent JavaScript graph and fixed-point implementations. The benchmark measures the public API end to end, including CSR transfer, Lean execution, certificate checking, and result transfer.

## Trust boundary

Lean proves the generic graph operations and checks their result certificates. JavaScript remains responsible for faithfully translating the editable map into CSR arrays, rendering returned vertex indices, browser behavior, and the Emscripten/C ABI. The demo exposes this boundary rather than claiming that the room editor itself is formally verified.
