# Installed Perl checked-record support

This milestone adds four support observations: ordinary-source and reviewed-IR
top-level checked-record parameters and results. It updates the Perl conversion
table, adds a Perl call example, and corrects the two author guides. It does not
close VO #1446 or #1220.

## Installed evidence

The promotion authenticates the [four-route installed archive](checked-record-perl-installed-20261011.md)
committed in `e6ea18b0ab28021a18cf9cb8bdf764af5f070bc5`. Its index digest is
`171f18d750b99629387f84ec49f284dc7136199256263157fecf274ce0c17c50`.
All 489 archived artifacts and their semantic records must pass before the
factory returns support references. Each reference keeps its original producer
revision, command, package hashes, source snapshots and installation records.

All four routes cover Perl 5.36.3 and 5.38.2, threaded and unthreaded, in both
prebuilt-only and build-xs modes. Input/result routes execute 9,024 checks per
configuration; standalone result-only routes execute 1,002. Each route reproduces
packages from two author roots, deletes author/build sources before offline
installation, then moves the installed tree and repeats the unchanged caller.
No installed producer was rerun for this promotion.

The observed records are `Interval`, `Sized 3` and `Bounded 0 101`, with erased
proof fields and selected safe constructors. Nested, refined, recursive and
inherited checked records, value-dependent runtime payloads, other index kinds,
zero-payload records, callbacks and owned positions remain unfinished. These are
local glibc 2.36 observations, not hosted glibc 2.38 acceptance. Entry counts were
not measured. The archive retains package hashes and selected sources, not
package binaries or a complete toolchain closure.

## Verification

The eight-root registered regression passed 320 tests, failed none, and skipped
31 explicitly gated compiler/installed tests. The installed archive above is
separate zero-skip evidence. Original R2 TAP:
`build/vo1446-perl-promotion-regression-r2.tap`, SHA-256
`9b429857cc173c6b441e7bd0b0176cc58b1f29d601ee501b7d3c104b62961745`.

R1 passed 319 tests and failed one historical-source assertion. That test compared
today's helper to its older milestone without first reversing the newer recorded
transition. The corrected test authenticates the historical source before making
the same exact comparison. Original R1 TAP remains at
`build/vo1446-perl-promotion-regression-r1.tap`, SHA-256
`80430d99353dfc3d761868e86e8fc305a807d7aa23a6c0d12cb875bcb77fc570`.
An intervening shell command used a nonexistent `docs:reference:check` script and
stopped before tests; `npm run docs:reference` is the actual check and passed.

The focused promotion/history run passed nine tests. Registered tests reject
missing routes, narrowed ABI/mode matrices, forged provenance, overlapping
observations, archive corruption and unknown source edits. Checked JavaScript,
targeted ESLint and all 16 generated reference pages pass.

The [source-history ledger](checked-record-perl-promotion-source-history-20261011.json)
records eight exact transitions from
`715ca128d1c44a7f64d3609eabee9167857425d6`. Its SHA-256 is
`2dee48077ca1f2b5b084b4351617cfcf2181a74ff312fc169258db09d21be873`.
An independent Git comparison verified every transition, 41 source-pin-only
updates to earlier evidence, unchanged claims in all 436 earlier evidence entries
and 551 earlier observations, and byte-identical contents in all 7,051 earlier
evidence files. The new inventory contains 440 evidence entries and 555
observations.
