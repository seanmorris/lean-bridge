# Installed Perl tagged variants, 21 September 2026

Prepared CPAN archives expose each copied Lean variant as a named Perl family
with a constructor class for each case. Constructors accept named fields and
provide payload accessors. Callers use no native tags or object layouts.

The [machine record](perl-variants-20260921.json) binds the original archives,
installed files, public consumers and isolated XS probes to their hashes. It
covers Perl 5.36.3 and 5.38.2, each threaded and unthreaded, on Linux x86-64.
Local acceptance uses the existing test-only glibc 2.36 floor. The normal CPAN
release profile keeps its glibc 2.38 requirement.

## Installed checks

Ordinary-source and independently reviewed Binding IR builds each export
fourteen functions across seven variant families and eighteen constructors.
Each of the eight executions passes 53,680 public assertions over 4,226 calls,
including 116 rejected inputs followed by successful recovery.

The handwritten consumer checks every constructor and all nineteen primitive
payload types. Cases include nested variants, records, arrays, Lists, options,
results and products; 5,121-bit integers; Unicode and embedded NULs; binary
strings; floating-point special values and signed zero; and empty constructors
distinct from `undef` Unit payloads. Eighteen changed-field negatives check
scalar meaning against a separate Lean inspector. Public reflection checks the
constructor catalog, payload accessors and exported functions.

Consumers install the original runtime and component archives offline after
the author project is removed. Installation requires a prepared XS binary for
the selected Perl ABI and has no compiler available. Consumers relocate the
installation, remove the archive handoff, then execute twice with invalid
Lean/C tool locations and no compiler on PATH. All twenty-four installed files
retain their hashes, including five loaded native libraries and both install
receipts. The installed API matches the archived source, and Pod::Checker
validates its embedded documentation.

Independent builds reproduce the original archives and all installed package
payloads. The two `.packlist` files and `perllocal.pod` differ between independent
installations because Perl records local installation paths and timestamps.
The record identifies those three files separately; each installation keeps
their bytes unchanged through relocation and execution.

The shared runtime archive has SHA-256
`ccd8387c1e2063d89b0ea892354e99456dd7ba18c1dbfadbe58f608b10ef351f`.
The ordinary-source component has SHA-256
`59b9b65d0b95f125ab8a1fa4de69bc2d664841868380771192db90cfc821e951`;
the reviewed-IR component has SHA-256
`6c6f2f2af0c0c1813c277a755ad559f750b6c932fc65c6b193f431f65ce30551`.
Each archive includes all four pinned Perl ABIs. These are local acceptance
packages, not CPAN publications.

## Failure and ownership checks

A separate process loads an isolated XS probe compiled from verified archive
sources. The probe never replaces the installed release libraries. It exercises
all eighteen constructors and recovers from 494 injected conversion failures.
Sixty-four partial-input failures reject before entering Lean. Four exceptions
from `Math::BigInt` input/output conversion preserve the original Perl error
object. Seven invalid helper tags reject before any payload accessor runs.

Three reentrant cases delete input fields, rebless the input object, or delete a
pending field from a tied scalar getter. Input slots remain pinned across those
callbacks. The probe checks 1,132 active payload reads without a wrong-constructor
access. Its 572 cleanup checks account for injected failures, partial inputs,
host exceptions, malformed tags and reentrant calls. Tracked scopes, callbacks
and wrappers return to their expected counts, and uninstrumented public calls
succeed afterward. These checks cover scoped native ownership, not every Perl
heap allocation. This Perl milestone does not claim a new sanitizer run.

## Value semantics

Callers construct a named case, not the family itself. Constructors reject
missing, extra and duplicate fields. Calls require the exact generated class
and field set, rejecting unknown subclasses and tied or magical hashes.
Payload types retain their existing checks. Integer inputs follow Perl's
existing integer adapter, which admits native Boolean scalars as 0 or 1.

Constructor hashes and contained arrays remain mutable. Returned payloads have
independent copied storage. Perl reference equality does not compare payload
contents, and Perl does not check branch exhaustiveness. Public field names
cannot replace Perl object methods or phase hooks such as `BEGIN` and `END`.

Only concrete, non-recursive copied variants are admitted. Generic, indexed,
proof-bearing, callable and identity-bearing payloads remain outside this
profile. The existing 32-level schema limit and shared 16 MiB per-call copy
budget do not bound all Perl allocations or Lean working memory. An
alias-to-variant generator check is separate from this installed fixture.

## Reproduce

Install the repository's pinned native and Perl tools, then run:

```sh
source scripts/env.sh
export LEAN_BRIDGE_PERLS='["/app/.toolchains/perl/5.36.3-threaded/bin/perl","/app/.toolchains/perl/5.36.3-unthreaded/bin/perl","/app/.toolchains/perl/5.38.2-threaded/bin/perl","/app/.toolchains/perl/5.38.2-unthreaded/bin/perl"]'
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_PERL_VARIANT_TEST=1 node --test tests/perl-variants.test.mjs
node --test tests/perl-variant-contract.test.mjs tests/perl-variant-evidence.test.mjs
```

Adjust the interpreter paths to your checkout. Omit the test-only floor override
on a host that meets the normal release requirement. The installed test writes
`build/variants/perl.json`. Each Perl CI matrix job requires and uploads its
selected ABI's report. This milestone promotes six copied-variant cells across
both source paths. Native PHP, PHP-Wasm and WIT variants remain next, followed
by bounded recursion, compound callables and explicitly owned identity
aggregates.
