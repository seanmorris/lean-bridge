# Installed Perl copied aliases, 21 September 2026

Prepared CPAN archives preserve 27 copied alias names, original targets and
chains in their binding manifest. Installed POD documents the alias catalog
and original parameter, result and record-field types. Perl callers use ordinary
target values; aliases add no packages or wrapper classes. XS conversion code
is unchanged.

## Installed validation

Ordinary-source and independently reviewed builds compile the unchanged shared
native alias fixture. Before packaging, the test compares every alias target,
record field and exported signature with the independently written review.

All eight combinations of source path and Perl ABI pass 11,732 public assertions
per execution. Each consumer runs twice after installation relocation. The ABI
matrix is Perl 5.36.3 and 5.38.2, each threaded and unthreaded, on x86-64 Linux.
These versions define the acceptance matrix, not a production support policy.

The consumer covers all nineteen primitives, exact 5,121-bit integers,
fixed-width and machine-word limits, Float32 rounding, signed zero, subnormals,
infinities, NaN classification, Unicode and embedded NUL. Lean independently
checks all nineteen scalar record fields; changing any non-Unit field fails
that check. Aliases retain chains, return-only types, nested Lists and arrays,
record fields, three nested Option Unit states and both Result branches.

Mutation and weak-reference checks verify independent input and result storage.
Nat requires nonnegative `Math::BigInt`; Int accepts negative values. Unit uses
`undef`. Integer aliases retain the existing integer-scalar checks, including
native Perl booleans as 0 or 1. Invalid scalar types, ranges, Unicode, sparse
Lists, tied Lists, malformed branches, products and cyclic inputs reject.
Over-budget inputs and results fail, then subsequent calls succeed.

The test removes each producer project before installing its exact archives
offline in `prebuilt-only` mode. It relocates all four installations, removes
the archive handoff, then executes public consumers without compilers or
runtime-path overrides. All five loaded package libraries match their receipts.
Installed-file hashes remain unchanged. Interpreted Perl modules and the
runtime's native headers remain installed.

Independent rebuilds reproduce both component archives, their shared runtime
archive and the isolated probe binaries byte-for-byte. Package-owned installed
files also match. Perl's `.packlist` and `perllocal.pod` records contain local
installation paths or times, so their hashes differ between installations;
they remain unchanged during each consumer run.

## Failure cleanup

A separate process loads a separately compiled, instrumented copy of XS. It
never replaces an installed file. Each source-path/ABI combination passes
574 cleanup checks:

- 506 injected failures after ownership registration, copy-budget accounting,
  Perl value retention and output insertion.
- 64 partial record/List input failures, including weak-reference cleanup.
- Four `Math::BigInt` input/output exceptions that preserve the original
  exception object.

Each failure leaves zero live scopes, callbacks and resource wrappers. Later
public calls succeed. Input and output conversion share the existing 16 MiB
budget; copied type nesting remains bounded to 32 levels. These limits do not
measure all Perl allocations or Lean working memory.

## Reproduce

```sh
export LEAN_BRIDGE_PERLS='["/absolute/path/to/5.36.3-threaded/bin/perl","/absolute/path/to/5.36.3-unthreaded/bin/perl","/absolute/path/to/5.38.2-threaded/bin/perl","/absolute/path/to/5.38.2-unthreaded/bin/perl"]'
LEAN_BRIDGE_PERL_ALIAS_TEST=1 node --test tests/perl-aliases.test.mjs
node --test tests/perl-alias-contract.test.mjs
```

Local acceptance uses the existing `LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36`
override for this glibc 2.36 host. Production and CI retain the 2.38 floor.
The [source-bound receipt](perl-aliases-20260921.json) records fixture, contract,
interpreter, archive and installed-file hashes. CI requires and uploads
`build/aliases/perl.json` separately for each supported Perl configuration.

Inventory 0.52.0 promotes only six Perl alias cells: parameters, results and
record fields on both source paths. Native PHP, PHP-Wasm and WIT/WASI aliases
remain open. Native variants, bounded recursion, compound callables and
explicitly owned identity aggregates remain part of VO1219 and VO1221.
