# Perl ownership runtime, value conversions and public XS calls

The private Perl ownership runtime executes freshly compiled Lean on Perl 5.36.3
and 5.38.2, with threaded and unthreaded builds of each interpreter. Both
ordinary-source analysis and independently reviewed IR pass the same checks.

This stage does not enable ownership-containing values in installed CPAN
packages. Package authentication, source registration and installed package
acceptance remain.

## Verified behavior

The generated declarations retain finite record, variant and recursive type
definitions, named fields, transparent aliases and distinct Some, Ok and Err
wrappers. The declaration fixture includes 41 types, 31 functions and eight
identity-bearing leaves. A separate scalar fixture covers declarations for all
19 primitive types. Real Perl constructor tests execute 57 assertions.

The XS runtime keeps native results behind private Perl MAGIC, registers
save-stack cleanup before acquiring owners, and publishes returned identities
only after construction succeeds. The tests check:

- Independent retained identities, idempotent close and finalizer cleanup.
- In-flight input pins that survive reentrant close.
- Expiration of callback-scope borrows and explicit retention from those scopes.
- Revocation of partially constructed outputs that escape before publication.
- Exact Perl exception objects and cleanup after reentry-limit failures.
- Rejection of forged identities, changed classes, fork children and cloned
  interpreter threads before native entry.
- Deferred shutdown while an input is in use, repeated shutdown and normal
  interpreter exit with live results.

Each compiler-path/ABI pair injects 13 XS allocation failures, 33 Perl exceptions
and 14 public C allocation failures. Every failure walk restores its baseline
ownership ledger. Final shutdown leaves zero tracked host allocations, native
allocations and broker identities. Instrumented library destructors check these
counts again at process exit.

Five separate consumer processes run for each of the eight compiler-path/ABI
pairs: normal operations, explicit shutdown, reentrant shutdown, rejected
serialization and interpreter-exit cleanup. These 40 processes execute 1,472
assertions. The tests compile and link the actual XS extension against each
interpreter's headers and ABI flags, with C warnings treated as errors.

The lifetime probe invokes callback scopes directly from XS and uses bounded
UInt64 ticket serials. Separate tests exercise large value conversions and
the public native Lean-to-Perl callback adapter below.

## Value converters

Finite readers and writers cover records, variants, recursive edges, arrays,
Lists, products, Option, Except, identity leaves and all 19 primitives. The C
compiler checks both the 41-type composition fixture and 26-type scalar fixture
against their generated public headers on all four Perl ABIs. This is eight
compile checks, not an execution claim for every type composition.

Eight additional consumer processes execute the converters against the freshly
compiled ordinary and reviewed components. Each process passes 347 checks,
including a 521-bit Nat interpreted by Lean, a negative Int in a nested record,
independent retained resource leaves, optional resources, arrays, Lists,
recursive branches, Unicode, embedded NUL and raw octets. Malformed records,
cycles and excess depth are rejected. Each run exercises 24 host allocator
failures, 101 Perl exceptions and 33 native allocator failures. Every fault walk
restores the ownership ledger; shutdown leaves zero tracked allocations and
broker identities.

These conversion checks use private generated probe entrypoints.

## Public calls and native callbacks

The XS generator emits every declared function, closure invocation and resource
lifecycle method. Perl code references become call-scoped host callbacks.
Signatures that need a typed recovery value accept a generated
`Runtime::Callback` containing `code` and `recovery` fields. Generated C
converters validate the recovery against the callback's result type.

Each of eight additional consumer processes passes 758 checks against ordinary
or independently reviewed Lean. They exercise native callbacks with owned and
recursive records, multiple and nested calls, returned closures, expired host
callbacks, explicit retention, typed recovery, foreign invocation of private
converters, and exact false-looking exception objects without stringification.
Returned resource leaves remain independently usable after sibling closure.

Borrowed callback arguments expire at callback return. Reply values are copied
into a native owner before Perl temporaries unwind, and the native caller
releases that owner on success and failure. Each execution walks 51 XS allocation
failures, 206 Perl exceptions and 101 native allocation failures. Every failure
restores the baseline ownership ledger; final host/native allocations and broker
identities are zero.

Sixteen additional XS/header checks compile all four fixture families on all
four Perl ABIs, including higher-order and all nineteen primitive callback
signatures. Installed CPAN acceptance remains separate.

## Complete callback and composition fixture

A second compiled fixture contains 51 exports. On both authoring paths and all
four Perl ABIs, an additional consumer executes all 51 through the generated
public API. Each process passes 114 checks, including every primitive callback
type, higher-order borrowed functions, explicit function retention, returned
multi-argument closures and returned closures that accept Perl callbacks.

The same run covers every Choice constructor, empty containers, aliases,
recursive optional links, nested Array/List/Option/Except values, mixed records,
Unicode, NUL, UInt64 maximum and signed integer minima. None, Some(None),
Some(Some(false)) and Some Unit retain their distinct meanings. Each final
ownership ledger is zero.

This larger fixture also repeats the lifetime, conversion and public-call fault
walks above. Its source-bound reports use `complete-ordinary.json` and
`complete-reviewed.json` in the same three report directories.

## Scalar records and boundaries

The scalar fixture executes all eight public exports through generated XS on
both authoring paths and all four Perl ABIs. Each consumer passes 667 checks.
Lean inspects all 19 primitive fields in a resource-bearing record, including
4096-bit integers, Unicode scalar boundaries, embedded NUL, empty containers,
and distinct nested Option and Unit values. Float32 and Float64 checks cover
signed zero, subnormals, infinities and NaN payloads. Lean's bit conversion
canonicalizes NaN; the round-trip export preserves the original payload.

Malformed fields, integer overflow, invalid Unicode, wrong wrapper types and
oversized containers fail before a result is published. Every process exercises
39 XS allocation failures, 168 Perl exception checkpoints and 31 native
allocation failures. The failure walks restore their baseline ledgers; final
host and native allocations and broker identities are zero.

## Serialization reference retention

On all four tested interpreters, Storable retains one reference when an object's
serialization hook throws. A plain Perl object with a throwing hook reproduces
the same behavior without Lean or XS. The serialization process compares both
objects, verifies that rejection leaves the Lean identity usable, then checks
that explicit close and shutdown release native ownership despite Storable's
reference. Library destructors verify host cleanup at interpreter exit.

## Reproduce

```sh
source scripts/env.sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test \
  tests/owned-perl-runtime.test.mjs tests/owned-perl-values.test.mjs \
  tests/owned-perl-conversions.test.mjs tests/owned-perl-xs.test.mjs \
  tests/owned-perl-scalars.test.mjs
```

The default interpreter matrix uses the four pinned Perl installations under
`.toolchains/perl/`. `LEAN_BRIDGE_PERLS` selects an explicit JSON array of
interpreter paths. Reports are written to
`build/owned-perl-runtime/ordinary.json` and
`build/owned-perl-runtime/reviewed.json`, with source identities and generated
runtime, XS and consumer hashes. Conversion reports are in
`build/owned-perl-conversions/{ordinary,reviewed}.json`; public XS execution
reports are in `build/owned-perl-calls/{ordinary,reviewed}.json`; scalar reports
are in `build/owned-perl-scalars/{ordinary,reviewed}.json`. The completed local
run passed all fourteen tests with no skips. These reports bind local native
executions, not installed archive receipts.
