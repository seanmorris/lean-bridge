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

The initial codec tests use synthetic transport in real `WebAssembly.Memory`.
Compiled npm variants now have separate installed acceptance, described below.
Recursive descriptors and identity values remain open. Compiled npm aliases now
have separate installed acceptance, described below.

## Reproduce the focused checks

```sh
node --test tests/binding-ir-structured.test.mjs \
  tests/component-structured-codec.test.mjs \
  tests/component-copied-codec.test.mjs
```

The 35 tests cover all nineteen primitive payloads, independent copies, memory
growth, constructor ordinals through 1,023, independent hand-populated wire
values, limits, malformed descriptors/values, and every allocation failure in
a mixed nested input. Native-admission tests retain the adapter gate. At this
initial stage, installed coverage remained unchanged at inventory version 0.43.0.

The full contract run passes 1,521 tests with 62 gated integration skips. The
site passes 111 tests. Lint, repository/site type checks, generated-reference
checks and the production site build pass. Running the same cyclic-alias fixture
against the preceding commit reproduces its acceptance; the changed validator
rejects it with `alias-cycle`. Historical archive inventories are unchanged.

## Compiler-owned variant facts

The extractor now reads concrete, non-recursive variant constructors from Lean's
environment. Both metadata profiles preserve named constructors, their order,
field names and nested copied types. Native metadata also retains qualified
constructor names and the compiler-selected C representation. It does not use
those names as guessed runtime tags. Tests cover both a small scalar enum and
an object-valued payload variant.

Arrow-only fields receive stable positional names; generated names avoid
colliding with declared fields. The shared model rejects conflicting compiler
definitions with the same nominal identity. Independently written reviewed IR
must match every constructor and field in order. Reordering, renaming or changing
a field type fails reconciliation.

```sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
  node --test tests/compiler-variant-metadata.test.mjs
```

These checks compile fresh Lean interfaces and run the production extractor in
both profiles. Fixtures include all nineteen primitive payloads, empty cases,
Unit fields, unnamed fields, enums, records, nested variants, arrays, Lists,
options, results and products. Recursive, generic/indexed, proof-bearing,
dependent, callback-containing and reserved-field variants have rejection cases.
The uninhabited type also rejects. Schemas and semantic validators check the
reports before lowering them. CI runs this suite with compiler checks enabled.

The initial compiler stage resolved aliases to their targets. The later alias
stage preserves their identities. The native model still rejects compiled variant
signatures; npm has the separate installed checks below. The extraction tests
alone do not promote installed cells.

Validation for this compiler stage: three variant-metadata checks pass with
compiler execution enabled. The existing compiler-analysis and metadata suites
exercise 34 checks: 32 passed on the first run; two detected extractor edits
during execution or between relocation comparisons. Both passed when rerun
against the settled source. Full contracts pass 1,523 tests with 63 gated skips;
the site passes 111. Lint, repository/site type checks, generated references and
the production site build pass. All 54 nonempty historical artifact inventories
and the installed coverage matrix remain unchanged.

## Compiled npm variants

Private ABI 7 now compiles concrete non-recursive variants using typed Lean
constructors and projections. It authenticates named definitions, rejects old
runtimes and clears partially allocated tag-37 output. Plain JavaScript objects
use a `kind` discriminator; TypeScript receives readonly discriminated unions.

Both source paths pass installed Node, strict TypeScript, Chromium, Firefox and
WebKit page/React/worker checks. Each JavaScript context executes 2,363 checks
and 38 rejected calls with recovery. The fixtures cover all nineteen primitives,
empty constructors, single-constructor types, enums, direct record fields and
nested mixtures with the existing copied containers. Raw Wasm tests repeat
partial nested output cleanup 500 times. See the
[variant implementation and evidence](npm-variants-20260921.md).

This stage does not complete VO1219. Native/PHP-Wasm/WIT variants, bounded
recursion, compound callables and explicitly owned identity aggregates remain
in scope.

## Compiled npm aliases

Compiler extraction now preserves concrete copied aliases, their chains and
targets in both metadata profiles. Bare return types retain their names, and
independently reviewed IR must match alias definitions and references exactly.
An over-budget alias cannot fall back to a reduced scalar signature.

Both source paths pass installed Node, strict TypeScript and three browser-engine
page/React/worker checks: 3,613 checks and 44 rejected calls with recovery per
JavaScript context. Fixtures cover 28 aliases, all nineteen primitives, copied
records, variants and nested containers. See the
[alias implementation and evidence](npm-aliases-20260921.md).

Native private conversion helpers use the checked target representation while
Binding IR retains alias names. C/C++ and Python now have the installed checks below.
Installed alias acceptance and public declarations for the other nine consumer
profiles remain open. Generic aliases, bounded recursion, compound callables and
explicitly owned identity aggregates remain in the full structured-types goal.

## Compiled C/C++ aliases

C exposes `<prefix>_<snake_name>_t` typedefs and aggregate initialization/cleanup
helpers. C++ exposes source-named `using` declarations. Both reuse their target's
storage and conversion rules. Public-name collisions fail before packaging.

Independent ordinary-source and reviewed-IR builds each pass 720 C and 366 C++
checks through their prepared archives. The fixtures cover 27 aliases over all
nineteen primitives, chains, copied records and nested containers. Applications
repeat the same checks after installation relocation, with producer sources
removed and no compiler or loader-path override in their execution environment.
Package file hashes remain unchanged. See
[native alias implementation and evidence](native-aliases-20260921.md).

Native variants, the remaining profiles' aliases, bounded recursion, compound
callables and explicitly owned identity aggregates remain open.

## Compiled Python aliases

Python modules and stubs export 27 source-named `TypeAlias` declarations over
all nineteen primitives, chains, records and nested containers. Ordinary-source
and independently reviewed wheels each pass 4,460 checks before and after
installation relocation. Strict mypy checks accept the installed public API and
reject eight invalid examples. Producer sources are removed before offline
installation, consumer execution has no compiler on PATH, and installed files
retain their receipt hashes. See the
[Python alias implementation and evidence](python-aliases-20260921.md).

Alias parameters, results and fields now have installed acceptance in eight of
seventeen profiles. The other nine profiles, remaining variants, bounded
recursion, compound callables and explicitly owned identity aggregates remain
part of VO1219.
