# Perl closed value-index checked records

This promotion records four installed Perl CPAN selections from GitHub Actions
run `39349265084`, artifact `12232698994`. The immutable
[archive](checked-record-value-index-perl-20261019/index.json) authenticates
ordinary Lean source and independently reviewed Binding IR, with full and
standalone result-only APIs.

The full API covers top-level copied checked-record parameters and results. The
result-only API covers results only. All routes reproduce complete component
and runtime archives from two author roots, remove author roots, install
offline, relocate the installation, and replay unchanged callers through both
prebuilt-only and build-XS delivery.

The run covers Perl 5.36.3 and 5.38.2, each threaded and unthreaded, on Ubuntu
24.04 with Linux x64/glibc 2.39 and a glibc 2.38 package floor. Each selection
has sixteen installed executions: four interpreter ABIs, two delivery modes,
and calls before and after relocation.

The fixture covers closed `Bool`, `String`, and `Nat` indices: both booleans,
the empty and Unicode strings, zero, and a Nat wider than 64 bits. The generated
records expose payload fields only; `Math::BigInt` represents Nat payloads.
Negative Nat inputs and invalid checked records fail without changing caller
data, and a later valid call succeeds. Proof fields never cross the Perl
boundary.

This promotion covers only the four named top-level cells. It does not promote
fields, callbacks, owned values, open or opaque indices, other index kinds,
generic or zero-payload records, or broader dependent payloads.
