# Generated Property Adapter Evidence

Status: the JavaScript backend projects Lean resource properties as native getters and setters.

## Public surface

Binding IR uses two declarations with one public name to describe a readable and writable property. A getter takes no arguments and returns the property value. A setter takes one value, mutates the receiver, and returns `Unit`. The generated package exposes ordinary JavaScript and TypeScript syntax:

```ts
export declare class Box {
  value: number;
}
```

```js
const box = new Box(7);
console.log(box.value);
box.value = 42;
```

The package does not add `getValue()`, `setValue()`, handles, symbols, or ownership flags. Getter-only declarations produce a `readonly` TypeScript property.

## Generated boundary

`compileResourceLifecycleV1` compiles both accessors into the resource lifecycle. The JavaScript projector resolves their private symbols and installs one property descriptor on the generated prototype. Each access still enforces the receiver borrow, lifetime, disposal state, argument type, and result type recorded in Binding IR.

The coverage gate rejects ambiguous shapes before projection. It also rejects duplicate getters, duplicate setters, mismatched getter and setter types, property and method name collisions, asynchronous property access, and generic properties without a specialization plan.

## Executable checks

`tests/property-adapter.test.mjs` creates a writable `UInt32` property from canonical Binding IR. It verifies lifecycle generation, native access through the loader, range validation before the private setter runs, generated getter and setter syntax, the TypeScript property, and direct import of the generated package.

The native test stand-in keeps the private ABI deterministic so the tests can force valid and invalid values. A cross-compiled Lean property fixture remains required for Wasm ABI evidence.
