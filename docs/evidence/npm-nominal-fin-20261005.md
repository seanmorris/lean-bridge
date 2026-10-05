# Checked npm Fin fields and aliases

VO: 1220. Implementation: `575428a`, with scalar composition checks in `d699948`.

Ordinary-source npm packages preserve closed `Fin` bounds in copied record and variant fields, container aliases, alias chains, and finite recursive values. The public value remains `bigint`. JavaScript validates constrained fields after checking their data shapes. Compiled Lean independently checks every bound before constructing a source value.

Nominal constraints select the existing copied-graph transport. Its typed array carriers can represent failed construction without requiring a default inhabitant. The C decoder preserves alias constructors and rejects empty argument carriers before calling the source function. This matters for `Fin 0`: no value can be constructed, but empty containers, absent options, and other variant branches remain valid.

## Installed acceptance

`tests/helpers/nominal-fin-packages.mjs` builds an ordinary Lean package twice under relocated roots. Both builds leave source bytes and mtimes unchanged, verify their receipts, and reproduce archive SHA-256:

`4192d879117d0ae060c5b938ad7ca19c340465b6d9c9b97b11dd6a26785494be`

After moving both author projects away, the test installs only the component and runtime archives offline. The installed consumer passes strict TypeScript with `skipLibCheck: false`. Runtime checks cover records, aliases, nested List/Option/product/Except fields, variants, recursive trees, `Fin 0`, and bounds above 64 bits. Invalid inputs are rejected through both the public API and direct runtime calls that bypass JavaScript refinement validation. Thirty-two rounds of rejection/recovery cover every invalid bound and both argument positions, including simultaneous failures. Getter-backed fields, sparse arrays, cycles, wrong host types, and negative values are rejected; valid inputs remain unchanged.

Focused tests authenticate the nominal constraint table against its wire types, reject malformed or nested Subtype metadata, and check cleanup before dispatch. Fresh Lean extraction checks `refinement: "reject"` through records, aliases, and recursive graphs. Scalar `Fin 3` and `Fin 0` exports in the same component also reject invalid inputs before dispatch and leave the runtime usable.

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test \
  --test-name-pattern='literal Fin bounds|nested refinement metadata' \
  tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='nominal Fin fields' tests/unlocked-component.test.mjs
```

The evidence covers ordinary-source Node JavaScript and TypeScript. Callback-internal refinements, native refinements, and components combining nominal Fin with callbacks or returned closures remain unsupported. Browser and reviewed-IR support are not promoted by these tests. Prior installed receipts remain unchanged; the nominal-Fin source-history ledger authenticates their exact predecessors.
