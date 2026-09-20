# npm copied-value transport staging, 20 September 2026

VO1219 now has a typed slot codec for nested arrays, tuples, Option and Except.
The tests exercise JavaScript conversion in `WebAssembly.Memory`. They do not
execute Lean or install packages. Compiler and npm package admission remain
unchanged, and no installed type-coverage cells advance.

## Host values

| Lean value | Staged JavaScript representation |
| --- | --- |
| `Array α` | Dense `Array` of generated element values |
| Product / tuple | Fixed-length array, preserving nested products |
| `Option.none` | `{ tag: "none" }` |
| `Option.some value` | `{ tag: "some", value }` |
| `Except.ok value` | `{ ok: value }` |
| `Except.error error` | `{ error }` |

`Some Unit` has an own `value` property whose value is `undefined`. It differs
from `None`. Nested options retain every branch: `None`, `Some None`, and
`Some (Some Unit)` are separate host and wire values. Option values do not use
the generator's older nullable projection; compiler integration must update
that projection and its generated validators together.

The result type arguments remain `[success, error]`, so `Except String UInt32`
has a numeric `ok` payload and a text `error` payload. Negative tests exchange
the two types and reject objects containing both alternatives.

Named records, aliases, variants, recursive type definitions, identity values
and callable containers remain rejected by this codec. Lean `List` needs a
compiler-owned lowering to the copied sequence representation. It is not a new
Binding IR constructor.

## Wire and limits

Each node uses the existing sixteen-byte scalar-slot layout. Primitive tags
0 through 18 and their exact conversions are unchanged. Internal compound tags
32 through 35 identify array, tuple, option and result nodes. A compound slot
contains a child-slot pointer and count. Bit zero chooses the option/result
branch; bit one is reserved for native-owned child storage. Consumers never
see pointers, tags or Lean constructor numbers.

The codec snapshots closed descriptors and rejects accessors, sparse argument
lists, unknown shapes, cycles, more than 32 nesting levels or more than 4,096
type nodes. Host containers must have own data fields. Array holes, extra fields,
accessors, numeric coercions and cycles fail validation.

One budget covers all copied slots and payload bytes across a call's arguments
and result, up to 16 MiB. Array storage is charged before allocation. UTF-8 bytes
and arbitrary-integer limbs count toward the same allowance. This bounds the
transport's copies, not Lean's working memory or the application's existing data.

Reads check addresses, alignment, tags, flags, constructor counts and remaining
budget before traversing child storage or allocating host arrays. They reject
wire cycles. Returned arrays and bytes retain no input or Wasm-memory aliases.
Writes reacquire memory views after allocation because Wasm memory may grow.

The caller owns every input allocation through its call arena, including after
partial validation or allocation failure. The codec does not free native-owned
outputs. Integration must supply recursive output cleanup, including partially
constructed results, and preserve poisoned-runtime handling after traps.

## Checks

```sh
node --test tests/component-copied-codec.test.mjs
```

The suite covers all nineteen primitives inside nested arrays, asymmetric
results, nested options, mixed tuples, Unicode/NUL, large integers, signed zero,
NaN, byte independence, memory growth, budgets, malformed wire values and
allocation-failure cleanup by the owning arena. Compiler-admission regressions
confirm these staged shapes still reject in ordinary npm compilation.

Validation passes eighteen copied-codec tests and forty combined copied/scalar/
callable transport tests. The complete contract suite passes 1,337 tests with
62 gated skips. Documentation passes 66 tests and the site passes 111. Lint,
repository/site type checks and the production site build pass. The installed
type matrix remains at 2,990 / 6,562 cells; refreshing the shared test-manifest
hash does not change historical archive identities or coverage.

## Remaining integration

1. Generate compiler-owned Lean/C adapters, beginning with arrays and then
   records and the remaining copied constructors. Preserve compiler-owned
   record layouts and canonical Except argument order in both directions.
2. Authenticate a versioned compound descriptor against Binding IR and the
   shared runtime. Add native validation and bounded recursive result cleanup.
3. Generate matching JavaScript validators and TypeScript definitions. Enable
   the transport only after ordinary-source and independently reviewed archives
   pass clean installed Node, TypeScript, browser, React and worker tests.
4. Extend source and host coverage to lists, aliases, variants, recursive copied
   structures and compound callable signatures. Update the type matrix only
   from the corresponding installed evidence.
