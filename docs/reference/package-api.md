# Generated package API

An application imports functions from the prepared package by its package name. Initialization happens during module loading; the generated pure functions are synchronous afterward. Start with [JavaScript and TypeScript](../javascript-typescript.md) for installation, browser assets, React, and workers.

This reference runs the same analyzer and declaration generator used by the packager. These fixture packages demonstrate a generated API, not names that every Lean package exports.

## The author tutorial package

The [tutorial source](../../tests/fixtures/documentation/lean-author/OnboardingSmall.lean) becomes this declaration file:

```ts
// Generated from Binding IR SHA-256 f0235de1048a726a770bfa84976adb0431f855f9347d76dd9f5becd65632420f.
/**
 * Add two natural numbers.
 */
export declare function add(left: bigint, right: bigint): bigint;

/**
 * Return whether a copied UTF-8 string is empty.
 */
export declare function isEmpty(value: string): boolean;

declare const bindings: Readonly<{
  readonly add: typeof add;
  readonly isEmpty: typeof isEmpty;
}>;
export default bindings;
```

After receiving the tutorial's prepared release:

```js
import { add, isEmpty } from 'onboarding-small';

console.log(add(40n, 2n)); // 42n
console.log(isEmpty('')); // true
```

The package exports the functions, not its commutativity theorem. [Proofs and assurance](../lean/proofs-and-assurance.md) explains how the theorem is recorded and checked.

## Primitive call coverage

The [scalar fixture](../../tests/fixtures/onboarding/scalars/OnboardingScalars.lean) covers zero-argument functions, all supported primitive types, and a mixed four-argument function. Its generated declarations are:

```ts
// Generated from Binding IR SHA-256 05a3929a43bd6a8b26088efb6a27d7fe0a29097b9140d85d793802099a445e70.
/**
 * Add arbitrary-precision natural numbers.
 */
export declare function add(left: bigint, right: bigint): bigint;

/**
 * A zero-argument function.
 */
export declare function answer(): bigint;

/**
 * Preserve a boolean.
 */
export declare function boolean(value: boolean): boolean;

/**
 * Copy a byte array.
 */
export declare function bytes(value: Uint8Array): Uint8Array;

/**
 * Preserve an IEEE single-precision value.
 */
export declare function f32(value: number): number;

/**
 * Preserve an IEEE double-precision value.
 */
export declare function f64(value: number): number;

/**
 * Preserve Int16.
 */
export declare function i16(value: number): number;

/**
 * Preserve Int32.
 */
export declare function i32(value: number): number;

/**
 * Preserve Int64.
 */
export declare function i64(value: bigint): bigint;

/**
 * Preserve Int8.
 */
export declare function i8(value: number): number;

/**
 * Preserve arbitrary-precision signed integers.
 */
export declare function integer(value: bigint): bigint;

/**
 * Exercise mixed types and more than two arguments.
 */
export declare function mixed(enabled: boolean, count: number, label: string, value: bigint): bigint;

/**
 * Negate arbitrary-precision integers.
 */
export declare function negate(value: bigint): bigint;

/**
 * Preserve Unicode text, including embedded NUL.
 */
export declare function text(value: string): string;

/**
 * Preserve UInt16.
 */
export declare function u16(value: number): number;

/**
 * Preserve UInt32.
 */
export declare function u32(value: number): number;

/**
 * Preserve UInt64.
 */
export declare function u64(value: bigint): bigint;

/**
 * Preserve UInt8.
 */
export declare function u8(value: number): number;

/**
 * Preserve unit.
 */
export declare function unit(value: void): void;

declare const bindings: Readonly<{
  readonly add: typeof add;
  readonly answer: typeof answer;
  readonly boolean: typeof boolean;
  readonly bytes: typeof bytes;
  readonly f32: typeof f32;
  readonly f64: typeof f64;
  readonly i16: typeof i16;
  readonly i32: typeof i32;
  readonly i64: typeof i64;
  readonly i8: typeof i8;
  readonly integer: typeof integer;
  readonly mixed: typeof mixed;
  readonly negate: typeof negate;
  readonly text: typeof text;
  readonly u16: typeof u16;
  readonly u32: typeof u32;
  readonly u64: typeof u64;
  readonly u8: typeof u8;
  readonly unit: typeof unit;
}>;
export default bindings;
```

These are ordinary-project npm signatures. Reviewed resource and callback APIs use other package profiles. Use the declarations shipped with your specific release as its callable contract.

## Values, errors, and cleanup

Pass `bigint` for `Nat`, `Int`, `UInt64`, and `Int64`. The API does not coerce a JavaScript `number` into an integer of a different type. Fixed-width values are range checked. [Types and values](types.md) lists the exact projections and copy limits.

A module import can reject if an artifact cannot load, its integrity check fails, or the runtime cannot link it. A synchronous function can throw for an invalid argument or a failed compiled call. Separate those two error locations in application code.

These pure scalar calls return owned host values and release their temporary native allocations before returning. There is no public runtime handle to initialize or dispose. APIs that return resources or prepared demo solvers have explicit ownership rules; see [Ownership and cleanup](../concepts/ownership.md).

## Sources and verification

The [JavaScript generator](../../src/backends/javascript/generate.mjs) owns the declarations. The [component packager](../../src/release/component-npm-package.mjs) supplies the runtime dependency and artifacts. Documentation tests regenerate both declaration files; installed-package acceptance checks their compiled calls, including large integers. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [combine packages](../concepts/shared-runtime.md) or choose an [algorithm's separate local adapter](algorithms.md).
