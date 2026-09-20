# JavaScript and TypeScript

Install a prepared npm package and import its public functions. The examples use `onboarding-small@1.0.0`, which exports `add` and `isEmpty`, in Node.js, a browser, React, and module workers. Application consumers need no Lean, Lake, or C compiler.

## Use a prepared release

Use Node 22.22 or newer for all commands below, including the Vite 8.2.1 examples. The TypeScript examples use 5.9.3. Browser visitors need neither Node nor Lean.

Choose a setup: [JavaScript on Node](#javascript), [TypeScript on Node](#typescript), [plain browser JavaScript](#use-the-package-in-a-browser), or [React](#react). The React example also includes [browser workers](#browser-workers).

## Install from a registry

If the publisher has released the component and its runtime dependency to your configured registry, install only the component. Run this from your application directory, replacing the example coordinate with the publisher's package name and exact version:

```sh
npm install --save-exact --ignore-scripts --no-audit --no-fund \
  @your-org/your-component@1.0.0
```

npm resolves the declared runtime dependency. Keep the application's lockfile. Use the installed package's name and exports in your imports; the programs below use `onboarding-small`. No public registry publication of that example package is assumed.

For a release supplied as local archives, use the next two steps instead. Both archives go through one installation command; loading the runtime remains automatic.

## Install a local archive release

Use this option when the publisher supplies package files instead of a registry coordinate.

#### Verify the handoff

For a local archive release, [Use a prepared release](consume/receive-package.md#verify-the-local-npm-receipt) explains how to verify the supplied receipt and select its two archives. Keep `LEAN_BRIDGE_RUNTIME_ARCHIVE` and `LEAN_BRIDGE_COMPONENT_ARCHIVE` set to their absolute paths.

The component archive supplies its generated module, TypeScript declarations, metadata, and binary. The runtime archive satisfies its exact `@lean-bridge/runtime` dependency.

#### Install the exact archives

For the local archive option, each setup below creates its own application directory and `package.json`. After creating those files, run this command from that directory:

```sh
npm install --ignore-scripts --no-audit --no-fund \
  "$LEAN_BRIDGE_RUNTIME_ARCHIVE" "$LEAN_BRIDGE_COMPONENT_ARCHIVE"
```

Installing both archives together satisfies the component's runtime dependency. `--ignore-scripts` disables installation lifecycle scripts. In the browser and React setups, npm also installs the development dependencies declared by that setup's `package.json`.

## JavaScript

Create a Node.js application:

```sh
mkdir lean-javascript-example
cd lean-javascript-example
npm init --yes
npm pkg set type=module
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then save `index.mjs`:

```js file=javascript/index.mjs
/**
 * Call the installed Lean component from Node JavaScript.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

const result = { sum: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("Lean") };
if(result.sum !== "123" || !result.empty || result.nonempty)
{
	throw new Error("Unexpected Lean result");
}
console.log(JSON.stringify(result));
```

```sh
node index.mjs
```

Expected output:

```text
{"sum":"123","empty":true,"nonempty":false}
```

The import initializes the runtime and loads the component before the module body executes. Calls are synchronous after loading. `add` returns a `bigint`; `isEmpty` returns a `boolean`. Convert a `bigint` to a decimal string before JSON serialization.

Both functions return copied primitives, so no disposal step is required. Imports in one JavaScript realm share the runtime module.

## TypeScript

Create a separate Node.js application and install the compiler:

```sh
mkdir lean-typescript-example
cd lean-typescript-example
npm init --yes
npm pkg set type=module
npm install --save-dev --ignore-scripts --no-audit --no-fund typescript@5.9.3
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then create `index.ts`:

```ts file=typescript/index.ts
/**
 * Call the installed Lean component with strict generated types.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

const sum: bigint = add(20n, 22n);
const empty: boolean = isEmpty("");
if(sum !== 42n || !empty) throw new Error("Unexpected Lean result");
console.log(JSON.stringify({ sum: sum.toString(), empty }));
```

Create `tsconfig.json`. The optional `input.ts` and `typecheck.ts` files appear below:

```json file=typescript/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": false,
    "outDir": "dist"
  },
  "include": ["index.ts", "input.ts", "typecheck.ts"]
}
```

```sh
npx tsc --project tsconfig.json
node dist/index.js
```

The program prints `{"sum":"42","empty":true}`. TypeScript resolves declarations from the installed package.

#### Check rejected types

Optionally save `typecheck.ts`:

```ts file=typescript/typecheck.ts
/**
 * Compile intentionally invalid calls to check the generated declarations.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

// Compiled but never executed: these errors check the generated declarations.
// @ts-expect-error Nat inputs use bigint.
add(20, 22);
// @ts-expect-error String inputs do not accept numbers.
isEmpty(0);
// @ts-expect-error Nat outputs are not JavaScript numbers.
const wrongResult: number = add(20n, 22n);
void wrongResult;
```

Run `npx tsc --project tsconfig.json` again, but do not execute `dist/typecheck.js`. If the generated declarations start accepting one of these invalid calls, TypeScript reports an unused `@ts-expect-error` directive.

## Values and cleanup

Packages can accept synchronous JavaScript functions and return callable Lean functions. TypeScript declarations describe their arguments and results using the same primitive mappings as ordinary calls. Callbacks must return a value immediately; returning a Promise is an error.

A callback is borrowed for its enclosing call. Lean cannot invoke it after that call ends. A returned Lean function owns a runtime lease: call `dispose()` when finished, or use TypeScript's `using` syntax. `disposed` reports its state; aliases share the same lease, and repeated disposal is harmless. The runtime also supplies `Symbol.dispose` and queued finalizer cleanup.

For example, a package exporting `makeAdder : UInt32 → (UInt32 → UInt32)` can be used from a file:

```js
import { makeAdder } from "your-package";

const addSeven = makeAdder(7);
try {
  console.log(addSeven(35)); // 42
} finally {
  addSeven.dispose();
}
```

The runtime preserves callback exceptions after Lean releases its call frame. Calls allow up to 64 nested frames, 1,024 live borrowed callbacks, 1,024 owned Lean functions, and 16 MiB of copied payloads per call. A Wasm trap prevents further calls in that runtime. Each worker has its own runtime; functions and leases cannot be transferred with `postMessage`.

For a Lean `Char` parameter, pass a string containing one Unicode scalar, such as `"a"`, `"🌱"`, or `"\0"`. A `Char` result uses the same representation. Empty strings, unpaired UTF-16 surrogates, and strings containing multiple scalars throw `TypeError`. TypeScript declares these values as `string`; the generated API checks the scalar constraint at runtime. See [characters and text](reference/types.md#floating-point-text-and-bytes).

### Type conversions

Profiles: Node JavaScript, TypeScript, Browser, React, Worker. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `undefined` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The JavaScript value is undefined. Generated TypeScript uses void in every position. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `boolean` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `bigint` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `bigint` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `bigint` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact nonnegative bigint, including 16,385-bit samples; conversion budgets apply. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `bigint` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact signed bigint, including 16,385-bit samples; conversion budgets apply. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | IEEE binary32 projected as number; preserves NaN classification, infinities and signed zero. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | IEEE binary64 projected as number; preserves NaN classification, infinities and signed zero. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Copied UTF-8 text, including BOM, NUL and supplementary characters. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Uint8Array` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Copied Uint8Array; no view into Lean memory. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `ReadonlyArray<T> (supported copied elements)` (input, result, field); `readonly T[]; UInt32 arrays use readonly number[]` (callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Generator inspected (callback input, callback result) | Dense data arrays, recursively; holes, accessors, extra properties and cycles reject. Record elements and nested byte buffers are independent copies. No Wasm views or disposal. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `{ readonly tag: "none" } \| { readonly tag: "some"; readonly value: T }` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exact own tags preserve none, some Unit and every nested option. Null and omitted payloads reject. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `{ readonly ok: T } \| { readonly error: E }` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exactly one own data property selects ok or error, including Unit payloads. IR arguments are [success, error]; a domain error returns a value. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `readonly [A, B] (nested binary products)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exact dense ordinary arrays preserve two-element arity and source product nesting. Typed arrays, holes and flattened products reject. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Named readonly interface; copied plain object` (input, result, field); `Generated readonly record (Alpha: Payload)` (callback input, callback result) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Generator inspected (callback input, callback result) | Encoding copies exactly the declared own data fields. Results own independent records, arrays and byte buffers. No disposal or Wasm memory access. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Resolved target type` (input, result, field, callback input, callback result) | Ordinary source: Compilation rejected. Reviewed IR: Generator inspected | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `Generated tagged readonly union` (input, result, field, callback input, callback result) | Ordinary source: Compilation rejected. Reviewed IR: Generator inspected | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | No host mapping recorded | Ordinary source: Compilation rejected. Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Synchronous JavaScript function` (input) | Ordinary source: Installed checks passed (input); Compilation rejected (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Borrowed until the outer call returns. A Promise result is rejected; the first thrown value is preserved. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `ReadonlyArray<T> (ordinary dense Array)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Preserve order, duplicates and every nesting level. Lists and Arrays remain distinct in the IR. Returned arrays and mutable payloads are independent copies. Dense own data elements only; holes, accessors, extra fields, typed arrays and cycles reject. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, not one UTF-16 code unit or one grapheme cluster. NUL and supplementary characters are preserved; empty strings, multiple scalars, unpaired surrogates and non-strings are rejected without coercion or normalization. TypeScript uses string with runtime validation. Exactly one Unicode scalar in a string; surrogates and multiple scalars reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 32-bit compiled Lean target, 0..4294967295. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Unsigned number in the range of the 32-bit compiled Lean target. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 32-bit compiled Lean target, -2147483648..2147483647. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Signed number in the range of the 32-bit compiled Lean target. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Named finite specializations` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | `Optional argument with declared default` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Compilation rejected. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Compilation rejected. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | `Promise<T>` (signature) | Ordinary source: Compilation rejected. Reviewed IR: Generator inspected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `Callable function with dispose(), disposed and Symbol.dispose` (result) | Ordinary source: Compilation rejected (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Explicitly leased Lean function. Aliases share disposal; active invocations retain their pin until return. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | `Iterator<T>` (signature) | Ordinary source: Compilation rejected. Reviewed IR: Generator inspected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | `AsyncIterator<T>` (signature) | Ordinary source: Compilation rejected. Reviewed IR: Generator inspected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Scalar package example

These mappings apply to the ordinary pure-function npm packages in Node.js, browsers, React, and workers. JavaScript and TypeScript use the same runtime values. `onboarding-small` uses `Nat`, `String`, and `Bool`; the [scalar reference](reference/types.md) covers the other supported exports.

| Lean type | JavaScript / TypeScript | Conversion rules |
| --- | --- | --- |
| `Unit` | `undefined` / `void` result | Pass `undefined` for a unit argument; no result value needs cleanup. |
| `Bool` | `boolean` | Pass `true` or `false`, not `0` or `1`. |
| `UInt8` | `number` | Integer from `0` through `255`. |
| `UInt16` | `number` | Integer from `0` through `65535`. |
| `UInt32` | `number` | Integer from `0` through `4294967295`. |
| `UInt64` | `bigint` | Integer from `0n` through `2n ** 64n - 1n`. |
| `Int8` | `number` | Integer from `-128` through `127`. |
| `Int16` | `number` | Integer from `-32768` through `32767`. |
| `Int32` | `number` | Integer from `-2147483648` through `2147483647`. |
| `Int64` | `bigint` | Integer from `-(2n ** 63n)` through `2n ** 63n - 1n`. |
| `USize` | `number` | Integer from `0` through `4294967295`. The compiled Lean target is wasm32, including on 64-bit Node and browser hosts. |
| `ISize` | `number` | Integer from `-2147483648` through `2147483647`. Inputs outside the compiled wasm32 range are rejected before narrowing. |
| `Nat` | `bigint` | Nonnegative arbitrary-precision integer. Use `42n`, not `42`. |
| `Int` | `bigint` | Arbitrary-precision integer of either sign. |
| `Float32` | `number` | Rounds to IEEE single precision; NaN, infinities, and negative zero are accepted. |
| `Float` | `number` | IEEE double precision; NaN, infinities, and negative zero are accepted. |
| `String` | `string` | Copied as UTF-8. Embedded NUL is allowed; unpaired UTF-16 surrogates are rejected. |
| `Char` | `string` | Exactly one Unicode scalar. Supplementary characters and NUL are allowed; empty strings, multiple scalars and unpaired surrogates are rejected. |
| `ByteArray` | `Uint8Array` | Inputs and results are copied, not views into the Lean heap. |

The bindings validate integer types and ranges before calling Lean. Text, bytes, and arbitrary-precision integer payloads have a 16 MiB per-value copy limit. Use decimal strings when serializing `bigint` values to JSON; converting to `number` can lose precision.

The ordinary component build path accepts primitives, nested arrays and Lists, acyclic copied records, `Option`, `Except`, nested products, and synchronous functions with primitive arguments and results. Resources, `IO`, and `Task` remain unsupported. Copied containers and callables cannot yet share one component. Richer prepared profiles, including Alpha, have their own generated APIs. The [runtime reference](consumers.md) identifies those packages; a mapping in another profile does not add exports to this one.

### Nested arrays

An exported Lean function taking `Array (Array Nat)` accepts a JavaScript array
of arrays of `bigint`. Generated TypeScript uses
`ReadonlyArray<ReadonlyArray<bigint>>`. The same mapping applies recursively to
all nineteen primitive types, including `Uint8Array` for each `ByteArray` value.
Pass ordinary dense arrays for `Array`; typed arrays are only used for `ByteArray`.

Arrays and byte buffers are copied in both directions. Returned values share no
storage with inputs or the Lean heap and need no disposal. Holes, extra fields,
getters, cycles and incorrectly typed elements are rejected. Limits are 32 container
levels and a cumulative 16 MiB of slot storage and copied payloads across all
arguments and the result. A result that exceeds the limit throws `RangeError`;
the runtime releases partial output and remains usable.

The installed-package checks cover ordinary Lean source and independently
reviewed IR in Node, strict TypeScript, browser pages, React and workers. See the
[array execution evidence](evidence/npm-arrays-20260920.md). Arrays can also contain
[copied records](#copied-records), options, results and products. Callables and
resources are not admitted as array elements.

### Lists

Lean `List α` uses an ordinary JavaScript array and TypeScript `ReadonlyArray<T>`.
Pass `[]` for the empty list. For `List Nat`, pass values such as `[0n, 42n]`.
The adapter preserves order, duplicates and every nesting level. Lists can contain
all nineteen primitives, arrays, acyclic copied records, options, results and products.
These values can also contain Lists.

Both `List α` and `Array α` use host arrays, but remain distinct in the package's
Binding IR. A reviewed contract must match the Lean declaration's constructor.
Consumers do not construct cons cells or handle Lean pointers. Returned arrays and
their copied contents own independent storage and need no disposal.

Lists share the copied-container rules above: dense own data elements, no typed
arrays, getters, extra properties or cycles, at most 32 nesting levels, and a
16 MiB copy budget across the call. Oversized results throw instead of returning
a truncated list. A valid call can follow a budget rejection.

[Installed List checks](evidence/npm-lists-20260920.md) cover both source paths in
Node, strict TypeScript, Chromium, Firefox and WebKit, including React and workers.
C and C++ also have [installed List adapters](evidence/native-lists-20260920.md),
as do [Python](evidence/python-lists-20260920.md) and
[Rust](evidence/rust-lists-20260920.md). Other native hosts and
PHP-Wasm remain pending. Lists cannot contain callbacks
or resources, or share a component with callable exports yet.

### Copied records

Lean structures become named TypeScript interfaces with readonly fields and plain
JavaScript objects. Fields may contain any supported primitive, nested arrays and Lists,
options, results, products or other acyclic copied records. Empty and single-field
structures work too.

Pass every declared field as an own data property. Missing or extra fields,
getters, symbols, custom prototypes and cycles are rejected; plain objects with
a null prototype are accepted. Returned records, arrays and byte buffers own
independent copies and need no disposal.

The transport shares a 16 MiB budget across copied slots and payloads in all
arguments and the result, with at most 32 container levels. A result-budget
failure clears partial output and leaves the runtime usable. Lean-generated
constructors and field accessors handle the compiler's record representation.

Both source paths have [installed record checks](evidence/npm-records-20260920.md)
in Node, strict TypeScript and three browser engines, including React and workers.
Generic, inherited, dependent and recursive records are not supported by this
profile. Records cannot contain callbacks or resources, or share a component
with callable exports yet.

### Options, results and products

`Option α` uses `{ tag: "none" }` or `{ tag: "some", value: T }`.
`some ()` retains its `value: undefined` property. Nested options keep every tag:
`none`, `some none` and `some (some ())` are three distinct values.

`Except ε α` uses `{ ok: T }` for success or `{ error: E }` for failure.
Pass exactly one branch as an own data property, even when its payload is Unit.
An error branch is a returned value, not a JavaScript exception. The generated
TypeScript declarations narrow on `tag` or on `"ok" in result`.

`α × β` uses a two-element ordinary array and a readonly TypeScript tuple.
Products keep their Lean nesting: `(UInt32 × String) × Bool` becomes
`readonly [readonly [number, string], boolean]`, not a flat three-element array.

These values can nest with arrays, Lists and acyclic records. They are copied, need no
disposal, and share the 32-container-depth and cumulative 16 MiB copy limits.
Missing or extra properties, accessors, sparse tuples and invalid tags fail
before Lean runs. Plain and null-prototype objects are accepted for tagged values.
See the [installed compound checks](evidence/npm-compounds-20260920.md) for both
source paths in Node, strict TypeScript and Chromium, Firefox and WebKit pages,
React and workers. Native and PHP-Wasm profiles also support these constructors;
their consumer guides describe the host representations.

### Validate numeric inputs

The installed Wasm runtime preserves arbitrary-precision `Nat` values as nonnegative `bigint`. The acceptance checks include values beyond `2^64` and 4,096-bit integers.

For user-entered text, save this validator as `input.ts` in the TypeScript application:

```ts file=typescript/input.ts
/**
 * Validate user input before calling the installed Lean component.
 *
 * @file
 */
import { add } from "onboarding-small";

/** Parse nonnegative decimal inputs without narrowing Lean natural numbers. */
export function addInput(leftText: string, rightText: string): bigint
{
	if(!/^\d+$/.test(leftText) || !/^\d+$/.test(rightText))
	{
		throw new RangeError("Enter nonnegative whole numbers.");
	}
	const left = BigInt(leftText);
	const right = BigInt(rightText);
	return add(left, right);
}
```

Invalid text throws `RangeError` before invoking Lean. The sum has no fixed-width integer bound; the runtime's copy limit still applies. The React and worker example applies the same text checks in its shared `lean.ts` helper. Use `sum.toString()` for display or JSON.

## Use the package in a browser

Create a separate application directory:

```sh
mkdir lean-browser-example
cd lean-browser-example
```

Save `package.json`:

```json file=browser/package.json
{
  "name": "lean-browser-guide",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1"
  },
  "devDependencies": { "vite": "8.2.1" }
}
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then add these files.

`index.html`:

```html file=browser/index.html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lean browser example</title></head>
  <body>
    <h1>Call a Lean package</h1>
    <output id="result" role="status">Loading Lean component...</output>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

`main.js`:

```js file=browser/main.js
/**
 * Display a result from the installed Lean component.
 *
 * @file
 */
const output = document.querySelector("#result");
try
{
	const { add, isEmpty } = await import("onboarding-small");
	const sum = add(20n, 22n);
	const empty = isEmpty("");
	if(sum !== 42n || !empty) throw new Error("Unexpected Lean result");
	output.textContent = `Sum: ${sum}. Empty string: ${empty}.`;
	output.dataset.status = "ready";
} catch(error)
{
	output.textContent = `Could not load Lean: ${String(error)}`;
	output.dataset.status = "error";
}
```

The dynamic import lets the page display loading and failure states. Package initialization is asynchronous; exported calls are synchronous after it resolves.

`vite.config.js`:

```js file=browser/vite.config.js
/**
 * Keep the compiled runtime and component assets under the deployment prefix.
 *
 * @file
 */
import { defineConfig } from "vite";

export default defineConfig({
	base: "/consumer-example/"
	, build: { target: "esnext", assetsInlineLimit: 0 }
});
```

```sh
npm run dev
```

Open the printed local URL at `/consumer-example/`. The page displays `Sum: 42. Empty string: true.`

#### Build and serve browser assets

For either the plain browser application or the React application below:

```sh
npm run build
npm run preview
```

Deploy the whole `dist` directory, including its generated binary assets. Set Vite's `base` to the deployed prefix, including a GitHub project Pages prefix when applicable. The server should return `.wasm` files as `application/wasm`. Load the page through HTTP, not a `file:` URL.

## React

The checked-in React application includes editable inputs, mount/unmount controls, loading and error states, and a module-worker example. It pins React, Vite, and TypeScript.

Set the checkout path, then copy the complete fixture into a new application directory:

```sh
export LEAN_BRIDGE_CHECKOUT=/absolute/path/to/lean-bridge
mkdir lean-react-example
cp -R "$LEAN_BRIDGE_CHECKOUT/tests/fixtures/component-consumer/." lean-react-example/
cd lean-react-example
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then `npm run dev`. Open the printed URL at `/consumer-example/`. The initial result is `Sum: 42. Empty string: true.` Change the numbers or text and click Calculate. Unmount removes the result component; Mount restores it using the same loaded package.

The copied application imports the installed public package. It needs no compiler, repository runtime module, private symbol, or hand-written binary loader.

#### Load from an effect

A dynamic import allows the component to display loading and failure states. This effect skips the state update if its owner has already unmounted:

```tsx
import { useEffect, useState } from "react";

export function LeanSum() {
  const [message, setMessage] = useState("Loading Lean component...");

  useEffect(() => {
    let active = true;
    import("onboarding-small").then(api => {
      if (!active) return;
      setMessage(`Sum: ${api.add(20n, 22n)}`);
    }).catch(error => {
      if (active) setMessage(`Could not load Lean: ${String(error)}`);
    });
    return () => { active = false; };
  }, []);

  return <p role="status">{message}</p>;
}
```

React development StrictMode runs an extra effect setup and cleanup. ESM shares the import across those effects; the retired effect skips its update. The cleanup flag does not cancel initialization or a synchronous Lean call. The runtime remains available to other consumers in the page.

For editable inputs, validate the [numeric range](#validate-numeric-inputs) and include submitted input in the effect's dependency list. Keep browser-only computation in the effect instead of importing it from a server-rendered module.

#### Configure the React build

The copied fixture includes this Vite configuration, which retains both binaries and emits module workers:

```ts
/**
 * Keep the runtime and component as explicit browser assets, including workers.
 *
 * @file
 */

import { defineConfig } from "vite";

export default defineConfig({
	base: "/consumer-example/"
	, build: { target: "esnext", assetsInlineLimit: 0 }
	, worker: { format: "es" }
});
```

Use the shared [build and deployment steps](#build-and-serve-browser-assets). This fixture's build also type-checks the main-thread and worker programs separately.

## Browser workers

The React application's Start worker button sends its current inputs to `lean-worker.ts`. A module worker runs calls on its own JavaScript thread and loads its own runtime. It shares neither component objects nor runtime memory with the page.

The addition example demonstrates loading and ownership. Worker startup costs more than this single addition; use a worker when computation would delay page interaction.

#### Send inputs and return results

The worker source uses the fixture's local `lean.ts` helper to load the installed public API and validate inputs:

```ts
/**
 * Execute the same installed component in a separate JavaScript realm.
 *
 * @file
 */

import { calculate, loadLean } from "./lean";
import type { Inputs } from "./lean";

self.addEventListener("message", async (event: MessageEvent<Inputs>) => {
	try
	{
		const api = await loadLean();
		self.postMessage({ ok: true, result: calculate(api, event.data) });
	}
	catch(error)
	{ self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
});
```

[`lean.ts`](../tests/fixtures/component-consumer/lean.ts) imports `onboarding-small` and returns `{ sum: string, empty: boolean }`. The page sends `{ left: "20", right: "22", text: "" }`. Decimal strings also work with JSON; browser `postMessage` itself can copy `bigint` through structured cloning.

Create the worker through a source-relative URL so Vite discovers and bundles it:

```ts
const worker = new Worker(new URL("./lean-worker.ts", import.meta.url), {
  type: "module",
});

worker.onmessage = event => {
  if (event.data.ok) console.log(event.data.result);
  else console.error(event.data.error);
};
worker.onerror = event => console.error(event.message);
worker.postMessage({ left: "20", right: "22", text: "" });
```

#### Terminate the worker with its owner

In React, create the worker inside an effect and terminate it during cleanup:

```tsx
useEffect(() => {
  const worker = new Worker(new URL("./lean-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = event => setResult(event.data);
  worker.onerror = event => setResult({ ok: false, error: event.message });
  worker.postMessage(input);
  return () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };
}, [input]);
```

Termination stops that worker without waiting for its current computation and discards its runtime. Other workers and the page continue independently. A string or Boolean result needs no additional disposal.

The runnable fixture creates a new worker for each submitted input, so a retired worker cannot publish a result for newer input. For a long-lived worker handling overlapping requests, include a request ID and match replies before applying them. Terminate the worker when its application owner finishes.

## Diagnose an install or call failure

| Symptom | Action |
| --- | --- |
| npm fetches `@lean-bridge/runtime` | Install both verified archives together and compare their versions with the receipt. |
| TypeScript rejects a numeric argument | Use `bigint` instead of casting away the generated type check. |
| `JSON.stringify` rejects the result | Convert the `bigint` to a string first. |
| `Unsupported component private ABI` | Rebuild the component and use its exact runtime dependency. |
| Browser import fails | Inspect component and runtime requests in the network panel. |
| Assets return 404 after deployment | Match Vite's `base` to the deployment prefix and upload the complete `dist` directory. |
| A corrected asset still fails to load | Reload the page; failed ESM initialization can remain cached in that page. |
| A component leaves while loading | Ignore its pending result in effect cleanup, or terminate its worker when the work should stop. |

### Do I manage the shared runtime?

No. The component declares its exact runtime dependency, npm resolves it, and the generated import initializes it. Application code imports only the component's public API.

The local archive recipe supplies the runtime tarball alongside the component because that handoff does not depend on a registry copy. Both go through one install command; the application code stays the same.

[Combine Lean packages](concepts/shared-runtime.md) explains compatible runtime sharing and separate worker instances. [Types and values](reference/types.md) and [Ownership and cleanup](concepts/ownership.md) cover the call boundary.

## Start from a raw Lean package

Follow [the JavaScript and TypeScript build-and-publish guide](publish/npm.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](lean/existing-package.md).

### Check the author's exact package

Repository checks live in [Contributing](contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](publish/npm.md).
