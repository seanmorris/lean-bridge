# Generated Overload Adapter Evidence

Status: the JavaScript backend projects arity-distinct Lean functions with one public name as one native callable.

## Dispatch contract

`compileOverloadV1` reads the function group from Binding IR and emits a closed arity table. The plan identifies every declaration by its semantic ID and overload key. It does not contain private symbols.

```ts
export declare function choose(): number;
export declare function choose(value: number): number;
```

```js
choose();
choose(41);
```

The JavaScript package exports `choose` once. Its generated body selects a declaration by argument count, validates that branch's arguments, calls the private runtime with the declaration ID, and validates the result. The loader applies the same plan when `libraries.load()` returns the native package object. An unsupported argument count produces a typed boundary error before any private function runs.

## Ambiguity policy

Version 1 accepts synchronous branches with distinct arities. It rejects two branches with the same arity because JavaScript runtime types can overlap. For example, the value `1` satisfies several integer types. Declaration order cannot decide which Lean function runs.

Promise, iterator, and async iterator overload groups remain gated until their generated branch delivery paths use the same dispatch plan. Optional and defaulted parameters remain gated because they make arity dispatch ambiguous.

## Executable checks

`tests/overload-adapter.test.mjs` verifies deterministic plans, declaration-order independence, one native loader callable, generated JavaScript dispatch, two TypeScript signatures, one default export member, argument validation, invalid arity rejection, and direct package consumption. It also verifies that same-arity and asynchronous groups fail coverage before projection.
