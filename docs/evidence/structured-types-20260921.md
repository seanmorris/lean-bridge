# Structured types: remaining implementation and transport checks

VO1219 remains open. Copied Lists have [installed acceptance across all seventeen
consumer profiles](lists-acceptance-20260921.md). The remaining structured-type
work covers recursive copied data in the remaining eight consumer profiles,
compound callback/closure payloads, and aggregates with explicit identity
ownership. Copied aliases and tagged variants have installed acceptance across
all seventeen profiles. [Recursive npm values](npm-recursive-20260922.md) have
installed acceptance across the five npm profiles. [C/C++ recursive packages](native-recursive-packages-20260923.md)
pass both source paths. [Rust/Cargo](rust-recursive-packages-20260923.md) and
[Python wheels](python-recursive-packages-20260923.md) also have installed
recursive acceptance. Ruby, Perl, C#, Java, Kotlin, native PHP, PHP-Wasm and
WIT/WASI still need recursive installed support. The identity work also belongs
to VO1221.

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
options, results and products. Generic/indexed, proof-bearing, dependent,
callback-containing and reserved-field variants have rejection cases. Recursive
and uninhabited types now lower through finite graphs and total carriers.
Schemas and semantic validators check the
reports before lowering them. CI runs this suite with compiler checks enabled.

The initial compiler stage resolved aliases to their targets. The later alias
stage preserves their identities. npm and C++ have separate installed variant
checks below. The extraction tests alone do not promote installed cells.

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
Binding IR retains alias names. C/C++, Python, Rust, .NET, Java/Kotlin, Ruby,
Perl, native PHP, PHP-Wasm and WIT/WASI now have the installed checks below.
Generic aliases, bounded recursion,
compound callables and explicitly owned identity aggregates remain in the full
structured-types goal.

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

## Compiled Rust aliases

Cargo crates export 27 public `type` declarations, retaining chains, compound
targets and record fields. Strings and sequences keep borrowed `str` and slice
inputs; other aggregates borrow their named type. Alias values reuse the
target's ownership and validation without newtype wrappers.

Ordinary-source and independently reviewed crates each pass 1,278 public checks,
twelve compiler rejection cases and 202 injected error/panic cleanup cases.
Consumers compile offline with a link-only C driver and no producer files.
The executable runs twice more after relocation and removal of installed crate
sources. Only six Rust alias cells gain installed evidence. See the
[Rust alias implementation and evidence](rust-aliases-20260921.md).

## Compiled .NET aliases

NuGet packages preserve 27 copied aliases through installed manifest entries
and XML API documentation. C# signatures use ordinary CLR target types;
source-file aliases cannot be exported from an assembly. Alias metadata retains
the original names, targets and chains without wrapper identities or injected
`global using` directives.

Both source paths pass 3,876 public checks, twelve compiler rejection cases,
180 injected conversion failures, seventeen malformed native-value checks and
64 partial-input failures. Each consumer repeats after relocation with only a
.NET runtime, no SDK or producer sources. See the
[.NET alias implementation and evidence](dotnet-aliases-20260921.md).

## Compiled Java and Kotlin aliases

Prepared Maven packages preserve 27 copied alias names, targets and chains in
their binding manifest and generated Java source documentation. Both languages
use the same Java API with ordinary target values. The profile adds no wrapper
classes or separate Kotlin typealias declarations.

Both source paths pass 3,711 checks per language, twelve compiler rejection
programs per language, 237 injected conversion failures, eighteen malformed
native-value checks and 64 partial-input failures. Consumers install offline
after producer removal and run twice after relocation using only a private JVM.
See the [Java/Kotlin alias evidence](jvm-aliases-20260921.md).

## Compiled Ruby aliases

Prepared gems preserve 27 copied aliases in installed metadata and public API
comments, retaining original names, targets, chains and record-field types.
Ruby callers use ordinary target values, with no separate alias constants or
wrapper classes. Nat, integer ranges, Unit and Unicode checks remain enforced.

