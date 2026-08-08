# Typed copied-value frame evidence

Status: measured architecture POC evidence.

The Alpha library exports a native JavaScript function named `roundTrip`. It accepts one record with these fields:

| Field | Lean type | JavaScript type |
|---|---|---|
| `enabled` | `Bool` | `boolean` |
| `count` | `UInt32` | range-checked `number` |
| `label` | `String` | `string` encoded as UTF-8 |
| `bytes` | `ByteArray` | `Uint8Array` |
| `values` | `Array UInt32` | array or `Uint32Array` input, frozen array output |

Lean toggles `enabled` and increments `count`. It preserves the string, byte array, and integer array. Tests include a NUL inside a Unicode string, bytes `0`, `128`, and `255`, and integer values through `UInt32.max`.

The call does not use JSON. The JavaScript projection validates the input, allocates a temporary Wasm arena, writes a 60-byte versioned frame and the copied field buffers, calls one private ABI symbol, reads the typed output, copies the result into native JavaScript values, and frees the arena in a `finally` block.

## Frame contract

Frame version 1 contains only little-endian `uint32` words:

- ABI version and frame byte size;
- status and detail codes;
- boolean and `UInt32` scalar fields;
- pointer, length, and capacity triples for the UTF-8 string and byte array; and
- pointer, element count, and capacity for the `UInt32` array.

The POC limits a copied string or byte array to 1 MiB and an array to 65,536 elements. The JavaScript projection enforces the limits before allocation. The bridge kernel enforces them again before reading Wasm memory.

| Status | Meaning |
|---:|---|
| 0 | success |
| 1 | ABI version mismatch |
| 2 | frame size mismatch |
| 3 | runtime not ready |
| 4 | invalid boolean representation |
| 5 | copy limit exceeded |
| 6 | pointer range outside current memory |
| 7 | output capacity exceeded |
| 8 | invalid internal result |

Public failures use `LeanBridgeError`. The error records a stable code, package identity, operation name, and structured details. A consumer does not receive a Wasm trap, pointer, status integer, or mangled symbol.

## Runtime placement

The shared main module owns the frame codec and every direct call to the Lean allocation API. Alpha remains a runtime-free side module. It exports only its generated Lean declarations and one registration shim. Browser and threaded link-map tests reject Lean runtime helpers inside the side module.

The registration shim gives the main bridge kernel typed function pointers for the Lean constructor, transformation, and field projections. Startup loading, lazy loading, and final-static composition use the same functions and public JavaScript contract.

## Ownership and cleanup

The bridge constructs owned Lean strings, byte arrays, arrays, and the `Payload` record. Lean consumes those values through its generated calling convention. The main bridge retains the transformed record around individual field projections, releases the record, copies the three owned result fields, then releases each field.

JavaScript frees every Wasm allocation in reverse order after success or failure. A test runs 1,000 complete calls and checks that the active-frame counter and retained-handle counter both return to zero.

## Architecture lens result

1. Shared runtime: the bridge kernel owns allocation and reference counting. Side modules contain no private runtime helpers.
2. Native API: `roundTrip(value)` is public. The frame call and allocator exports remain private.
3. Assurance identity: the graph lock pins the Lean source, shim, capsule, target artifacts, Lean revision, and patch set. The transformation has no attached theorem yet, so its behavioral state is unverified.
4. Reproducibility: browser and threaded artifact hashes are recorded in the capsule and checked during every build.
5. Host neutrality: the frame defines widths, copied bytes, cases, and ownership without JavaScript objects in the ABI. A later backend can consume the same schema.
6. Verified reuse: the descriptor preserves the field types and copy limits needed by a future component index.
7. Adoption: consumers use a native record and receive named errors. They do not allocate memory or manage Lean values.
8. Composition: lazy dynamic, startup dynamic, final-static, browser, and threaded tests exercise the same Alpha contract.

## Test evidence

`npm test` passes 38 behavioral and structural tests. WP4 adds coverage for:

- the native copied record through lazy, threaded, and final-static profiles;
- Unicode, embedded NUL, full-range bytes, and `UInt32.max`;
- ABI version, byte-size, boolean, and copy-limit rejection;
- structured public validation failures;
- 1,000-call arena cleanup; and
- side-module link maps that contain only the declared Alpha library domain.
