# Finite graphs for recursive copied values

VO 1219, 2026-09-22. This is transport implementation evidence, not installed
Lean-package acceptance. [Fresh Lean extraction now retains recursive type
graphs](recursive-copied-metadata-20260922.md); compiled recursive adapters and
installed-package acceptance remain open. The consumer coverage inventory is
unchanged.

## Implemented

[`component-recursive.mjs`](../../src/abi/component-recursive.mjs) snapshots a
closed graph of nominal records, variants and aliases. Fields contain primitive,
applied or named references. Recursive references do not expand definitions.
The snapshot preserves field order, constructor order, alias targets and nominal
identities. It rejects unknown references, duplicate names, sparse tables,
accessors, JavaScript descriptor cycles and identity-bearing types.

Alias cycles are invalid even through containers. Recursion through a named
record or variant is valid. The graph can represent mutually recursive types,
including an alias for a List of a variant containing that alias.

[`component-recursive-types.mjs`](../../src/build/component-recursive-types.mjs)
projects validated Binding IR into this graph and compares descriptors against
the public definitions without unfolding them. It rejects changed roots, alias
targets, fields, constructors and primitive types. This comparison does not
replace fresh compiler authentication of the public IR.

[`component-recursive-codec.mjs`](../../src/release/component-recursive-codec.mjs)
encodes and decodes copied values using explicit work stacks. It reuses the
nineteen primitive slot codecs and existing container tags. Nominal references
and aliases add no runtime wrapper. Shared host subtrees produce separate copies;
cycles through ancestors reject. The decoder detects wire cycles and validates
tags, flags, branches, counts and buffer bounds.

## Limits and ownership

| Limit | Bound |
|---|---:|
| Inline descriptor nesting | 32 edges |
| Descriptor nodes, including references, definitions and cases | 4,096 |
| Nominal definitions | 1,024 |
| Fields per record or constructor; constructors per variant | 1,024 |
| Runtime value nesting, with the root at depth zero | 128 edges |
| Runtime value slots per shared call budget | 262,144 |
| Copied slots and scalar payloads per shared call budget | 16 MiB |

The caller can lower byte and node limits. The codec rejects forged budget
objects. It reserves immediate child slots before allocating their transport or
host containers. Every occurrence of a shared subtree counts separately.
An argument and its result can share the same budget.

These are transport accounting limits, not a bound on every JavaScript or Lean
allocation. Input allocations belong to the caller's arena, including after
validation or allocation failure. The codec does not free native output or
establish a native allocation's ownership from an address alone.

## Checks

The recursive cases extend the existing
[`component-structured-codec` contract suite](../../tests/component-structured-codec.test.mjs).
They use real `WebAssembly.Memory`, including growth during allocation. They
cover mutual recursion, all scalar types, every supported container, nested
Option Unit distinctions, alias chains, shared subtrees, independent returned
buffers, exact depth and node boundaries, cyclic host/wire values, malformed
branches and failure recovery. Raw slots populated without the writer check the
decoder independently. Allocation-failure injection covers every allocation in
the mixed recursive fixture and verifies arena cleanup before reuse.

Run the focused checks:

```sh
node --test tests/component-structured-codec.test.mjs \
  tests/component-copied-codec.test.mjs \
  tests/component-record-contract.test.mjs \
  tests/component-variant-contract.test.mjs \
  tests/binding-ir-structured.test.mjs
```

## Remaining integration

1. Generate typed Lean constructors and projections without requiring the first
   constructor of a recursive variant to have a finite default value.
2. Add versioned native validation, conversion and partial-output cleanup with
   matching depth, node and allocation limits. Validate ownership before cleanup;
   malformed native output must retire the shared runtime.
3. Connect the npm compiler, package and runtime paths. Run ordinary-source and
   reviewed installed archives in Node, TypeScript and every browser profile.
4. Extend installed acceptance to the remaining consumer targets. Compound
   callable payloads and explicitly owned resource aggregates remain separate
   required work under VO 1219 and VO 1221.