Both source paths pass 4,509 public assertions, 317 injected conversion failures,
22 malformed-native-value checks and 64 partial-input failures. Each installed
consumer runs twice after gem relocation and producer removal without compilers.
See the [Ruby alias evidence](ruby-aliases-20260921.md).

## Compiled Perl aliases

Prepared CPAN archives preserve 27 alias names, original targets and chains in
metadata and installed POD. Parameters, results and record fields retain their
original contract names. Callers use target values, with no extra packages or
wrapper classes. The generated XS conversion code remains unchanged.

Both source paths pass on all four pinned Perl ABIs. Each combination runs
11,732 public assertions twice after offline installation, relocation and
producer removal. A separate instrumented XS process exercises 506 injected
conversion failures, 64 partial-input failures and four host exceptions while
leaving installed files unchanged. See the
[Perl alias evidence](perl-aliases-20260921.md).

## Compiled native PHP aliases

Prepared Composer archives preserve 27 alias names, original targets and chains
in metadata and installed PHPDoc. PHP callers pass ordinary target values.
Parameters, results and record fields retain their original contracts without
alias wrapper classes. The public generator routes these APIs through the
copied adapter, and package audits check alias metadata against source types.

Both source paths pass 12,532 public assertions in weak and strict caller modes
after offline installation, relocation and producer removal. An isolated
in-memory probe covers 567 injected conversion failures, 64 partial-input
failures and fifteen malformed native outputs. Installed files remain unchanged.
See the [native PHP alias evidence](php-native-aliases-20260921.md).

## Compiled PHP-Wasm aliases

Prepared npm and Composer packages preserve 27 copied alias names, targets and
chains in manifests, installed catalogs and public PHPDoc. Callers use wasm32
target values without wrapper classes. The descriptor mounts the catalog with
embedded declarations; Composer installations carry identical catalog bytes.

Both source paths pass 12,544 public assertions in each of twelve Node/Chromium,
startup/lazy, embedded/Composer and weak/strict arrangements, repeated after
relocation and producer removal. A separate synthetic Zend provider checks
alias-wrapped cleanup, malformed outputs and bailout recovery. See the
[PHP-Wasm alias evidence](php-wasm-aliases-20260921.md).

## Compiled WIT/WASI aliases

Prepared archives retain 27 source aliases in the text WIT, compiled component,
binding manifest and README. API sites and record fields keep their original
named references. An independent decoder rejects flattened chains; the native
value conversion source remains unchanged.

Both source paths pass 409,138 assertions and 43 rejection/recovery cases in
each of two relocated, compiler-free executions. A separate sanitizer probe
checks alias-wrapped conversion failures and cleanup. See the
[WIT/WASI alias evidence](wit-aliases-20260921.md).

Alias parameters, results and fields now have installed acceptance in all
seventeen profiles, covering 102 cells across both source paths. Native
variants, bounded recursion, compound callables and explicitly owned identity
aggregates also remain part of VO1219.

## Compiled C++ variants

Prepared C++20 archives expose named constructor structs through `std::variant`.
Typed Lean helpers construct and inspect values without exposing compiler tags
or field offsets. Both source paths pass 36,091 assertions in each of two
relocated executions after producer and handoff removal. The checks cover
eighteen constructors, all nineteen primitive payloads, nested copied values
and allocation-failure cleanup.

A separate native probe verifies active-branch validation and cleanup, invalid
tags and unchanged output slots. Address and undefined-behavior sanitizers pass;
the leak report matches the startup-only GMP baseline. See the
[C++ variant evidence](cpp-variants-20260921.md).

C/GMP, the other native hosts, PHP-Wasm and WIT still need their variant
projections. Bounded recursive values, compound callables and explicitly owned
identity aggregates remain open.

## Compiled C and C/GMP variants

Prepared C11 archives now expose named constructor tags, payload unions and
active-case `_init`, `_select` and `_clear` functions. Typed Lean helpers retain
the compiler-independent conversion used by C++.

