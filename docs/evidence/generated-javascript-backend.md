# Generated JavaScript Backend Evidence

Status: the Alpha POC public surface is generated from Binding IR and exercised as an ordinary JavaScript module.

## Result

The JavaScript backend reads one validated Binding IR document and emits:

- direct named ESM exports;
- native JavaScript classes for identity-bearing resources;
- TypeScript declarations;
- copied-value validators;
- package documentation; and
- a manifest tied to the canonical Binding IR SHA-256 hash;
- a root-only package export map; and
- a machine-checked public-surface audit.

The generated package requires a private `internal/runtime.mjs` link adapter. The packager supplies that file when it binds generated code to the selected shared-runtime artifact. `package.json` exposes only the package root. Consumers cannot import the internal runtime or validators through a package subpath.

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
export type Transform = (value: number) => number;
export declare function withCallback(value: number, transform: Transform): number;
export interface LeanOwnedCallable {
  readonly disposed: boolean;
  dispose(): boolean;
}
export declare function makeAdder(base: number): Transform & LeanOwnedCallable;
```

A consumer uses direct imports and calls:

```js
import { Box, makeAdder, roundTrip, withCallback } from "@lean-wasm/alpha";

const box = new Box(41);
console.log(box.read());

const result = roundTrip({
  enabled: true,
  count: 8,
  label: "typed",
  bytes: new Uint8Array([0, 127, 255]),
  values: [1, 5, 13],
});

const answer = withCallback(40, value => value);
const addTwo = makeAdder(2);
console.log(addTwo(40));

box.dispose();
addTwo.dispose();
```

The public source does not expose `ccall`, `cwrap`, underscored symbols, pointers, numeric handles, or WebAssembly objects. `Uint8Array` remains a byte sequence, numeric ranges are checked, records retain named fields, and resource identity remains attached to the generated class.

## Semantic ownership

Binding IR owns public names, declaration kinds, type signatures, ownership, lifetimes, mutability, effects, failure policy, and assurance references. The private ABI map owns symbols, resource tags, disposal symbols, and ABI adapter limits. Its closed validator rejects public names and ownership policy.

The POC generator compiles each identity-bearing resource into a closed lifecycle plan. Alpha's plan records the constructor lease, call-scoped receiver borrows, receiver-anchored resource results, canonical wrapper projection, nominal handle kind, explicit disposal, queued finalization, cycle policy, and runtime-shutdown cleanup. The loader consumes that plan. It does not assume that every resource follows one handwritten class convention.

The copied-value validator walks the Binding IR record instead of duplicating the public field contract in the descriptor. The value-frame generator derives offsets and codecs from the same record.

## Executable checks

`tests/javascript-generator.test.mjs` writes the generated package to a fresh temporary directory and imports it. The fixture constructs and disposes a `Box`, checks canonical identity, calls `roundTrip`, `withCallback`, and `makeAdder`, preserves `Uint8Array`, and rejects malformed values before dispatch. It also inspects the generated JavaScript, callback type, owned-callable projection, TypeScript, manifest, package export map, and canonical hash. The package audit rejects added entry exports, raw ABI names, public `any`, and internal subpath exports.

`tests/javascript-coverage.test.mjs` treats backend support as data. The reviewed Alpha graph has no JavaScript coverage gaps. Iterator delivery, async iterators, properties, static methods, generics, optional parameters, overload groups, constructed values without validators, and unsupported error payloads each fail with a stable code before the generator emits a package. Adding target syntax without its runtime lowering cannot create a false support claim.

`tests/error-envelope.test.mjs` verifies the generated scalar result and error union, deterministic tags, declared payload validation, idiomatic error classes, and unexpected-failure containment. [The error-envelope evidence](error-envelope.md) records the implemented layout and the payload types that remain gated.

`tests/iterator-adapter.test.mjs` verifies the generated scalar pull frame, private iteration-state lifetime, native `next` and `return` behavior, and public `Iterable<T>` projection. [The iterator evidence](iterator-adapter.md) records the lazy call cycle and cleanup rules.

`tests/javascript-projection.test.mjs` verifies that public names come from Binding IR, callback parameters receive a stable generated signature plan, and returned Lean closures receive a private call and disposal plan. It rejects missing implementation mappings, private policy injection, unknown symbols, duplicate resource tags, unsupported adapters, unsupported result modes, and public name collisions.

`tests/resource-lifecycle-generator.test.mjs` verifies the exact ownership transitions produced for Alpha. It changes disposal and result ownership in valid Binding IR and confirms that the generated plan changes or the JavaScript backend rejects a contract it cannot preserve. Registry tests confirm that the generated fallback policy controls finalizer registration.

## Remaining generator boundary

The value-frame compiler derives copied-record offsets, buffer triples, widths, limits, and JavaScript lowering/lifting loops from Binding IR. It emits the matching C struct used by the shared module. The resource lifecycle, pending-operation, callback, scalar error-envelope, and scalar iterator compilers derive ownership, cleanup, re-entry, result, failure, and pull plans from the same IR. Real Wasm fixtures exercise Promise settlement after stack return, a JavaScript callback invoked by Lean, and a returned Lean closure called from that callback. The C code that schedules asynchronous work and implements the two fixed callback adapters remains handwritten. Async iterators, properties, overloads, generics, rich asynchronous result frames, additional callback signatures, buffered error payloads, and real Lean error-envelope and iterator fixtures still require backend conformance work. The coverage gate blocks each unsupported mode before package generation.
