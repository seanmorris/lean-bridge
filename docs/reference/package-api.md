# Generated package API

An application imports functions from the prepared package by its package name. Initialization happens during module loading; the generated pure functions are synchronous afterward. Start with [JavaScript and TypeScript](../javascript-typescript.md) for installation, browser assets, React, and workers.

This reference runs the package declaration generator against compiler-captured fixture APIs. CI compares those captures with fresh builds, and reference generation checks the source hashes. Each Lean package defines its own exports.

## The author tutorial package

The [tutorial source](../../tests/fixtures/documentation/lean-author/OnboardingSmall.lean) becomes this declaration file:

```ts
// Generated from Binding IR SHA-256 9a193d0bab543882de0a7046d52dcd744a3fa288b3df52fda44035766f8cf493.
/**
 * Add two natural numbers.
 */
export declare function add(arg0: bigint, arg1: bigint): bigint;

/**
 * Return whether a copied UTF-8 string is empty.
 */
export declare function isEmpty(arg0: string): boolean;

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
// Generated from Binding IR SHA-256 77664e0709528cd58af8650417ca25850cc159a038a45460f691082c59e59f92.
/**
 * Add arbitrary-precision natural numbers.
 */
export declare function add(arg0: bigint, arg1: bigint): bigint;

/**
 * A zero-argument function.
 */
export declare function answer(): bigint;

/**
 * Preserve a boolean.
 */
export declare function boolean(arg0: boolean): boolean;

/**
 * Copy a byte array.
 */
export declare function bytes(arg0: Uint8Array): Uint8Array;

/**
 * Preserve one Unicode scalar value.
 */
export declare function character(arg0: string): string;

/**
 * Preserve an IEEE single-precision value.
 */
export declare function f32(arg0: number): number;

/**
 * Preserve an IEEE double-precision value.
 */
export declare function f64(arg0: number): number;

/**
 * Preserve Int16.
 */
export declare function i16(arg0: number): number;

/**
 * Preserve Int32.
 */
export declare function i32(arg0: number): number;

/**
 * Preserve Int64.
 */
export declare function i64(arg0: bigint): bigint;

/**
 * Preserve Int8.
 */
export declare function i8(arg0: number): number;

/**
 * Preserve arbitrary-precision signed integers.
 */
export declare function integer(arg0: bigint): bigint;

/**
 * Preserve the compiled target's signed word.
 */
export declare function isize(arg0: number): number;

/**
 * Exercise mixed types and more than two arguments.
 */
export declare function mixed(arg0: boolean, arg1: number, arg2: string, arg3: bigint): bigint;

/**
 * Negate arbitrary-precision integers.
 */
export declare function negate(arg0: bigint): bigint;

/**
 * Preserve Unicode text, including embedded NUL.
 */
export declare function text(arg0: string): string;

/**
 * Preserve UInt16.
 */
export declare function u16(arg0: number): number;

/**
 * Preserve UInt32.
 */
export declare function u32(arg0: number): number;

/**
 * Preserve UInt64.
 */
export declare function u64(arg0: bigint): bigint;

/**
 * Preserve UInt8.
 */
export declare function u8(arg0: number): number;

/**
 * Preserve unit.
 */
export declare function unit(arg0: void): void;

/**
 * Preserve the compiled target's unsigned word.
 */
export declare function usize(arg0: number): number;

declare const bindings: Readonly<{
  readonly add: typeof add;
  readonly answer: typeof answer;
  readonly boolean: typeof boolean;
  readonly bytes: typeof bytes;
  readonly character: typeof character;
  readonly f32: typeof f32;
  readonly f64: typeof f64;
  readonly i16: typeof i16;
  readonly i32: typeof i32;
  readonly i64: typeof i64;
  readonly i8: typeof i8;
  readonly integer: typeof integer;
  readonly isize: typeof isize;
  readonly mixed: typeof mixed;
  readonly negate: typeof negate;
  readonly text: typeof text;
  readonly u16: typeof u16;
  readonly u32: typeof u32;
  readonly u64: typeof u64;
  readonly u8: typeof u8;
  readonly unit: typeof unit;
  readonly usize: typeof usize;
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
