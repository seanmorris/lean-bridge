# Compiled npm options, results and products, 20 September 2026

VO1219 adds compiler-backed npm packages for `Option`, `Except` and nested
binary products. These constructors can contain any supported primitive,
arrays, acyclic copied records and each other.

## Representation

| Lean value | JavaScript value |
| --- | --- |
| `Option.none` | `{ tag: "none" }` |
| `Option.some ()` | `{ tag: "some", value: undefined }` |
| `Option.some Option.none` | `{ tag: "some", value: { tag: "none" } }` |
| `Except.ok value` | `{ ok: value }` |
| `Except.error error` | `{ error }` |
| `((a, b), c)` | `[[a, b], c]` |

TypeScript uses readonly tagged unions and readonly tuples. Result arguments in
Binding IR are `[success, error]`; Lean's source order is `Except error success`.
Products keep their binary nesting. Objects require exact own data fields;
tuples require dense ordinary arrays with exactly two elements. No branch is
flattened into null or undefined, and `Except.error` returns a value rather than
throwing a JavaScript exception.

Fresh compiler metadata and independently specified reviewed contracts feed
private ABI 6. Its nominal record table may be empty. Existing scalar, callable,
array and record-only packages retain ABIs 2 through 5. Lean constructs, matches
and projects branches and fields through typed helpers with one-element Array
carriers. C never reads raw constructor tags or offsets. Helper symbol identities
use canonical descriptors and survive serialization between build stages.

Calls allow 32 container levels and at most 16 MiB of copied slots and payloads
across all inputs and output. Descriptor expansion stops at 4,096 nodes. These
limits do not bound the working heap inside Lean. Partial result-budget failures
release owned nested output and leave the runtime usable; traps and malformed
output poison the shared runtime.

## Installed checks

```sh
PLAYWRIGHT_BROWSERS_PATH=/app/.toolchains/playwright \
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
node --test tests/component-compounds.test.mjs
node --test tests/component-compound-contract.test.mjs
```

The [machine-readable evidence](npm-compounds-20260920.json) records both source
paths, source and consumer hashes, and exact runtime/component archives. Each
package installs offline with author sources relocated and compiler tools absent
from the consumer PATH. Node and strict TypeScript execute both paths; Chromium,
Firefox and WebKit execute pages, React and dedicated workers. Each JavaScript
context performs 5,197 checks. Separate recordless packages execute three nested
option-state checks in the same contexts.

The fixture exercises all nineteen primitives in each constructor, nested
none/some Unit, asymmetric result types, 24 nested options, products of products,
mixed record fields and arrays of tagged values. It includes exact large
integers, signed zero, NaN, infinities, Unicode, NUL and independent byte copies.
Repeated oversized results must fail and recover on the next valid call.
Strict TypeScript also rejects missing payloads, null options, flattened tuples
and number values where a nested UInt64 requires bigint.

Raw Wasm checks reject malformed tags, branch/count mismatches, pointers and
budgets. They repeat partial tuple/option/result cleanup 500 times. Contract
tests cover changed branch types, product arity, ownership, effects, descriptor
accessors, host getters, allocation failures and runtime poisoning.

A compile-time UInt64 constant exposed a missing `LEAN_EMSCRIPTEN` definition:
the host-width static initializer lost its upper 32 bits. Emscripten component,
captured C input and runtime compilation now select Lean's wasm32 layout. The
installed regression checks the exact `18446744073709551615n` result.

The Shop/Telemetry npm corpus keeps its scalar-only selection and now adds a
`List UInt32` export to its negative-build copy. Its original source/oracle
modules remain unchanged. Options and results no longer serve as rejection
evidence for npm.

This milestone promotes 90 type/path/position/profile cells: option, result and
tuple inputs, results and fields in five npm profiles on both source paths.
Native and PHP-Wasm constructors, lists, variants, recursive types and compound
callables remain separate work. Copied containers still cannot share an npm
component with callable exports or contain callbacks or resources.
