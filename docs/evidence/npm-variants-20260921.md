# Compiled npm tagged variants, 21 September 2026

VO1219 adds copied, concrete, non-recursive inductive sums to npm packages.
Both ordinary Lean source and independently reviewed Binding IR use fresh
compiler facts for constructor names, order, field names and field types.

JavaScript values use `{ kind: "caseName", ...fields }`. TypeScript exposes a
named readonly discriminated union. Empty cases retain distinct names, and a
Unit field requires an own property whose value is `undefined`. Plain objects
and null-prototype objects are accepted. Extra properties, symbol properties,
inherited fields, getters, unknown constructors and malformed payloads reject.

Private ABI 7 authenticates a closed named-type table against the public IR.
Typed Lean constructors, branch tests and projections use one-element Array
carriers. C does not assume a constructor's runtime representation. This covers
scalar enums, single-constructor inductives and object-valued payload variants.
Existing ABI 2 through 6 packages keep their descriptors and wire layouts.
Package preparation and loading reject runtimes without the new helpers.

Calls retain the 16 MiB shared input/result transport budget, 32-level depth
bound and 4,096-node descriptor bound. Variants allow up to 1,024 constructors,
each with at most 1,024 fields. Native output allocation uses zeroed child tables;
cleanup traverses owned tag-37 children, including partially encoded results.
Budget failures recover. Traps and malformed output retire the runtime.

## Installed checks

```sh
PLAYWRIGHT_BROWSERS_PATH=/app/.toolchains/playwright \
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
node --test tests/component-variants.test.mjs
node --test tests/component-variant-runtime.test.mjs \
  tests/component-variant-contract.test.mjs
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
node --test tests/compiler-variant-metadata.test.mjs
```

The [recorded packages](npm-variants-20260921.json) install offline after producer
relocation, with compilers absent from the consumer PATH. Both paths execute in
Node, strict TypeScript, and Chromium, Firefox and WebKit pages, React and workers.
Fixtures cover all nineteen primitives, 5,121-bit integers, Unicode/NUL, signed
zero, NaN, infinities, constructor changes, anonymous fields, direct record fields
and mixtures with arrays, Lists, options, results and nested products. Lean also
inspects payload contents independently of the transport. Returned byte buffers
and nested objects are independent copies. Invalid calls and repeated oversized
results must leave the next valid call usable.

Raw Wasm tests cover constructor ordinals through 1,023, ownership bits,
malformed spans, constructor/field limits, budgets and 500 repetitions of partial
nested-result cleanup. Contract checks authenticate descriptor changes and
reject host getters before reading them. ABI versions require exact numbers;
strings, big integers and objects with coercion hooks reject without conversion.

The fixture exposed an existing reproducibility defect: Lean retained an absolute
source filename in its interface. Analysis and target compilation now pass the
same module-relative filename. Four fresh builds in different directories, with
and without C output, must produce identical interface hashes. The strict
analysis-to-compilation identity check remains enabled.

Named alias preservation, native/PHP-Wasm/WIT variants, recursive schemas,
generic/indexed variants, compound callables and identity-bearing aggregates
remain open. No alias or callback coverage is promoted by these variant checks.
