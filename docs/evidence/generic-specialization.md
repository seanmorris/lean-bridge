# Generated Generic Specialization Evidence

Status: the JavaScript backend projects finite copied generic identity functions through canonical specialization metadata.

## Public contract

A generic declaration lists its compiled concrete types under the canonical `lean-wasm.org/specializations` extension. The private ABI maps those stable specialization IDs to symbols. Generated TypeScript advertises only the compiled signatures:

```ts
export declare function echo(value: number): number;
export declare function echo(value: string): string;
```

JavaScript uses one function:

```js
echo(41);
echo("lean");
```

The caller passes no type token, specialization ID, symbol, or wrapper object. Generated value checks select the concrete path. The loader consumes the same plan when it projects a package directly.

## Ambiguity policy

Version 1 supports one unconstrained copied type parameter used as the only argument and result of a synchronous function. Each concrete type must have a distinct JavaScript runtime category. A `UInt32` and `String` pair is valid. A `UInt32` and `Int32` pair fails generation because positive integers satisfy both types.

Generic constraints, resources, multiple type parameters, constructed types, generic overload groups, and asynchronous delivery remain gated until the backend can preserve their evidence and runtime representation. The generator does not emit an unrestricted `<T>` signature over a finite native implementation set.

## Executable checks

`tests/internal/abi/generic-specialization.test.mjs` verifies canonical plans, private symbol matching, disjoint runtime guards, native loader dispatch, generated JavaScript, concrete TypeScript signatures, direct package consumption, unsupported value rejection, missing metadata, constrained declarations, and private metadata drift.

The native test stand-in keeps each private implementation observable. A cross-compiled Lean generic fixture remains required for Wasm ABI evidence.
