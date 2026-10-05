# Recursive Perl packages

Prepared CPAN archives expose eighteen recursive Lean functions through named
Perl records and constructor classes. Arrays and Lists use plain array references;
`Some`, `Ok` and `Err` retain their existing classes. Callers use the installed
module without locating native libraries or loading the shared runtime manually.

The [installed receipt](perl-recursive-packages-20260923.json) records ordinary
Lean source and an independently reviewed contract. CPAN-only builds need no
public C target. The build authenticates the finite graph metadata, generated
XS converters and private native adapter before assembling the archives.
Private graph symbols do not enter the installed module's public symbol table.

## Installed checks

Two builds in independent directories each produce both source paths. Every
package installs on Perl 5.36.3 and 5.38.2, with and without interpreter threads,
through both prebuilt-only and generated-XS-only installation: 32 installations.
Author sources and build output are absent during installation. The handoff
archives are removed before the relocated consumers execute without compilers.
Each consumer runs twice and checks that installed files retain their hashes.

Each threaded installation passes 213 public assertions; unthreaded installations
pass 212. The checks cover all eighteen exports, primitive values, direct and
mutual recursion, aliases, empty and wide values, independent copied branches,
malformed input, cycles, budgets and process/interpreter restrictions.

Independent builds reproduce the original archives, native libraries, installed
package files and consumer observations. MakeMaker's two `.packlist` files and
`perllocal.pod` contain installation paths and dates. The comparison validates
those records and normalizes only their installation prefix and dated headings;
the receipt also retains their unmodified hashes.

## Cleanup and shared runtime

Fault tests compile an instrumented copy of the exact XS source from the original
archive and use the installed runtime. They leave the installed modules and
libraries unchanged. Each installation runs four fresh-process scenarios for
malformed compiler carriers, malformed raw output, runtime retirement during a
call and retirement during result publication: 128 scenarios across the matrix.
Each scenario checks 28 native allocation sites, 94 scratch allocation sites and
732 exception/signal checkpoints, including partial cleanup and recovery.

Three installed packages exercise shared runtime initialization, both load orders
and both retirement paths on every Perl ABI: sixteen scenarios. Two recursive
components deliberately use colliding private C names. The acyclic package adds
a retained closure. Copied Perl values remain usable after retirement.

The fork test holds the actual runtime broker mutex in another thread. Child
calls and imports reject before entering it. Automatic destruction of an inherited
closure discards only the child's host wrapper, without entering the broker or
releasing the parent's Lean object. The parent can still call and close its
closure. This test reproduced a deadlock before the cleanup fix.

Eight collision checks load different native libraries with the same component
coordinate and disjoint Lean modules. Both load orders reject the conflict before
reading or loading its native library. Reloading the original identity remains
valid, and the first package continues to work.

## Existing package regressions

The [regression receipt](perl-recursive-regressions-20260923.json) compares fresh
installed packages with the original records for Perl collections, compounds,
Lists, aliases, variants and primitive callables. It also checks shared C/C++,
Rust, Python, Ruby and Java/Kotlin builds, plus the core CPAN packaging tests.
Historical receipts keep their original hashes.

Perl's loader and runtime changes produce new package bytes. The comparison
requires the original public results, source contracts and cleanup behavior.
It accounts for the earlier Array snapshot cleanup checkpoints and reconstructs
the reviewed Compound fixture's named alias change. Declaration listing order
is normalized; parameter and field order are not.

The shared-language checks retain exact archive and installed-payload comparisons.
Ruby uses the original record's declared glibc 2.38 floor. Rust client executables
can differ because Cargo embeds their offline vendor paths; package archives,
native libraries and generated consumer sources must still match.

## Documentation and limits

The test extracts the exact Lean and configuration examples from the
[CPAN publishing guide](../publish/cpan.md#export-recursive-values), builds both
source paths and runs the exact [Perl example](../consume/perl.md#recursive-values)
on all four ABIs. The eight executions print `41`, `99`, `41`, demonstrating that
mutating an input does not mutate its copied result. Corrupting each installation's
Lean runtime, broker and component library produces 24 checksum rejections before
the corrupt library reaches `dlopen`. Restored installations execute again.

Recursive conversion permits depth 128, 262,144 node visits and 16 MiB of native
copy storage across arguments and result, plus a separate 16 MiB conversion-storage
budget. These limits do not bound Lean working memory or all Perl allocator
overhead. Tests run on Linux x86-64 with the local glibc 2.36 test floor; they do
not change the normal release floor or claim other architectures.

```sh
source scripts/env.sh
LEAN_BRIDGE_PERL_GRAPH_PACKAGE_TEST=1 \
  LEAN_BRIDGE_PERL_GRAPH_COLLISION_TEST=1 \
  LEAN_BRIDGE_PERL_GRAPH_COMPOSITION_TEST=1 \
  LEAN_BRIDGE_PERL_GRAPH_DOCUMENTATION_TEST=1 \
  node --test tests/perl-graph-package.test.mjs
```

The default local selection covers all four pinned ABIs. Each Perl CI matrix job
runs the enabled gates for its selected interpreter and retains the four reports
under `build/recursive/`. Structured callback/closure payloads and explicitly
owned resource aggregates remain assigned work in VO 1219.
