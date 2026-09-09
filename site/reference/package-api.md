# Generated package API

An application imports functions from the prepared package by its package name. Initialization happens during module loading; the generated pure functions are synchronous afterward. Start with [JavaScript and TypeScript](../javascript-typescript.md) for installation, browser assets, React, and workers.

This reference runs the same analyzer and declaration generator used by the packager. These fixture packages demonstrate a generated API, not names that every Lean package exports.

## The author tutorial package

The [tutorial source](../../tests/fixtures/documentation/lean-author/OnboardingSmall.lean) becomes this declaration file:

{{PACKAGE_API}}

After receiving the tutorial's prepared release:

```js
import { add, isEmpty } from 'onboarding-small';

console.log(add(40n, 2n)); // 42n
console.log(isEmpty('')); // true
```

The package exports the functions, not its commutativity theorem. [Proofs and assurance](../lean/proofs-and-assurance.md) explains how the theorem is recorded and checked.

## Primitive call coverage

The [scalar fixture](../../tests/fixtures/onboarding/scalars/OnboardingScalars.lean) covers zero-argument functions, all supported primitive types, and a mixed four-argument function. Its generated declarations are:

{{SCALAR_API}}

These are ordinary-project npm signatures. Reviewed resource and callback APIs use other package profiles. Use the declarations shipped with your specific release as its callable contract.

## Values, errors, and cleanup

Pass `bigint` for `Nat`, `Int`, `UInt64`, and `Int64`. The API does not coerce a JavaScript `number` into an integer of a different type. Fixed-width values are range checked. [Types and values](types.md) lists the exact projections and copy limits.

A module import can reject if an artifact cannot load, its integrity check fails, or the runtime cannot link it. A synchronous function can throw for an invalid argument or a failed compiled call. Separate those two error locations in application code.

These pure scalar calls return owned host values and release their temporary native allocations before returning. There is no public runtime handle to initialize or dispose. APIs that return resources or prepared demo solvers have explicit ownership rules; see [Ownership and cleanup](../concepts/ownership.md).

## Sources and verification

The [JavaScript generator](../../src/backends/javascript/generate.mjs) owns the declarations. The [component packager](../../src/release/component-npm-package.mjs) supplies the runtime dependency and artifacts. Documentation tests regenerate both declaration files; installed-package acceptance checks their compiled calls, including large integers. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [combine packages](../concepts/shared-runtime.md) or choose an [algorithm's separate local adapter](algorithms.md).
