# Reviewed Perl parameter diagnostics

The installed reviewed-Subtype test found that Perl's generated XS reported positional names such as `arg0`, while the reviewed API and the other host projections used the declared parameter name, `value0`. The compiled checked constructor rejected the empty string, but its error did not match the reviewed contract.

The generator now takes diagnostic names from the reviewed native model. Subtype rejection, scalar Fin bounds, indexed Fin bounds and their per-function POD entries use the same names. Ordinary-source packages retain their positional names. A byte comparison against the previous generator confirms unchanged ordinary-source output for the complete twelve-export Subtype model.

The report checker also accepts the actual Perl Config representation for disabled threading: JSON `null`. Enabled threading remains `"define"`; other values are rejected. This changes report validation, not the Perl runtime or package compatibility rules.

## Original failures

The [failure archive](reviewed-perl-diagnostics-20261010/index.json) preserves 19 original records from producer `a0f0ca4f390369a74477588dd96845a3d0f69f57`. Its index SHA-256 is `ab70bd07ace9a71755354167e0bf54673c5c8fc146f1703001c7e7d62b2567d4`.

The first attempt omitted CPAN's separate local test-floor setting and stopped at the production glibc 2.38 guard on this glibc 2.36 host. The next runner explicitly set `LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36` before compilation. It reproduced both package builds and installed them without author sources or compilers, then stopped at the first reviewed-name assertion. Neither failure is counted as installed acceptance.

The archive includes both TAP logs, runner identities, two complete build records and the original archived XS, including its generated whitespace. The checker reads archive-relative files, not recorded temporary paths. Original package binaries remain outside this archive.

## Verification

Focused regression before archival passed 42 tests with no failures and eight explicit installed/compiler gates. The new source tests cover Subtype, scalar Fin, indexed Fin, POD and renamed parameters. The history tests validate seven exact source transitions, preserve all 407 evidence entries and 509 support observations, and check every current source pin. Independent checks matched all transitions to Git and confirmed that all 5,537 earlier evidence files remain unchanged.

Type checking and all 16 generated reference checks pass. Installed acceptance of the corrected generator across all four pinned Perl ABIs remains required; this source repair does not claim those results.
