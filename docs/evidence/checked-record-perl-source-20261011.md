# Perl checked-record source support

The Perl generator now accepts top-level checked records through the native
payload mirrors. XS converts generated Perl classes into those mirrors,
validates each input through its selected Lean constructor, and invokes the
guarded adapter. The adapter constructs the source record through that same
constructor. XS never manufactures a proof or depends on source-record layout.

A rejected constructor names the parameter and constructor. Separate sites may
select different constructors for one record type, including normalization.
Lean receives the normalized value while the caller retains its original
record. Results project payloads after Lean constructs the proofs. Standalone
result-only packages need no input constructor.

CPAN staging enables this path only for copied packages. Owned checked-record
transport is not enabled. Existing restrictions on nested checked records,
dependent payloads and checked-record callbacks remain. Generated POD documents
payload classes, constructors and proof-free results. A checked-record-only
package no longer describes its records as bounded integers.

## Verification

Five source tests first failed on the missing generation, result documentation
and CPAN capability. They pass after the repair. Fresh Lean then compiled all
four routes: ordinary source, independently reviewed IR, and standalone
result-only packages for both. The combined source run passed nine tests,
without failures or skips.

An independently authored Perl consumer covers all eight exports, large Nats,
invalid lengths and intervals, late-parameter rejection, constructor choice,
normalization, unchanged input records and independent returned records.
It specifies 9,024 checks for a full package and 1,002 for result-only packages,
including 1,000 repeated rejection/recovery cycles. Fixture tests authenticate
all 13 expected constructor diagnostics before relabeling reviewed parameter
names. All four caller variants pass Perl syntax checking. These counts are
the intended installed assertions, not completed Perl runtime observations.

The eleven-root regression passed 251 tests with zero failures and 36 explicit
compiler or installed gates skipped, 287 total. Local generation comparisons
also found byte-identical output for an unrefined model and three existing
Subtype models compared with the predecessor generator.

The [source archive](checked-record-perl-source-20261011/index.json) preserves
the original failed generation, fresh Lean run and fixture test output.
Its selected source hashes identify this worktree's tested inputs; they do not
claim a complete toolchain closure. No C/XS compilation, installed package
execution, hosted pass or Perl support-table promotion follows from these
source tests.

Archive index SHA-256:
`8768632e68132281270f342dfd81b581924d0eebd0a437cd33d1030f780f5552`.

The [source-history ledger](checked-record-perl-source-history-20261011.json)
records seven exact transitions from `9872376` and 31 source-pin updates.
All 436 evidence entries and 551 observations preserve their existing claims.
The independent Git audit authenticates 3,893 distinct source pins and confirms
that all 6,496 older evidence files are unchanged. Final archive, fixture and
history tests passed six tests without failures or skips. Full lint, final
changed-source lint, checked JavaScript and all 16 generated references passed.

## Next installed gate

Run all four source routes with both Perl 5.36.3 and 5.38.2, threaded and
unthreaded. Require independently built reproducible packages, source deletion,
offline prebuilt installation and XS-build installation, actual public calls,
package immutability and replay after moving the complete installation.
Preserve failed attempts and original reports. Promote only the combinations
that those installed runs establish.
