# Compiled npm arrays, 20 September 2026

VO1219 adds compiler-backed npm transport for nested arrays containing all
nineteen primitive types. Both ordinary-source and independently reviewed IR
packages compile Lean, install offline and run with the author sources relocated
and compiler tools absent from the consumer PATH.

## Public mapping

`Array α` uses a dense JavaScript array. TypeScript declares
`ReadonlyArray<T>`, recursively. Each primitive retains its scalar mapping:
`bigint` for Nat, Int and 64-bit integers; `number` for wasm32 platform integers
and other numeric values; one-scalar strings for Char; `Uint8Array` for ByteArray;
`undefined` for Unit. Arrays and nested byte buffers are independent copies.

The fixture reverses rows and elements for each primitive, rather than only
returning inputs unchanged. Additional functions perform exact integer
arithmetic, return compiler-created text arrays and combine scalar/array
arguments and results. Checks cover empty arrays, BOM/NUL/supplementary text,
large signed integers, fixed-width boundaries, NaN, infinities and signed zero.
One nineteen-argument function also interprets every boxed primitive in Lean,
checking arithmetic, bits and contents. This catches representation errors that
a paired decoder/encoder could hide during a permutation-only test.

## Validation and cleanup

Private ABI 4 binds closed array descriptors to copied ownership, pure effects,
synchronous results and the exact Binding IR signatures. It requires the copied
runtime exports before linking. Scalar-only and callable-only components keep
their existing ABI versions. Runtime package contents and identities include
the new private codecs; applications still import only the public package.

Generated Lean wrappers preserve parenthesized nested types. Typed C entry points
validate every input before allocating Lean values. Native validation checks
tags, flags, ranges, pointers, alignment, array lengths and UTF-8. It uses Lean's
array API and primitive boxing functions, not a guessed record layout.

Lean-side element checks caught a runtime export omission: `Array.get!` can import
public boxed defaults from Init through `GOT.mem`. The prepared runtime now exports
public Lean data symbols as well as functions. The installed fixture exercises
these imports, and the raw runtime test checks the UInt16 default export.

Each call allows at most 32 array levels and 16 MiB across copied slots and
payloads in all inputs and the result. Both JavaScript and native conversion
charge storage before copying. The limit does not bound Lean's working heap or
data the application already owns. Result-budget and recoverable allocation
errors clear partial native output; input arenas are released on validation
failure. Traps and malformed native output poison the shared runtime and skip
traversal of the damaged heap.

Raw Wasm tests reject malformed pointers, flags, type tags, lengths, unsupported
depths and invalid UTF-8. They repeat a partial-output budget failure 500 times,
then check successful encoding and idempotent cleanup. Installed consumers
repeat oversized-result failures and call the package successfully afterward.
JavaScript call-arena tests also inject allocation failures and traps.

## Installed checks

```sh
PLAYWRIGHT_BROWSERS_PATH=/app/.toolchains/playwright \
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
node --test tests/component-arrays.test.mjs
```

The [machine-readable record](npm-arrays-20260920.json) binds the fixture,
consumer, runtime and component archives to each run. Node JavaScript and strict
TypeScript execute both source paths. Browser pages, React and dedicated workers
execute each path in Chromium, Firefox and WebKit. Each JavaScript context
performs 1,278 checks. Strict TypeScript checks all nineteen nested signatures
and rejects incompatible element types.

WebKit initially lacked GStreamer libraries in the local container. Installing
Playwright's WebKit system dependencies supplies that prerequisite; CI already
installs all three engines' dependencies.

The older Shop/Telemetry npm corpus still selects scalar exports and records
its unselected array/record cases as gaps for that release. Its source-rejection
probe now checks records, Option and Except. The new nineteen-primitive array
fixture supplies this milestone's array evidence independently.

Only the twenty array parameter/result cells across two source paths and five
npm profiles advance. Named records, array fields, compound callables, tuples,
Option, Except, aliases, List lowering and recursive copied values remain work.
Arrays and primitive callables cannot yet share one component. Shared source
hashes in earlier evidence entries are refreshed without altering their
historical archives or promoting their installed scope.
