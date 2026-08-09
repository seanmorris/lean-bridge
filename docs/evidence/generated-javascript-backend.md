# Generated JavaScript Backend Evidence

Status: the Alpha POC public surface is generated from Binding IR and exercised as an ordinary JavaScript module.

## Result

The JavaScript backend reads one validated Binding IR document and emits:

- direct named ESM exports;
- native JavaScript classes for identity-bearing resources;
- TypeScript declarations;
- copied-value validators;
- package documentation; and
- a manifest tied to the canonical Binding IR SHA-256 hash.

The generated package requires a private `internal/runtime.mjs` link adapter. The packager supplies that file when it binds generated code to the selected shared-runtime artifact. Consumers cannot import private symbols through the public package surface.

For the Alpha component, the generated TypeScript contract is equivalent to:

```ts
export interface Payload {
  readonly enabled: boolean;
  readonly count: number;
  readonly label: string;
  readonly bytes: Uint8Array;
  readonly values: ReadonlyArray<number>;
}

export declare class Box {
  constructor(value: number);
  read(): number;
  identity(): Box;
  dispose(): void;
}

export declare function roundTrip(payload: Payload): Payload;
```

A consumer uses direct imports and calls:

```js
import { Box, roundTrip } from "@lean-wasm/alpha";

const box = new Box(41);
console.log(box.read());

const result = roundTrip({
  enabled: true,
  count: 8,
  label: "typed",
  bytes: new Uint8Array([0, 127, 255]),
  values: [1, 5, 13],
});

box.dispose();
```

The public source does not expose `ccall`, `cwrap`, underscored symbols, pointers, numeric handles, or WebAssembly objects. `Uint8Array` remains a byte sequence, numeric ranges are checked, records retain named fields, and resource identity remains attached to the generated class.

## Semantic ownership

Binding IR owns public names, declaration kinds, type signatures, ownership, lifetimes, mutability, effects, failure policy, and assurance references. The private ABI map owns symbols, resource tags, disposal symbols, and ABI adapter limits. Its closed validator rejects public names and ownership policy.

The POC generator compiles each identity-bearing resource into a closed lifecycle plan. Alpha's plan records the constructor lease, call-scoped receiver borrows, receiver-anchored resource results, canonical wrapper projection, nominal handle kind, explicit disposal, queued finalization, cycle policy, and runtime-shutdown cleanup. The loader consumes that plan. It does not assume that every resource follows one handwritten class convention.

The copied-value validator walks the Binding IR record instead of duplicating the public field contract in the descriptor. The value-frame generator derives offsets and codecs from the same record.

## Executable checks

`tests/javascript-generator.test.mjs` writes the generated package to a fresh temporary directory and imports it. The fixture constructs and disposes a `Box`, checks canonical identity, calls `roundTrip`, preserves `Uint8Array`, and rejects malformed values before dispatch. It also inspects the generated JavaScript, TypeScript, manifest, and canonical hash.

`tests/javascript-projection.test.mjs` verifies that public names come from Binding IR. It rejects missing implementation mappings, private policy injection, unknown symbols, duplicate resource tags, unsupported adapters, unsupported result modes, and public name collisions.

`tests/resource-lifecycle-generator.test.mjs` verifies the exact ownership transitions produced for Alpha. It changes disposal and result ownership in valid Binding IR and confirms that the generated plan changes or the JavaScript backend rejects a contract it cannot preserve. Registry tests confirm that the generated fallback policy controls finalizer registration.

## Remaining generator boundary

The value-frame compiler derives copied-record offsets, buffer triples, widths, limits, and JavaScript lowering/lifting loops from Binding IR. It emits the matching C struct used by the shared module. The resource lifecycle and pending-operation compilers derive ownership and cleanup plans from the same IR. A real Wasm fixture exercises a generated Promise projection, runs Lean after the initiating Wasm frame returns, and covers cancellation and shutdown races. The C code that schedules the operation and constructs and projects Lean runtime objects remains handwritten. Iterators, callbacks, properties, overloads, generics, rich asynchronous result frames, and error translation still require backend conformance fixtures.
