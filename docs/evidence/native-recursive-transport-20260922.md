# Compiled native recursive copied values

VO 1219, 22 September 2026. Fresh Lean extraction, typed carrier helpers and
native C conversion now execute together. This is transport acceptance, not
installed C/C++ package acceptance. Native package admission remains closed and
the installed type inventory is unchanged.

## Conversion and ownership

The [native generator](../../src/backends/c/native-graph-adapters.mjs) uses the
[finite C layouts](native-recursive-layout-20260922.md) and the shared total
Lean carrier helpers. It authenticates helper signatures and the complete
nominal graph against Binding IR. The carrier descriptor supplies symbols and
types; native conversion does not use a Wasm frame or a 32-bit pointer layout.
All nineteen primitives retain their native meanings, including 64-bit USize
and ISize, arbitrary-precision integers, embedded NUL text and raw bytes.

Before allocating any Lean values, the boundary validates every argument. It
checks constructor and Option/Except tags, Unit, Bool, Unicode scalars, UTF-8,
span lengths, alignment, arithmetic overflow and ancestor cycles. Borrowed C
arguments must reference readable process objects. These checks cannot establish
the accessibility of an arbitrary address supplied by a C caller.

Each call shares a 262,144-node and 16 MiB copy budget across all arguments and
the result. Runtime values may have 128 edges of nesting. The byte budget counts
native root storage, pointed-to fields, sequence buffers, payload bytes and
private output-allocation headers. Embedded fields are not charged twice.
Aliases do not add runtime nesting. Repeated references without a backedge
produce independent copied values.

A successful output owns one private allocation chain. Nested values borrow
from that root. Clearing resets the root first, then releases the private chain;
it never traverses public child pointers or constructor tags. The caller must
initialize an output and clear any existing owned result before reusing it.
Failures leave the caller's output unchanged and free partial copied storage.
An owning C root must not be shallow-copied and cleared twice through two owners.

Wide constructor calls use separate nonrecursive helper frames. The recursive
decoder stores pending child carriers in a Lean Array. It does not keep one C
local or stack argument per constructor field in every recursive frame.

## Executed checks

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_RECURSIVE_TEST=1 \
  node --test tests/native-recursive-transport.test.mjs
```

The test compiles the actual source, extracts its metadata, compiles total Lean
helpers, generates native C, and links an executable with an
[independent C caller](../../tests/fixtures/structured-types/native-recursive-check.c).
It passes 169,840 checks through eighteen compiled exports. The generated Lean
helpers contain no `unsafe`, `sorry`, axiom, `partial` or unchecked cast.

Checks cover all primitives, direct and mutual recursion, aliases, Array/List
mixtures, both Except branches, products, and distinct `none`, `some none` and
`some (some ())` values. Empty records and nullary versus Unit-bearing variant
constructors remain distinct. A source-level Lean predicate independently checks the
primitive payload. Tests preserve signed zero, infinities and NaN payload bits;
zero integers and empty text/bytes also round-trip.

An allocation ledger injects failure at each copied-output allocation. Another
hook substitutes an empty carrier at each result-conversion step. Every failure
leaves zero live copied-output allocations; a subsequent raw transport call
succeeds. Tests corrupt an output tag and child pointer before clearing it twice.
They also check an already-owned output, an invalid second argument before any
decoding, shared input subtrees, cycles and a type with no finite inhabitant.

Boundary tests execute the exact shared node limit, input and output depth
failures, and near-limit strings on both sides of the shared byte allowance.
The wide fixture has 255 UInt16 fields and a recursive child. It round-trips
127 recursive layers; the compiler's stack-usage report must contain recursive
decoder frames and keep each below 1 KiB.

The private allocation ledger tracks copied C storage, not Lean's allocator.
Malformed-result status is tested here; production runtime retirement still
belongs in the installed native wrapper. The performance workflow explicitly
enables this compiled test. The default contract profile checks generation and
authenticity without requiring the optional toolchain.

## Pinned-runtime finding and remaining integration

The first stress fixture used 256 UInt32 fields and exceeded Lean's scalar-field
limit. Reducing it to 255 exposed a second limit: its 1,040-byte constructor
allocation reached `mi_malloc_small`, whose pinned 64-bit implementation supports
at most 1,024 bytes. GDB located the fault in that allocation, not recursive
decoder stack growth. The UInt16 fixture keeps 256 carrier arguments while its
source object fits the allocator. Native admission must diagnose oversized
source constructors or use a corrected, authenticated runtime before enabling
those layouts. This test does not claim arbitrary-width Lean constructors work.

Final repository gates pass: 1,841 contract tests with 69 explicit toolchain
skips, 78 documentation tests, 111 site tests, lint, repository/site typechecks
and the production site build. All 37 fresh compiler regression tests pass.
The [callable-alias repair](callable-alias-ci-repair-20260922.md) also includes
rebuilt installed npm recursive, alias and variant packages on both source paths
in all three browsers. Native installed coverage remains unchanged.

Next are the native build model, wrapper status/runtime policy, typed C/C++
packages, and ordinary/reviewed installed consumers. The remaining host
projections, compound callable payloads and explicitly owned identity aggregates
remain part of the structured-types goal.
