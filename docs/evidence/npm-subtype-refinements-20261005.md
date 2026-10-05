# npm checked `Subtype` constructor acceptance

VO1220 milestone, 2026-10-05.

## Accepted boundary

Compiler-backed ordinary-source npm builds accept a top-level `Subtype` parameter or result when its export contract names an exact checked constructor. Lean verifies that the constructor belongs to a selected module, takes one explicit value of the subtype's base type, and returns `Option` of that exact subtype. Analysis also rejects constructors whose selected-module implementation graph reaches unsafe, partial, foreign, or `implemented_by` code.

The accepted slice uses primitive bases in scalar or finite record component packages, including heap-backed `Nat`, `Int`, `String`, and `ByteArray`. Binding IR exposes the base primitive and retains the constructor identity as compiler-owned refinement metadata. A generated Wasm export calls the Lean constructor before the source function: `.none` becomes a boundary rejection and `.some value` supplies the proof-carrying subtype. For heap-backed values, the native adapter retains a separate reference for validation and releases all decoded inputs if validation rejects. Results originate as the declared Lean subtype and cross the host boundary only after the generated Lean adapter projects `.val`.

The installed fixture defines checked subtypes over `UInt32` and `String`. It builds from two relocated roots, reproduces both npm archives, verifies the component-package receipt, installs the archives offline, accepts `9` and nonempty Unicode text, rejects `10` and the empty string before the source functions run, and compiles strict TypeScript signatures using `number` and `string`. A separate real-Lean extraction test verifies exact metadata and Binding IR while confirming that an unconfigured subtype remains unsupported. A generated-C regression checks that heap validation retains its argument and releases every decoded object on rejection.

This evidence promotes only ordinary-source Node JavaScript and Node TypeScript parameter/result cells for configured top-level subtypes over primitives. Installed execution covers `UInt32` and `String`; the shared primitive transport covers the remaining primitive bases. It does not claim nested subtypes, callback positions, synthesized constructors from arbitrary predicates, reviewed IR, browser execution, native profiles, or unsafe/partial/foreign constructor implementations.

## Commands

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test --test-name-pattern='checked constructors admit' tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test --test-name-pattern='finite specializations compile' tests/unlocked-component.test.mjs
```

The reproducible installed component archive SHA-256 is:

```text
9da2785eca60bf8b7acebbea266c8467206f319bb1b277a7b132f953f60152dd
```