Both ordinary-source and reviewed-IR GMP packages pass 46,234 assertions per
execution, covering all nineteen primitive payloads, eighteen constructors and
nested copied values. Plain C archives without GMP pass 1,815 assertions on each
source path. Each installation runs twice after producer removal and relocation.

The native and public GMP probes exercise 242 and 448 allocation failures,
respectively. They check partial cleanup, preservation of existing output values
on failure and release of old owned values on success. Sanitizer reports match
the startup-only runtime baseline. See the [C variant evidence](c-variants-20260921.md).

Tagged variant acceptance now covers the five npm profiles, C++ and C. Ten
profiles still need variant projections. Bounded recursion, compound callable
payloads and explicitly owned identity aggregates remain part of VO1219.

## Compiled Python variants

Prepared Python wheels now expose named frozen constructor dataclasses and
precise union annotations. Both source paths pass 26,434 public assertions over
4,383 calls per execution, with sixty-four rejected inputs and recovery. The
fourteen-export fixture covers all eighteen constructors and nineteen primitive
payload types, including mixed copied containers and records. Installed wheels
run twice after relocation and handoff removal. Strict mypy checks pass the
valid program and reject eight invalid uses.

Separate Python probes exercise eighteen buffer-allocation failures, fifty-eight
result-conversion failures and invalid native tags. They verify output cleanup
and scratch release. The real-Lean native probes also pass, with unchanged
startup-only sanitizer baselines. See the [Python variant evidence](python-variants-20260921.md).

Tagged variants now have installed acceptance on eight of seventeen consumer
profiles. The remaining nine profiles, bounded recursion, compound callable
payloads and explicitly owned identity aggregates remain assigned work.

## Compiled Rust variants

Prepared Cargo crates now expose named Rust enums. Unit cases and named payload
cases retain constructor identity; inputs borrow their enum and outputs own
independent copies. Both source paths pass 4,936 public assertions over 4,274
calls per execution, plus eight intended compile-time rejections. Offline
consumers compile with Rust and link-only C access, then run twice more after
relocation and removal of installed sources, dependencies and archive handoff.
Independent rebuilds reproduce both original crates and all installed files.

Private probes recover from 208 injected errors and unwinding panics, reject
seven invalid tags before accessing their payloads and ignore six poisoned
inactive cases. Scoped owners return to zero and native output clears run once
per failed call. Shared native sanitizer probes retain their startup-only GMP
baseline. See the [Rust variant evidence](rust-variants-20260921.md).

Nine of seventeen profiles now have installed tagged-variant acceptance. The
remaining eight profiles, bounded recursive values, compound callable payloads
and explicitly owned identity aggregates remain assigned work.

## Compiled .NET variants

Prepared NuGet packages now expose an abstract C# record and sealed named cases
with typed payloads. Both source paths pass 209,519 public assertions per
execution and eight intended compiler rejections. The author is removed before
offline installation. Each published consumer runs twice more after its source,
package cache and handoff are removed, using only the .NET runtime. Independent
rebuilds reproduce both original archives and every installed package file.

Private probes recover from 152 conversion/allocation failures, reject sixty-four
partial inputs before entering Lean, reject seven invalid native tags and ignore
six poisoned inactive cases. The original release assembly remains unchanged.
Shared native probes retain their startup-only GMP sanitizer baseline. See the
[.NET variant evidence](dotnet-variants-20260921.md) for copied-array semantics,
unknown derived-case rejection and exact installed identities.

Ten of seventeen profiles now have installed tagged-variant acceptance. Java,
Kotlin, Ruby, Perl, native PHP, PHP-Wasm and WIT/WASI remain. Bounded recursive
values, compound callable payloads and explicitly owned identity aggregates
remain assigned work.

## Compiled Java and Kotlin variants

Prepared Maven packages now expose sealed Java interfaces with named constructor
records, usable directly from Java and Kotlin. Both source paths pass 209,998
public assertions over 4,331 calls per execution, thirty-three rejected inputs
and ten intended compiler rejections per language. Consumers install offline
after author removal and run twice more after source and handoff removal using
only `java.base`. Independent rebuilds reproduce both original JARs and POMs,
generated sources and every installed file.

