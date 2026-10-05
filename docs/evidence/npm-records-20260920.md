# Compiled npm records, 20 September 2026

VO1219 adds compiler-backed npm packages for named acyclic copied records. The
installed fixture covers seven structures: nineteen mixed primitive fields,
an empty record, UInt64 and Nat single-field records, two differently ordered
products and a parent containing records and nested arrays of records.

## Compiler and representation

Fresh Lean metadata supplies nominal names, field order and structural types.
An independently written reviewed contract must agree with that metadata before
the compiler emits adapters. Private ABI 5 binds the same definitions to pure,
synchronous copied ownership; incompatible or incomplete runtime exports stop
packaging and loading. Scalar, primitive-callable and array-only packages retain
ABIs 2, 3 and 4.

Lean-generated constructors and field accessors keep record layout private.
Each record crosses C in a one-element Lean Array carrier. Typed Lean functions
build, project and unwrap those carriers, including records represented as
scalars by the compiler. Bounds-checked access uses a local proof; the generated
Lean source introduces no axioms, admitted goals or unsafe casts. C operates on
arrays and boxed primitives, with prototypes checked against Lean's emitted C.

## Host values and cleanup

Consumers pass ordinary objects or objects with null prototypes. The package
requires exactly the declared own data fields. It rejects missing or extra
fields, accessors, symbol properties, custom prototypes and cycles before the
Lean call. TypeScript exposes named readonly interfaces and nested
`ReadonlyArray` types. Results own independent records, arrays and byte buffers.
Record and field names must use the supported ASCII identifiers; field names
`__proto__`, `prototype` and `constructor` are rejected.

Calls share a 16 MiB transport budget across all copied slots and payloads in
arguments and results, and allow at most 32 container levels. Descriptor expansion
is capped at 4,096 nodes. These limits do not bound Lean's working heap.
Parents charge every child slot before allocating zeroed output tables.
Result-budget failures release partial nested output and preserve the runtime
for the next call. Traps or malformed output poison the shared runtime and skip
unsafe heap traversal.

## Installed checks

```sh
PLAYWRIGHT_BROWSERS_PATH=/app/.toolchains/playwright \
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
node --test tests/component-records.test.mjs
node --test tests/component-record-contract.test.mjs
```

The [machine-readable record](npm-records-20260920.json) binds source and consumer
hashes to offline-installed ordinary-source and reviewed-IR archives. Author
sources are relocated and compiler tools are absent from the consumer PATH.
Node JavaScript, strict TypeScript, browser pages, React and dedicated workers
execute both paths; browser checks use Chromium, Firefox and WebKit. Each
JavaScript context performs 4,257 checks.

Lean inspects all nineteen primitive fields through arithmetic, bit and content
checks. Other exports change fields, reverse nested collections and create text
records. Consumers test exact integers, signed zero, NaN, infinities, Unicode,
embedded NUL, empty values, copy independence, invalid input and repeated
oversized-result recovery. Strict TypeScript checks all nineteen field mappings
and rejects missing fields and incompatible integer types.

Raw Wasm checks reject malformed record tables and repeat partial nested output
allocation failures with idempotent cleanup 500 times. Contract checks exercise
field-order and nominal-identity drift, ownership/effect changes, descriptor
accessors, independent wire decoding, host getters, input allocation failure and
runtime poisoning. Descriptor binding also survives canonical JSON key ordering.

The older Shop/Telemetry npm corpus keeps its scalar-only export selection. Its
unselected aggregate cases remain gaps for that release, while its rejection
probe now tests only pending Option/Except signatures. This fixture supplies the
record and field evidence separately.

This milestone promotes record inputs, results and fields, all nineteen primitive
field types and array fields in the five npm profiles on both source paths.
It also extends existing array input/result evidence to record elements. Generic,
inherited, dependent and recursive records, variants, aliases, List lowering,
Option, Except and tuples remain work. Copied containers and primitive callables
cannot yet share one component; resources and callbacks cannot occur in fields.
