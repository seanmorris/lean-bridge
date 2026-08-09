# Generated Error Envelope Evidence

Status: the JavaScript backend generates a versioned scalar error envelope and projects declared failures as native error classes.

## Contract

`compileErrorEnvelopeV1` reads one synchronous function and its closed failure set from Binding IR. It assigns deterministic numeric tags, lays out the result and payload union, records the unexpected-failure policy, and rejects values that the adapter cannot preserve.

The version 1 header uses four unsigned 32-bit fields:

| Offset | Field | Meaning |
|---:|---|---|
| 0 | ABI version | Must equal 1. |
| 4 | byte size | Must equal the generated plan size. |
| 8 | outcome | 0 for a value, 1 for a declared error, 2 for an unexpected failure. |
| 12 | error tag | Identifies one error from the declaration's closed failure set. |

The plan places the copied result after the header and uses one aligned payload region for declared errors. Version 1 supports unit, booleans, integers through 32 bits, and 32-bit or 64-bit floating-point values. String, byte, record, resource, and generic error payloads fail coverage until their lowering exists.

## JavaScript behavior

The private runtime validates the envelope version, byte size, outcome, tag, result, and payload before returning control to generated package code. A declared error crosses the private boundary with its semantic error ID and copied payload. The generated root module converts it to the named `Error` subclass declared by Binding IR.

```ts
try {
  checkedPred(0);
} catch (error) {
  if (error instanceof Underflow) {
    console.log(error.payload);
  }
}
```

An unexpected outcome follows the declaration's policy. `poison-runtime` makes the shared runtime reject later calls. `trap` reports the failed call and leaves later calls available. A corrupt version, byte size, status, or error tag always poisons the runtime because the adapter can no longer trust the boundary.

## Executable checks

`tests/error-envelope.test.mjs` verifies deterministic layout, private adapter requirements, copied success values, declared payloads, public error-class translation, poison containment, and nonpoisoning trap behavior. It also verifies that a string payload fails generation instead of crossing through an untyped representation.

The current fixture uses an in-memory native-module stand-in so every envelope state can be forced deterministically. A real Lean and Wasm error fixture remains required before the scalar envelope can count as cross-compiled ABI evidence.
