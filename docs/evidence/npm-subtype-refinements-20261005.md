# npm checked `Subtype` constructor acceptance

VO1220 milestone, 2026-10-05.

## Accepted boundary

Compiler-backed ordinary-source npm builds accept a top-level `Subtype` parameter or result when its export contract names an exact checked constructor. Lean verifies that the constructor belongs to a selected module, takes one explicit value of the subtype's base type, and returns `Option` of that exact subtype. Analysis also rejects constructors whose selected-module implementation graph reaches unsafe, partial, foreign, or `implemented_by` code.

The first accepted slice uses unboxed primitive bases in scalar or finite record component packages. Binding IR exposes the base primitive and retains the constructor identity as compiler-owned refinement metadata. A generated Wasm export calls the Lean constructor before the source function: `.none` becomes a boundary rejection and `.some value` supplies the proof-carrying subtype. Results originate as the declared Lean subtype and cross the host boundary only after the generated Lean adapter projects `.val`.

The installed fixture defines `Small := { value : UInt32 // value < 10 }`, exports `echoSmall : Small -> Small`, and configures `checkedSmall : UInt32 -> Option Small`. It builds from two relocated roots, reproduces both npm archives, verifies the component-package receipt, installs the archives offline, accepts `9`, rejects `10` before `echoSmall` runs, and compiles a strict TypeScript consumer whose public signature is `(arg0: number) => number`. A separate real-Lean extraction test verifies exact metadata and Binding IR while confirming that an unconfigured subtype remains unsupported.

This evidence promotes only ordinary-source Node JavaScript and Node TypeScript parameter/result cells for configured top-level subtypes over unboxed primitives. It does not claim nested subtypes, callback positions, heap-backed bases such as `Nat` or `String`, synthesized constructors from arbitrary predicates, reviewed IR, browser execution, native profiles, or unsafe/partial/foreign constructor implementations.

## Commands

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test --test-name-pattern='checked constructors admit' tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test --test-name-pattern='finite specializations compile' tests/unlocked-component.test.mjs
```

The reproducible installed component archive SHA-256 is:

```text
a73efa043f47e2a814caca3adfeaba79714094ccf96c702139b9f900ddbcbe87
```
