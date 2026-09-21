# Structured types: remaining implementation and transport checks

VO1219 remains open. Copied Lists have [installed acceptance across all seventeen
consumer profiles](lists-acceptance-20260921.md). The remaining structured-type
work covers named aliases, user-defined tagged variants, bounded recursive copied
data, compound callback/closure payloads, and aggregates with explicit identity
ownership. The identity work also belongs to VO1221.

## Delivery stages

1. Validate named type graphs and add bounded variant transport. Preserve aliases,
   constructor identities and field names. Reject alias cycles without rejecting
   recursion through named records or variants.
2. Extract alias targets and variant constructors from Lean's elaborated
   environment. Authenticate independently reviewed IR against those facts.
   Generate typed Lean constructors, branch tests and projections rather than
   assuming runtime tags or object offsets.
3. Compile and install ordinary-source and reviewed-IR npm packages. Exercise
   Node, TypeScript, browsers, React and workers, including types nested in all
   existing copied containers and record fields.
4. Extend native C/C++ and the generated Python, Rust, .NET, JVM, Ruby, Perl,
   native PHP, PHP-Wasm and WIT/WASI adapters. Keep all seventeen profiles in the
   acceptance matrix. Verify prepared packages after removing producer sources
   and relocating their installed applications.
5. Add bounded recursive type graphs and finite recursive values. Separate type
   references from runtime value depth. Reject host/wire cycles, over-budget
   values and malformed branches; clear every partial output allocation.
6. Carry compound values through callback parameters/results and returned
   closures. Define ownership for identity-bearing aggregates with VO1221.
   Exercise retention, reentry, disposal, stale/wrong-runtime values and failure
   cleanup through installed APIs.

Each stage needs both source paths, exact primitive semantics, independent
expected values, invalid-input and boundary tests, CI wiring and current docs.
Promote type-matrix cells only from installed archive evidence. An intermediate
stage does not complete VO1219 or the full structured-types goal.

## Current transport implementation

The shared Binding IR validator rejects direct, mutual and container-hidden alias
cycles with a named cycle path. An explicit traversal stack handles a tested
10,000-alias chain. Shared acyclic expansions and recursion through named records
or variants remain valid. Ownership and unknown-reference checks still apply.

The copied codec snapshots expanded alias and variant descriptors. An alias
retains its name in the descriptor and delegates value conversion to its target.
Variants use `{ kind: "caseName", ...fields }`, with exact own data properties
for the selected constructor. Empty constructors remain distinct, and an explicit
Unit field differs from an absent field. The discriminator reserves `kind` as a
variant field name. Prototype-related field names remain rejected.

Variant slots use private tag 37 in the existing sixteen-byte slot layout. Bits
2 through 31 of the flags store the descriptor's constructor ordinal; bit 1
denotes native-owned child storage and bit 0 is reserved. These ordinals are
not Lean constructor tags. The child pointer/count describe only the active
constructor's fields. Alias nodes add no wire storage. Existing tags are unchanged.

Descriptors retain the 32-level and 4,096-node limits. A variant has between one
and 1,024 constructors, each with at most 1,024 fields. Copies retain the shared
16 MiB slot-and-payload budget. Accessors, sparse descriptors, duplicate names,
extra fields, coercions, invalid branches, counts and pointers fail validation.
Input allocations belong to the caller's arena even after partial failure.

These are synthetic transport tests in real `WebAssembly.Memory`, not compiled
Lean or installed-package acceptance. The current compiler ABI still rejects
aliases and arbitrary variants. Native output allocation/cleanup for tag 37,
versioned descriptor authentication and generated host declarations remain part
of compiler integration. Recursive descriptors and identity values are not yet
supported by this codec.

## Reproduce the focused checks

```sh
node --test tests/binding-ir-structured.test.mjs \
  tests/component-structured-codec.test.mjs \
  tests/component-copied-codec.test.mjs
```

The 35 tests cover all nineteen primitive payloads, independent copies, memory
growth, constructor ordinals through 1,023, independent hand-populated wire
values, limits, malformed descriptors/values, and every allocation failure in
a mixed nested input. Compiler-admission tests confirm that transport staging
does not enable unsupported package signatures. Installed coverage remains
unchanged at inventory version 0.43.0.

The full contract run passes 1,521 tests with 62 gated integration skips. The
site passes 111 tests. Lint, repository/site type checks, generated-reference
checks and the production site build pass. Running the same cyclic-alias fixture
against the preceding commit reproduces its acceptance; the changed validator
rejects it with `alias-cycle`. Historical archive inventories are unchanged.
