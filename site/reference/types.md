# Types and values

Use this reference to choose Lean exports and pass values to prepared packages. The language tables record each profile's current mappings and execution evidence. The npm scalar sections below document the ordinary pure-function path.

## Full type surface

{{TYPE_SURFACE}}

## Generated host types

This npm table is generated from the scalar capability list and the actual TypeScript declarations for the scalar fixture.

{{SCALAR_TYPES}}

The names in the first column are Binding IR primitives. In Lean, `nat` is `Nat`, `int` is `Int`, `bytes` is `ByteArray`, `float64` is `Float`, and the fixed-width names use Lean's capitalization, such as `UInt32`. `unit` projects to a TypeScript `void` result and the JavaScript value `undefined`.

## Exact integers

`Nat` accepts nonnegative `bigint`; `Int` accepts either sign. Integers travel without narrowing to a JavaScript number or a 64-bit word. The transport limits each copied payload to {{COPY_LIMIT}} MiB; arbitrary precision does not mean unbounded memory.

Use `number` for fixed-width integers up to 32 bits, and `bigint` for 64-bit integers. Values must be integral and within the Lean type's signed or unsigned range. The generated public argument validators throw `TypeError` for both a wrong host type and an out-of-range fixed-width value. Transport copy-limit failures can throw `RangeError`.

Construct large values as `bigint` before calling the package. `BigInt(9007199254740993)` cannot repair rounding that already occurred in the JavaScript number; write `9007199254740993n` or `BigInt('9007199254740993')`.

## Floating point, text, and bytes

`Float32` rounds to single precision. `Float` uses double precision. Both accept NaN, infinities, and negative zero. A theorem about natural-number arithmetic says nothing about floating-point rounding.

Strings accept Unicode scalar values and embedded NUL characters. Unpaired UTF-16 surrogates are rejected rather than silently replaced. String lengths and match offsets depend on the particular API: Aho–Corasick's local adapter works with bytes, not JavaScript character positions.

`ByteArray` accepts a `Uint8Array`. The call copies the input and returns an owned `Uint8Array`; the result is not a view into the Lean heap. Text, bytes, and integer payloads share the per-value {{COPY_LIMIT}} MiB copy limit. Total memory also includes runtime storage, all arguments, results, and temporary allocations.

## Collections and resource profiles

Ordinary components accept any number of primitive arguments and one primitive result. They reject collection, record, callback, resource, `IO`, and `Task` signatures before compilation. Do not infer support from a source-only analysis report.

Reviewed package profiles can expose richer APIs. Read that release's generated declarations and the [runtime support reference](../consumers.md); the scalar table does not describe every consumer profile.

## Verify and continue

The [scalar contract](../../src/abi/component-scalars.mjs) owns validation and the copy limit. The [transport implementation](../../src/release/component-runtime.mjs) copies inputs and results. The [scalar fixture](../../tests/fixtures/onboarding/scalars/OnboardingScalars.lean) and installed-package tests exercise the supported calls. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [choose your exports](../lean/export-decisions.md), inspect the [generated package API](package-api.md), or read [ownership rules](../concepts/ownership.md).
