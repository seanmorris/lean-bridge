# Native recursive copied layouts

VO 1219, 22 September 2026. The native graph layout generator now emits typed
C declarations for recursive copied values. It is not yet connected to native
package builds. Native recursive exports remain gated; installed coverage is
unchanged.

## Layout

The planner retains the finite nominal graph instead of expanding references.
It preserves records, constructor names, ordered fields, aliases, all nineteen
primitive types, Array, List, Option, Except and products.
Aliases inside containers share the target's C type. Structural identities use
finite child hashes, so shared alias targets do not expand into a type tree.

Array and List use typed spans. Their element pointers already break layout
cycles. Direct recursive fields use typed pointers. For mutual recursion, the
planner finds strongly connected components in the by-value dependency graph
and boxes every internal edge. Reordering type declarations cannot change which
fields use pointers.

Acyclic graphs can also cause exponential inline layout growth when several
fields share the same child type. A separate layout budget limits embedded
values to 64 per constructor branch, or the branch's own field count plus one
when that is larger. Aggregate children become pointers when needed; primitive
fields retain their scalar C types. This controls struct size, not the allowed
runtime value depth, node count or copy budget.

Forward declarations and dependency-ordered definitions make the header valid
in C11 and C++20. Option and result tags remain explicit. Recursive-first and
uninhabited variants require no invented default constructor. Initializing or
clearing a variant leaves its tag at `UINT32_MAX` until the caller selects a
constructor.

Nominal C types use a `_t` suffix, so a Lean `Tree` type can coexist with a
`tree` export. The planner reserves function, type and helper names before
emission and rejects collisions. Dynamic primitive carriers use a separate
`scalar_` prefix so a source record named `String` remains distinct.

## Ownership

Input structs borrow their child buffers. A completed output will own one
allocation arena at its root, with nested fields borrowing from that arena.
Generated clear helpers reset the root before releasing its owner. They never
follow the root's constructor tag or child pointers.

The executed cleanup test supplies an independently allocated test arena,
replaces the root's tag and recursive pointer with invalid values, and clears
the root twice. Its release function runs once, and the borrowed input stays
intact. This verifies the generated clear helper. The native output allocator
and Lean conversion path still need implementation and fault-injection tests.

## Checks

```sh
node --test tests/native-copied-graph-layout.test.mjs
```

All twenty-four contract tests pass. They include real C11/C++20 compilation and execution
with undefined-behavior sanitization, mutually recursive Option/Except/products,
900 transparent aliases, an 800-type recursive ring and a 700-type shared DAG.
The C and C++ compilers independently check that the large DAG's root struct
stays below 4 KiB. Negative tests reject alias cycles, identifier collisions,
unsupported constructors, mutable or borrowed signatures and identity types.

The contract test is registered in the repository's default test profile.
The [source-lineage record](recursive-npm-source-lineage-20260922.json) records
that registration change without rewriting historical installed receipts.

Next: bounded native argument validation, total typed Lean carrier conversion,
output arena allocation and failure cleanup, then installed C/C++ acceptance on
ordinary and independently reviewed source paths. The remaining native, Perl
and PHP-Wasm projections must execute their own installed recursive consumers
before their coverage cells change. Compound callable payloads and explicitly
owned identity aggregates remain part of the structured-types work.
