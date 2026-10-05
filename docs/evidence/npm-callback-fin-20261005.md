# Checked npm Fin callbacks and closures

VO: 1220. Ordinary-source Node JavaScript and TypeScript packages.

Closed `Fin` bounds survive callback extraction, semantic identity, generated wrappers, compiler plans, and private ABI 9 descriptors. Callback signature keys include direct bounds and nominal field constraints in a stable order. `Fin 3 → Fin 3` and `Fin 5 → Fin 5` have distinct identities despite sharing Nat's wire representation.

Generated JavaScript validates callback arguments and results. Compiled Lean checks host callback replies before constructing proof-carrying values, including fields reached through aliases and recursive constructors. Returned closures check their inputs independently of the JavaScript facade. Rejected calls release temporary carriers and leave subsequent valid calls usable. The public closure wrapper preserves disposal methods and state.

## Recovery and empty types

Callback failure uses the existing sticky error protocol. Later host invocations in the failed call are suppressed, and the original host exception is preserved. A valid Lean recovery value allows the call to unwind and clean up; the consumer receives the error, not that value. Positive Fin bounds use a proved zero. Arrays, lists, absent options, and productive variant branches can provide finite recovery values without constructing their elements.

A callback or returned-closure result with no finite recovery value is rejected during adapter generation. Bare `Fin 0` and records requiring `Fin 0` are examples. No `sorry`, axiom, unsafe cast, or fabricated inhabitant is generated. `Array (Fin 0)` and `Option (Fin 0)` results are accepted, but nonempty arrays and present options are rejected.

## Installed acceptance

`tests/helpers/callback-fin-packages.mjs` builds both profiles twice in relocated roots, preserving source bytes and mtimes. Receipts verify and archives reproduce:

| Profile | Component archive SHA-256 |
| --- | --- |
| Scalar and structural Fin callbacks, ABI 9 | `bdc7aebddf2848eee11170b1de461f63d6a7d25c25e795b7f3aeb314df149b10` |
| Nominal and recursive Fin callbacks, ABI 9 | `f1aa62d7acd5e0b34df5771a07600fda6b5d98818247c0c73babe7cca5491011` |

After moving both author projects away, the test installs only the runtime and component archives offline. Node checks cover scalar callbacks, captured returned closures, nested List/Option/product/Except payloads, record fields, alias chains, finite recursive trees, productive variants, and empty Fin 0 containers. Thirty-two rounds exercise rejection and recovery through both public wrappers and raw runtime calls. Checks also cover suppressed second callbacks after failure, original exception identity, reentry, getter-backed fields, wrong host types, disposal, and invalid ordinary scalar arguments sharing a nominal/callable component. Strict TypeScript checks run with `skipLibCheck: false` and reject number-valued Fin leaves. A fresh ordinary-source build rejects a bare Fin 0 callback result before packaging.

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test \
  --test-name-pattern='literal Fin bounds|Subtype constraints' \
  tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='checked Fin callbacks' tests/unlocked-component.test.mjs
```

Unit contracts reject mismatched bounds, malformed refinement trees, nominal-table drift, and uninhabited recovery results. They verify cleanup before closure dispatch and preserve constrained closure disposal. Fresh compiler metadata checks the explicit `refinement: "reject"` policy through callback signatures and continues to reject nested Subtype constraints.

Only ordinary-source Node JavaScript and TypeScript callback-parameter and callback-result Fin cells are promoted. Native, browser, reviewed-IR, asynchronous, and retained-host-callback support are not established by this acceptance. Historical source receipts remain recoverable through the exact callback-Fin source-history ledger.
