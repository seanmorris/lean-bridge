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

Packages can accept synchronous JavaScript functions and return callable Lean functions. Arguments and results use the same primitive and copied-value mappings as ordinary calls, including recursive records and variants. Callbacks must return a value immediately; returning a Promise is an error.

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

### Structured callbacks

Callbacks and returned functions can accept arrays, Lists, options, results,
tuples, records, variants, aliases and finite recursive values. Use plain objects
and arrays with the generated TypeScript types. Each crossing makes an independent
copy, including values captured by a returned Lean function.

For the `structured` package in the [publisher example](publish/npm.md#export-structured-callbacks),
save `structured-callbacks.mjs`:

```js
import { callRecord, makeRecord, callRecursive } from "structured";

const input = {
  text: "copied",
  rows: [{ tag: "none" }],
  count: 1n,
  nested: { tag: "some", value: { ok: [3n, undefined] } },
};
const changed = callRecord(input, value => ({ ...value, count: value.count + 1n }));
const captured = makeRecord(changed);
try {
  changed.text = "changed after capture";
  const result = captured(true, input);
  console.log(result.text);
  console.log(result.count.toString());
} finally {
  captured.dispose();
}
const leaf = callRecursive({ kind: "leaf", value: 19n }, tree => tree);
console.log(leaf.kind);
```

Run `node structured-callbacks.mjs`. It prints `copied`, `2` and `leaf` on separate
lines. Browser, React and worker imports use the same generated functions.

Structured calls allow 128 value edges, 262,144 copied value slots and 16 MiB of
copied slots and payloads per enclosing call. Callback inputs, replies and the
final result all count toward that call's budget. Cycles, malformed properties,
invalid tags and over-budget copies reject; a valid call can follow rejection.
Native corruption or a Wasm trap retires the shared runtime. A callback's original
thrown value survives cleanup, including `throw undefined`.

Primitive and structured exports can share a package and runtime. Callables and
resource identities cannot be fields or elements of copied values. A callback
borrow expires when its enclosing call returns; Promise results and retained
host callbacks remain unsupported.

[Installed structured-callback checks](evidence/npm-structured-callables-20260925.md)
cover both source paths in Node, strict TypeScript and three browser engines,
including React and workers. The test executes the example above from the
original installed archives after deleting the producer's source and build.

`Fin n` leaves use `bigint` in callback arguments and replies. The
[ordinary browser checks](evidence/browser-callback-fin-20261008/receipt.json)
cover pages, React and workers in Chromium, Firefox and WebKit, including
host-produced `Fin 3` and `Fin 5` replies, returned closures, rejected bounds,
disposal and recovery. The
[reviewed Node checks](evidence/reviewed-callback-fin-20261008/receipt.json)
cover bounds 3, 5 and 10; the R2 fixture also checks a host-produced `Fin 3`
reply. TypeScript checks the generated declarations; the installed Node package
provides the runtime checks. Reviewed browser callback coverage remains open.

For top-level `Fin n` arguments, both public JavaScript calls and direct compiled
runtime calls reject values outside `0 <= value < n`. The
[scalar rejection checks](evidence/npm-scalar-fin-rejection-20261007.md) cover
Node and browser calls. A separate
[compiled Node source-entry probe](evidence/scalar-fin-source-entry-20261008/receipt.json)
records every call across six private ABIs: all 15,286 rejected calls stop before
entering the Lean function, and 15,298 valid calls enter it. The probe uses
instrumented packages, including valid controls and recovery calls. Its counters
measure Node execution, not browser or native-host execution.

[Scalar and container entry checks](evidence/wasm-fin-entry-20261009.md) also
cover ordinary-source and independently reviewed packages in Node, strict
TypeScript, browser pages, React and workers. They count Wasm adapter entries
in unmodified packages and Lean source entries in separately instrumented
packages. Invalid calls, valid controls and recovery are checked in both modes.

### Owned resources inside structured values

The `javascript-wasm-owned-v1` package profile supports identity-bearing values
inside records, arrays, Lists, options, results and recursive values. Authors
select this profile through an [explicit ownership policy](publish/npm.md#build-owned-value-npm-packages).
It is separate from the copied-value mappings below; it does not reinterpret
resources as plain copied objects.

For packages without anchored results, resource wrappers expose `dispose()`,
`disposed` and `retain()`. Repeated references to the same live resource preserve
JavaScript identity. Dispose each owned wrapper when finished. `retain()` gives
you an independent lease that must also be disposed. Returned function leases
follow the same cleanup rules.

Callback resource arguments are borrowed for that call. They expire when the
callback returns; call `retain()` inside the callback if you need a longer-lived
reference. A disposed, expired or forged wrapper is rejected before calling
Lean. Application exceptions retain their identity through callback cleanup.
Resource wrappers belong to their runtime realm and cannot be sent between
workers with structured cloning.

The [installed-package checks](contributing/testing.md#javascript-ownership-transport-and-generated-apis)
cover Node, strict TypeScript, Chromium, Firefox, WebKit, React and workers.
Copied and owned packages built against the same runtime share its dependency
automatically. Import order does not require configuration. Closing an owned
API releases that component's leases without closing other loaded packages.

### Borrowed results and whole-value owners

When a package declares results borrowed from an input parameter, its owned
results use `LeanValue<T>`. This includes resources, returned functions and
structured values containing them. Copied scalar results stay ordinary values.

`get()` reads the payload. `share()` adds a root to the same owner, while
`retain()` creates an independent owner. Closing the last shared root, or
consuming that owner, expires its borrowed descendants. Empty arrays, Lists
and `None` follow the same rule.

With `api` imported from a package whose `retainTicket` borrows from its input:

```js
const owner = api.newTicket(42n, "door");
const borrowed = api.retainTicket(owner);
const independent = borrowed.retain();
try {
  console.log(api.serial(borrowed)); // 42n
  owner.dispose();
  try {
    borrowed.get();
  } catch (error) {
    if (!borrowed.disposed) throw error;
    console.log("expired");
  }
  console.log(api.serial(independent)); // 42n
} finally {
  borrowed.dispose();
  independent.dispose();
  owner.dispose();
}
```

Pass whole owners to anchored and consuming parameters. Other parameters
accept payloads or their whole owners. A returned function is called through
`owner.get()(arguments)`; its results use the same generated value types.

To construct an owned aggregate from JavaScript data, use
`copyValue(payload, { resultOf: "exportName" })` or
`copyValue(payload, { parameterOf: ["exportName", 0] })`. The selector names an
exported owned type. TypeScript checks its payload shape. This also lets an
empty array acquire an owner before it is passed to a borrowing function.

Nested resource views do not keep their whole owner alive. Their `retain()`
method creates an independent `LeanValue`. Compare resource identity with
`view.equals(otherView)`, including views obtained from different owners.
Returned functions can also borrow results from their own arguments.

### Borrowed callback results

Pass the selected argument as a whole owner, without calling `get()` on it.
The callback returns another whole owner. Its payload can contain resources,
records or finite recursive values, including empty values.

With `api` imported from a package whose `makeRecord` returns a
`Bool → Bundle → Bundle` function that borrows its second argument:

```js
const ticket = api.newTicket(42n, "callback");
const input = api.echoRecord({
  primary: ticket.get(), spare: { tag: "none" }, peers: [], history: [],
  payload: { count: 7n, bytes: new Uint8Array([42]) }
});
const closure = api.makeRecord(input);
const view = closure.get()(false, input);
const retained = view.retain();
try {
  console.log(api.serial(view.get().primary)); // 42n
  input.dispose();
  console.log(view.disposed); // true
  console.log(api.serial(retained.get().primary)); // 42n
} finally {
  for (const value of [retained, view, closure, input, ticket]) value.dispose();
}
```

Releasing the selected argument's last shared root, or consuming that owner,
expires the result and its borrowed descendants. This rule holds even when the
closure returns captured data. TypeScript requires the selected argument's whole
owner and preserves generated receiver methods on the returned owner.

A host callback may return its borrowed payload or a whole owner of the declared
result type. The bridge converts the reply before the callback frame expires;
escaped argument views expire when the callback returns. Callback-result
lifetimes do not permit asynchronous callbacks or retained host callbacks.

### Methods and properties

When the author marks an export as a method or property, call it on the generated
whole-value owner. TypeScript names these owners, such as `TicketValue` and
`BundleValue`. Properties are read-only. `share()` and `retain()` preserve the
owner's member types.

For a package with a `serial` property and a receiver-borrowing `retainTicket`
method:

```js
const owner = api.newTicket(42n, "door");
const borrowed = owner.retainTicket();
const independent = borrowed.retain();
try {
  console.log(borrowed.serial); // 42n
  owner.dispose();
  try {
    console.log(borrowed.serial);
  } catch (error) {
    if (!borrowed.disposed) throw error;
    console.log("expired");
  }
  console.log(independent.serial); // 42n
} finally {
  borrowed.dispose();
  independent.dispose();
  owner.dispose();
}
```

A method's result can borrow from its receiver or another argument. The result
follows the declared original owner. A consuming method invalidates its
receiver's shared roots and borrowed descendants before Lean runs.

Resource views returned by `get()` expose members that neither consume nor
borrow from the receiver. For example, `owner.get().serial` reads the property;
`owner.retainTicket()` needs the whole owner. A view expires when its owner does.

Use `copyValue(payload, { receiverOf: "methodName" })` to create an independent
receiver from a payload. For method exports, `parameterOf` indexes the remaining
arguments, excluding the receiver. Named function exports remain available too.
The package manages its shared runtime in both forms.

### Consuming inputs

An argument declared `transfer` consumes its shared result owner. Every alias
and sibling handle from that owner becomes unusable before Lean runs, including
inside callbacks. Validation failures leave the inputs usable. A failure after
handoff does not restore them.

Call `retain()` first if you need an independent lease. For an API whose
`retainTicket` export declares its argument as a transfer:

```js
const original = api.newTicket(42n, "door");
const kept = original.retain();
let returned;
try {
  returned = api.retainTicket(original);
  console.log(original.disposed); // true
  console.log(api.serial(kept)); // 42n
  console.log(api.serial(returned)); // 42n
} finally {
  original.dispose();
  kept.dispose();
  returned?.dispose();
}
```

A consuming aggregate in a package without borrowed results or receiver members
can contain handles from several owners. Repeated
references within one argument are allowed. Two consuming arguments cannot
share an owner; retain a separate lease for the second argument. Callback
arguments are borrowed and must be retained before passing them to a consuming
export. Consuming function arguments require returned Lean function leases,
not ordinary JavaScript functions. TypeScript checks that distinction.
Packages with borrowed results or receiver members require one whole owner per
consuming argument.
Use `copyValue` to gather payload views into an independent aggregate first.

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
| `Array α` | `ReadonlyArray<T> (supported copied elements)` (input, result, field); `ReadonlyArray<T> (ordinary dense Array)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Dense data arrays, recursively; holes, accessors, extra properties and cycles reject. Record elements and nested byte buffers are independent copies. No Wasm views or disposal. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `{ readonly tag: "none" } \| { readonly tag: "some"; readonly value: T }` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact own tags preserve none, some Unit and every nested option. Null and omitted payloads reject. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `{ readonly ok: T } \| { readonly error: E }` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one own data property selects ok or error, including Unit payloads. IR arguments are [success, error]; a domain error returns a value. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `readonly [A, B] (nested binary products)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact dense ordinary arrays preserve two-element arity and source product nesting. Typed arrays, holes and flattened products reject. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Named readonly interface; copied plain object` (input, result, field); `Named readonly interface (plain JavaScript object)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Node JavaScript / TypeScript: Encoding copies exactly the declared own data fields. Results own independent records, arrays and byte buffers. No disposal or Wasm memory access. Ordinary-source Node inputs/results/fields keep inherited parent subobjects in their declared named fields (for example toBase), with the parent's own record value nested inside. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Encoding copies exactly the declared own data fields. Results own independent records, arrays and byte buffers. No disposal or Wasm memory access. Browser / React / Worker: Encoding copies exactly the declared own data fields. Results own independent records, arrays and byte buffers. No disposal or Wasm memory access. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Named TypeScript alias with the target’s ordinary JavaScript value representation` (input, result, field); `Resolved target type with a named TypeScript alias` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Compiler-authenticated names, targets and chains. Runtime validation and copied ownership follow the target; no wrapper, coercion or loss of exact primitive semantics. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `Named readonly discriminated union: { kind: "caseName", ...fields }` (input, result, field); `Named tagged readonly union (plain JavaScript object)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact own data fields and a kind discriminator. Empty constructors remain distinct; Unit fields remain present. Return values are independent copies. Getters, inherited/extra/symbol fields, unknown constructors and malformed payloads reject. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | No host mapping recorded | Ordinary source: Compilation rejected. Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Synchronous JavaScript function` (input) | Ordinary source: Installed checks passed (input); Compilation rejected (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Borrowed until the outer call returns. A Promise result is rejected; the first thrown value is preserved. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `ReadonlyArray<T> (ordinary dense Array)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Preserve order, duplicates and every nesting level. Lists and Arrays remain distinct in the IR. Returned arrays and mutable payloads are independent copies. Dense own data elements only; holes, accessors, extra fields, typed arrays and cycles reject. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, not one UTF-16 code unit or one grapheme cluster. NUL and supplementary characters are preserved; empty strings, multiple scalars, unpaired surrogates and non-strings are rejected without coercion or normalization. TypeScript uses string with runtime validation. Exactly one Unicode scalar in a string; surrogates and multiple scalars reject. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 32-bit compiled Lean target, 0..4294967295. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Unsigned number in the range of the 32-bit compiled Lean target. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `number` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 32-bit compiled Lean target, -2147483648..2147483647. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Signed number in the range of the 32-bit compiled Lean target. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | Node JavaScript / TypeScript: `bigint checked as 0 <= value < n before Wasm dispatch` (input); `bigint checked as 0 <= value < n after Wasm return` (result); `bigint checked against the declared bound in copied fields and aliases` (field); `bigint checked against the declared bound in callback arguments` (callback input); `bigint checked against the declared bound in callback results` (callback result); Browser / React / Worker: `bigint checked as 0 <= value < n before Wasm dispatch` (input); `bigint checked as 0 <= value < n after Wasm return` (result); `bigint checked against the declared bound in callback arguments` (callback input); `bigint checked against the declared bound in callback results` (callback result) | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Installed checks passed (input, result, callback input, callback result); Not audited (field). Reviewed IR: Node JavaScript / TypeScript: Installed checks passed (input, result, callback input, callback result); Not audited (field); Browser / React / Worker: Installed checks passed (input, result); Not audited (field, callback input, callback result) | Node JavaScript / TypeScript: The public value is bigint. JavaScript validates Nat and the strict upper bound before dispatch and after return; the compiled adapter entry independently fails a direct call with an out-of-bound input before the typed wrapper or source runs. Copied nominal fields keep their bigint representation. JavaScript and typed Lean constructors validate their bounds, including through container aliases and finite recursive values. Callback arguments and replies keep bigint leaves, including in copied fields, aliases and recursive values. JS validates both directions; compiled Lean independently checks host replies and closure inputs before constructing proof-carrying values. Callback errors unwind with valid typed recovery values and leave later calls usable. Use bigint leaves with the declared closed bound. Public JavaScript and raw compiled adapters reject invalid inputs, and later valid calls remain usable. Reviewed R1 callback arguments and Lean-produced results; R2 additionally validates the npm-only Fin 3 host-produced reply. Strict TypeScript checks declarations; Node provides the runtime observations. Browser / React / Worker: The public value is bigint. JavaScript validates Nat and the strict upper bound before dispatch and after return; the compiled adapter entry independently fails a direct call with an out-of-bound input before the typed wrapper or source runs. Ordinary callback arguments and results in the named browser profile, including host-produced Fin 3 and Fin 5 replies, returned closures, bound rejection, disposal and recovery through public and raw runtime calls. Use bigint leaves with the declared closed bound. Public JavaScript and raw compiled adapters reject invalid inputs, and later valid calls remain usable. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | `host type of the declared primitive, checked by the compiled Lean constructor before dispatch` (input); `host type of the declared primitive, projected from a proof-backed Lean result` (result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Node JavaScript / TypeScript: Installed checks passed (input, result); Not audited (field, callback input, callback result); Browser / React / Worker: Not audited | Node JavaScript / TypeScript: The host uses the base primitive representation. Compiled Lean validates inputs and constructs the proof-carrying subtype before the source call; heap-backed inputs are retained for validation and all decoded objects are released if validation rejects. Results are projected through .val after Lean returns. Reviewed Binding IR selects the checked constructor, including normalizing constructors that preserve the caller's input. Browser / React / Worker: The host uses the base primitive representation. Compiled Lean validates inputs and constructs the proof-carrying subtype before the source call; results are projected through .val after Lean returns. Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Checked records and closed Nat indices` | Node JavaScript: `Object with bigint and bigint[] payload fields` (input); `Copied object with bigint and bigint[] payload fields` (result); TypeScript: `Generated structural record type with bigint and bigint[] payload fields` (input); `Generated structural record type with copied bigint and bigint[] fields` (result); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed (input, result); Not audited (field, callback input, callback result); Browser / React / Worker: Not audited. Reviewed IR: Node JavaScript / TypeScript: Installed checks passed (input, result); Not audited (field, callback input, callback result); Browser / React / Worker: Not audited | Node JavaScript / TypeScript: Pass only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101. Input constructors validate cross-field predicates or normalize values inside Lean without changing caller input. Results expose payload fields, not proofs. A standalone result-only package works without any checked input. Other indices, nested/refined/recursive records and dynamic dependent payloads are not covered. Required: Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named recursive readonly types; ordinary objects and arrays` (input, result, field); `Named recursive TypeScript types (finite plain objects and arrays)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Preserves constructor/field order, aliases and all copied containers. Shared subtrees copy independently; ancestor cycles reject. Output receipts require exact, disjoint, owned buffers. Invalid results or traps retire the shared runtime; bounded conversion failures recover. Callback and captured values preserve constructor identity, Option presence and independent mutable storage. Original exceptions survive cleanup. Borrowed host callbacks expire when the enclosing call returns; returned Lean functions own disposable leases. Cycles, invalid fields and over-budget values reject; native corruption retires the shared runtime. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | Node JavaScript / TypeScript: `Concrete function; named readonly interface per alias-named record` (signature); `Concrete reviewed function over named readonly interfaces and List/Option aliases` (signature); Browser / React / Worker: `Concrete function over named record, List and Option aliases` (signature); `Named finite specializations` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Generator inspected | Node JavaScript / TypeScript: Each configured type application becomes a distinct monomorphic export. The unspecialized Lean declaration is absent from the package. An alias-named instantiation is one monomorphic host record type per alias; no type argument crosses at runtime. Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures. Reviewed packages select finite applications from the authored Binding IR. Reviewed generic records retain each alias's name and compiler-resolved origin. Call the generated concrete function with the named record, List or Option value; no runtime type argument crosses the boundary. Browser / React / Worker: Import a concrete export and pass the package's named record, List or Option value. Each alias keeps its descriptor identity; no runtime type argument crosses the boundary. Array fields keep their copied array representation. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | `Concrete host signature with no runtime type argument` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited | Node JavaScript / TypeScript: Lean elaboration supplies configured type arguments. They have no host runtime representation and are not replaced with null or any. Reviewed record specializations fix the implicit type to a closed record or List/Option alias before compilation. Browser / React / Worker: Lean supplies the configured type argument before compilation. Call the concrete function with its value only, without a type token or placeholder. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | Node JavaScript / TypeScript: `Concrete host signature with the Lean-selected instance dictionary erased` (signature); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited | Node JavaScript / TypeScript: Lean synthesizes the selected dictionary before compilation. The host receives the resulting concrete callable and cannot substitute a dictionary. Required: Specialize or supply the selected dictionary without changing runtime behavior. |
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

The copied-value component path accepts primitives, concrete copied aliases, nested arrays and Lists, copied records, concrete tagged variants (including bounded recursive values), `Option`, `Except`, nested products, and synchronous functions with primitive or copied arguments and results. Copied values, callbacks, and returned functions can share one component. Resource-containing values use the [owned-value profile](#owned-resources-inside-structured-values). `IO` and `Task` remain unsupported. Prepared profiles, including Alpha, have their own generated APIs. The [runtime reference](consumers.md) identifies those packages; a mapping in another profile does not add exports to this one.

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
[Rust](evidence/rust-lists-20260920.md), plus
[C#](evidence/dotnet-lists-20260920.md) and
[Java/Kotlin](evidence/jvm-lists-20260920.md), along with
[Ruby](evidence/ruby-lists-20260921.md) and
[Perl](evidence/perl-lists-20260921.md) and
[native PHP](evidence/php-native-lists-20260921.md) and
[PHP-Wasm](evidence/php-wasm-lists-20260921.md) and
[WIT/WASI](evidence/wit-lists-20260921.md).
Lists cannot contain callbacks or resources. A component can export both copied
Lists and synchronous callbacks, including callbacks that take or return Lists.

### Copied records

Lean structures become named TypeScript interfaces with readonly fields and plain
JavaScript objects. Fields may contain any supported primitive, nested arrays and Lists,
options, results, products, copied variants or other acyclic copied records. Empty and single-field
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
Closed generic records use the named specializations below. Node's inherited-record
mapping has separate installed checks below. Dependent records need their own
acceptance evidence. Recursive copies use the graph transport described below.
Records cannot contain callbacks or resources. A component can export both copied
records and synchronous callbacks with copied record arguments and results.

### Named generic specializations

Import the concrete functions and record types the package exports. The author
selects the Lean type arguments before compilation, so you pass ordinary values
without a runtime type argument. A named `Box Nat` instantiation, for example,
uses an object such as `{ value: 3n, count: 1n }`. Its `Box String` counterpart
uses a string for `value`. Each alias keeps its own name in the package descriptor.

The [hosted Node and TypeScript checks](evidence/generic-record-npm-hosted-20261008/receipt.json)
cover direct record exports and nine configured functions over record, List and
Option aliases in two namespaces. Two author builds reproduce the archives. The
harness deletes both author roots and build staging before offline installation,
then runs Node without compilers on its PATH. Strict TypeScript checks the
installed declarations with `skipLibCheck` disabled. The direct and specialized
consumers pass 1010 and 1019 checks, respectively, including recovery after
invalid inputs. This record fixture has an implicit type argument, but no
instance dictionary.

The [installed browser checks](evidence/generic-record-browser-20261008/receipt.json)
cover nine configured specializations over named records, separate namespaces,
List aliases and Option aliases, plus records with Array fields. The same
installed npm package runs in browser pages, React effects and dedicated workers
in Chromium, Firefox and WebKit. React runs in both production and Strict Mode;
the checks also exercise worker disposal and recovery after an asset-load failure.

This browser evidence covers ordinary Lean-source packages and implicit type
arguments. It does not establish instance-dictionary specialization or reviewed-IR
browser packages. The hosted Node record checks above supply the source-deletion
and compiler-free evidence that the [earlier local run](evidence/generic-record-specializations-20261007.md)
did not establish.

Reviewed packages also expose named generic records and concrete functions over
record, List and Option aliases. Import the generated interfaces and functions;
pass ordinary values without type tokens. Interfaces with identical fields remain
structurally assignable in TypeScript, even when their Lean aliases have different
names. The [reviewed package checks](evidence/reviewed-instantiations-20261008/receipt.json)
exercise both direct record exports and nine composed specializations in Node and
strict TypeScript after deleting the author sources and builds. These checks do
not establish reviewed-browser execution or instance dictionaries over the records.

The browser inventory's reproduction command is reconstructed from its fixture
and configuration. Its original queue records times and result, not that command.

### Inherited records in Node

Pass the parent as a nested object under its generated field name, such as `toBase`.
For the installed `GenericInheritance` fixture, the package's `grow` function takes:

```javascript
const grown = api.grow({ toBase: { base: 4n }, child: 7n });
// grown is { toBase: { base: 5n }, child: 14n }.
```

Here `api` is the imported package namespace. Its generated `NatChild` interface
names `toBase: NatBase` and `child: bigint`. Keep the parent object intact; a flattened
`{ base: 4n, child: 7n }` input rejects. Results contain independent copies and need
no disposal. Phantom type arguments add no runtime fields.

The [installed inheritance checks](evidence/inherited-records-20261008/receipt.json)
cover three direct exports over closed aliases with universe and phantom arguments.
Node performs 1005 checks and 1006 rejections; strict TypeScript checks the installed
declarations with `skipLibCheck: false`. Two builds reproduce the package archives;
installation runs offline after deleting the author sources and builds. These are
ordinary-source Node checks, not browser, React, worker, reviewed-inheritance or
configured function-specialization acceptance.

### Checked records and fixed indices

A checked record is an object containing its runtime fields. `Interval` accepts `{ lo: 2n, hi: 5n }`; `Sized 3` accepts `{ data: [1n, 2n, 3n] }`; `Bounded 0 101` accepts `{ value: 75n }`. The package's TypeScript declarations name these structural record types. Do not add proof fields or pass numbers where the declaration requires `bigint`.

The package runs the safe Lean constructor selected for that input site. It checks predicates and fixed lengths before the Lean function runs. A constructor can normalize its copy, such as sorting an array, without changing your object. Results contain copied payload fields from a record Lean has already constructed. A result-only package works without an input constructor.

The [installed Node evidence](evidence/checked-records-20261008/receipt.json) covers ordinary and independently reviewed top-level inputs/results, plus a separate result-only package. The same releases pass strict TypeScript declaration checks with `skipLibCheck: false`. Browser, React, worker, nested-record and general dependent-value acceptance remain unverified for this mapping.

### Tagged variants

Lean's concrete inductive sums become plain objects with a `kind`
discriminator and the selected constructor's fields:

```ts
type Signal =
  | { readonly kind: "idle" }
  | { readonly kind: "marker"; readonly value: void }
  | { readonly kind: "data"; readonly count: number; readonly label: string };

const input: Signal = { kind: "data", count: 42, label: "ready" };
```

Generated packages supply their own named types. Switch on `kind` to narrow a
result. Empty constructors retain distinct names; an explicit Unit field must
be present with value `undefined`. Extra fields, inherited fields, getters and
unknown constructor names reject. Returned objects and buffers are independent
copies and need no disposal.

Variants compose with records, arrays, Lists, options, results and products.
The same copied-value budgets apply. `kind` is reserved for the discriminator.
Generic, indexed, proof-bearing and identity-bearing variants remain
unsupported by this npm profile. Both source paths have
[installed variant checks](evidence/npm-variants-20260921.md) across Node,
TypeScript, browsers, React and workers.

### Named aliases

Concrete Lean aliases become exported TypeScript aliases. Their values use the
target type's normal JavaScript representation:

```lean
abbrev Count := UInt32
abbrev Counts := List Count
def increment (value : Count) : Count := value + 1
```

The generated package exports `type Count = number` and
`type Counts = ReadonlyArray<Count>` when those aliases appear in its public API.
Call `increment(41)` with no wrapper or conversion function. Runtime validation
still checks the UInt32 range. Aliases can target copied records, variants,
arrays, Lists, options, results and products, and can reference other aliases.
Returned objects and buffers remain independent copies.

Both `abbrev` and concrete type-valued `def` declarations retain their source
names and targets. Reviewed IR must match them, even when two aliases have the
same underlying primitive. Long alias chains use a finite type graph and add no
value depth. Generic aliases and aliases containing callbacks
or resources need further adapter work. The
[installed alias checks](evidence/npm-aliases-20260921.md) cover both source paths
in Node, TypeScript and all three browser engines, including React and workers.

### Recursive values

Recursive Lean types produce named recursive TypeScript types. Use ordinary
objects and arrays, with the same constructor names and fields as Lean:

```lean
inductive Tree where
  | leaf (value : Nat)
  | branch (children : List Tree)

def echo (value : Tree) : Tree := value
```

```ts
type Tree =
  | { readonly kind: "leaf"; readonly value: bigint }
  | { readonly kind: "branch"; readonly children: ReadonlyArray<Tree> };

const tree: Tree = {
  kind: "branch",
  children: [{ kind: "leaf", value: 42n }],
};
```

The generated package supplies `Tree`; callers do not recreate it. Mutually
recursive types, copied record wrappers, aliases, arrays, Lists, options,
results and products compose. Shared subtrees return as independent copies.
Host cycles reject, including cycles across two different nominal types.

Graph-backed calls allow 128 value edges and 262,144 value slots. They share a
16 MiB copied-slot and payload budget across all arguments and the result.
These limits exclude Lean's working memory. Oversized results fail without
returning a prefix, and the runtime remains usable. Malformed native results
or traps retire the shared runtime. Native allocation receipts provide cleanup
without following returned pointers.

Both author paths have [installed recursive checks](evidence/npm-recursive-20260922.md)
in Node, strict TypeScript, Chromium, Firefox and WebKit, including React and
workers. All seventeen consumer profiles support recursive copied values in
ordinary inputs, results and fields. npm also supports recursive values in
[callbacks and returned functions](#structured-callbacks).

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
