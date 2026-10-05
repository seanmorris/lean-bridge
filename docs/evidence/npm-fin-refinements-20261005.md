# npm `Fin n` refinement acceptance

VO1220 milestone, 2026-10-05.

## Accepted boundary

Compiler-backed ordinary-source npm builds accept top-level parameters and results whose elaborated Lean type is `Fin n` or a transparent alias of `Fin n`, when `n` reduces to a closed natural-number literal. Binding IR carries the runtime value as `Nat` plus a compiler-owned `fin` refinement containing the exact decimal bound. Generated JavaScript uses `bigint`, rejects negative values and values greater than or equal to the bound before Wasm dispatch, and validates returned values against the same bound. The generated Lean adapter checks the bound again before constructing `Fin`; result proofs are erased by projecting `.val` only after the source call.

The npm fixture builds the same mixed scalar-and-alias package from two relocated roots, reproduces both archives, verifies the component-package receipt, installs the archives offline, and executes the resulting Wasm from Node. It accepts `0` and `4` for `Fin 5`, rejects `-1` and `5`, and compiles a strict TypeScript caller against the installed `bigint` signature with `skipLibCheck` disabled. A separate real-Lean extractor test covers `Fin 0`, a transparent `Fin 7` alias, exact metadata/IR bounds, and rejection of nested `Array (Fin 5)`.

This evidence promotes only ordinary-source Node JavaScript and Node TypeScript parameter/result cells for `Fin n`. It does not claim browser execution, reviewed-IR admission, native profiles, nested refinements, callbacks containing `Fin`, nonliteral bounds, or dependent refinements. Checked `Subtype` constructors have a [separate, narrower acceptance boundary](npm-subtype-refinements-20261005.md).

## Commands

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test --test-name-pattern='literal Fin bounds' tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test --test-name-pattern='finite specializations compile' tests/unlocked-component.test.mjs
```

The reproducible installed component archive SHA-256 is:

```text
9da2785eca60bf8b7acebbea266c8467206f319bb1b277a7b132f953f60152dd
```