Separate probes recover from 212 conversion/allocation failures and sixty-four
partial-input failures, reject seven malformed tags and ignore six poisoned
inactive cases. Scoped arenas close and original release JARs remain unchanged.
Shared native probes retain the startup-only GMP sanitizer baseline. See the
[Java/Kotlin variant record](jvm-variants-20260921.md) for copied-array semantics,
constructor naming and exact installed identities.

Twelve of seventeen profiles now have installed tagged-variant acceptance. Ruby,
Perl, native PHP, PHP-Wasm and WIT/WASI remain. Bounded recursive values, compound
callable payloads and explicitly owned identity aggregates remain assigned work.

## Compiled Ruby variants

Prepared gems now expose named constructor families with required keyword
payloads and Ruby pattern matching. Both source paths pass 35,904 public
assertions over 4,410 calls per execution, including eighty-one rejected inputs
with recovery. Original gems install offline after author removal, relocate and
run twice without compiler access after archive handoff and gem-cache removal.
Independent rebuilds reproduce both gems and all twenty-four installed files.

Separate in-memory probes recover from 315 conversion, allocation and constructor
failures and sixty-four partial-input rejections. Seven malformed native tags
reject before payload reads, and six cases ignore poisoned inactive storage.
Scoped native buffers are released and installed gem files stay unchanged. The
shared native probes retain the startup-only GMP sanitizer baseline. See the
[Ruby variant record](ruby-variants-20260921.md) for exact-class validation,
copied payload semantics and installed identities.

Thirteen of seventeen profiles now have installed tagged-variant acceptance.
Perl, native PHP, PHP-Wasm and WIT/WASI remain. Bounded recursive values, compound
callable payloads and explicitly owned identity aggregates remain assigned work.

## Compiled Perl variants

Prepared CPAN archives expose named constructor classes with keyword payloads.
Both source paths pass 53,680 public assertions over 4,226 calls per execution,
including 116 rejected inputs with recovery, on all four pinned Perl ABIs.
Original runtime/component archives install offline after author removal,
relocate and run twice without compiler access after handoff removal.
Independent builds reproduce the archives and installed package payloads;
Perl's path- and timestamp-bearing installation metadata is recorded separately.

Isolated compiled XS probes exercise all eighteen constructors, recover from
494 injected conversion failures and sixty-four partial-input rejections, and
preserve four host exceptions. Seven malformed tags reject before accessors.
Three reentrant field mutations check input pinning, and 1,132 payload reads
use the correct constructor. Installed files remain unchanged. See the
[Perl variant record](perl-variants-20260921.md) for exact-class validation,
mutable payload semantics, cleanup checks and installed identities.

Fourteen of seventeen profiles now have installed tagged-variant acceptance.
Native PHP, PHP-Wasm and WIT/WASI remain. Bounded recursive values, compound
callable payloads and explicitly owned identity aggregates remain assigned work.

## Compiled native PHP variants

Native Composer packages now expose abstract readonly variant families and
final readonly constructor classes with original payload names. Both source
paths pass 37,686 public assertions over 4,460 calls per weak or strict caller,
covering seven families, eighteen constructors and all nineteen primitives.
The original archives install offline, relocate after author removal and run
without compilers. Independent rebuilds reproduce both ZIPs and all twenty-five
package-owned files; all sixty-seven deployment files remain unchanged during
each execution.

Separate in-memory probes recover from 460 injected exceptions and sixty-four
partial-input failures, check two native-budget failures, reject seven invalid
tags and five malformed payloads, and ignore six poisoned inactive cases.
Public callers run again after the probe. Shared native allocation and
sanitizer checks retain the unchanged startup-only baseline. See the
[native PHP variant record](php-native-variants-20260921.md).

Fifteen of seventeen profiles now have installed tagged-variant acceptance.
PHP-Wasm and WIT/WASI variants remain, followed by bounded recursion, compound
callable payloads, explicit identity-aggregate ownership and the older reviewed
array/record audit. This milestone does not complete the structured-type goal.
