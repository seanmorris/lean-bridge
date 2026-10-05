# Nested npm `Fin` acceptance

VO: **1220** — generic specializations and checked refinement mappings.

Ordinary-source npm exports preserve closed literal `Fin` bounds inside arrays, lists, options, pairs, and `Except`. The public representation uses `bigint` at every constrained leaf. Binding IR retains the structural refinement tree, including success/error ordering and unconstrained siblings. JavaScript validates each bound; compiled Lean independently checks inputs before constructing proof-carrying values or dispatching the source function. Result conversion evaluates the source call once.

`tests/helpers/nested-fin-packages.mjs` builds each package twice under relocated roots, reproduces its archive, verifies the receipt, moves the author sources away, and installs only the npm archives offline. Every profile runs strict TypeScript with `skipLibCheck: false`.

The installed tests cover empty containers of `Fin 0`, nested `Fin 10` aliases, exact bounds above 64 bits, and nested lists/options/pairs/results. They repeat invalid-input/recovery cycles through both the public API and the internal runtime. The latter bypasses JavaScript refinement checks and requires recoverable rejection from compiled Lean. Callback composition checks that rejected inputs never invoke the host callback, and that valid returned closures still invoke and dispose normally.

Reproduced component archive SHA-256:

| Private ABI | Composition | SHA-256 |
| --- | --- | --- |
| 4 | Arrays | `8fe26b17c8700c1fadaa6d63896ae18683395a6e369d9b5b5a72820ab8983169` |
| 5 | Records alongside refined arrays | `271070bf5d209455b906969883003c744f9e969223f0f499ef7a5e30c09d9653` |
| 6 | Lists, options, pairs, results | `487ad5669a02a37a52c3a77082e959179424e0181158eae92bf40d5c25f615ad` |
| 7 | Nominal values alongside refined containers | `6272c7c138d94f628148ab1df2b0bbf9f2c389ceb2eec2695fe9485fce2f5d62` |
| 8 | Recursive values alongside refined containers | `ab0a96136cb05dedfe516a4a43ab3e315d06f308a7b526524f4879128b4af502` |
| 9 | Callbacks and returned closures | `1018d154dc7995103ea92a7c1ee9b192984c368c42452708fb630c9d72533806` |

Run:

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test \
  --test-name-pattern='literal Fin bounds|nested refinement metadata' \
  tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='nested Fin containers' tests/unlocked-component.test.mjs
```

This expands the existing ordinary-source Node JavaScript/TypeScript parameter/result evidence. It adds no support claims for browsers, native targets, reviewed IR, nominal fields, aliases wrapping refined containers, or callback-internal refinements. Explicit `refinement: "reject"` also rejects nested refinements. Historical receipts remain unchanged; the nested-Fin source-history ledger reconstructs their exact predecessors.
