# Fin container acceptance: WIT late inputs and hosted JVM

The WIT late-input supplement passed its installed test at
`0c4318d21478fafc57873dbb91f3035d174bbb00`. The hosted Java/Kotlin edge gate also
passed on `c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722`. These observations do not
close VO #1454 or #1427. Nine other native hosts still need complete checks of
both caller inputs after late-argument rejection.

## WIT late-argument preservation

The new caller compares both complete Wasmtime input trees before deleting
either. It checks every string byte, including bytes after an embedded NUL,
array lengths, value kinds and integer limbs. Eleven negative controls mutate
the snapshots' source values and demonstrate independent copying and detection.

Each execution performs 7,065 checks, including 1,009 refusals paired with 1,009
successful calls in the same session. First, middle and last positions are
covered. Of the refusals, 673 are canonical integers outside the Fin bound and
336 are noncanonical padded integers rejected by WIT's structural validator.
Both input trees and the poisoned output slot must remain unchanged on refusal.
Successful calls preserve their inputs and return the exact expected string.

The original R1 test incorrectly required a Fin-bound error for padded limbs.
It failed after producing both packages. The existing WIT validator correctly
rejects that representation earlier. R2 keeps the case and requires its specific
structural error. No production validator changed. A diagnostic execution of
the corrected caller against R1's installed package also passed.

R2 reproduced the package from two author roots, removed both author/build trees
before offline installation, and executed without Lean or compilers on PATH.
The harness verified the original archive receipt and exact installed file set,
compiled an origin-relative ELF runtime path, then moved the complete installed
tree. The caller, executable and package bytes remained unchanged through replay.
The installed test passed once with zero failures or skips. Minimum free disk
was 1,911 MiB; the 768 MiB stop guard did not trigger.

The [WIT archive index](fin-container-late-wit-20261011/index.json) authenticates
54 original artifacts, including both attempts, the diagnostic caller, selected
Git sources, build identities and relocated output. Index SHA-256:
`6ac00aee5cc42e33232fff81d29a49d4b3a4995dc4d47d5419a0866cb0c5e5e9`.
Successful TAP SHA-256:
`681959e3e060092e4c88d4b6b589340ad59ae3ff66712aabe685b4378019897f`.

This is ordinary-source WIT public-call evidence on local glibc 2.36. It does not
measure entry counters. The archive retains package hashes, receipts and selected
sources, not package binaries or a complete toolchain closure. The new installed
gate is registered but still needs an explicit recurring CI invocation.

## Hosted JVM edge gate

[Job 114341674825](https://github.com/seanmorris/lean-bridge/actions/runs/38095922360/job/114341674825)
completed the installed edge test and strict raw/public/foreign-carrier report
check. Its later product-documentation assertion failed; the whole job did not
pass. The older intermittent JVM debugger-shutdown failure remains unexplained.

The [JVM archive index](fin-container-jvm-hosted-20261011/index.json) authenticates
19 files and references the already committed original job metadata and log.
It retains GitHub artifact 11687334246's original ZIP and metadata, the original
Java/Kotlin report, and 16 selected source snapshots from the exact producer
revision. The report bytes were compared with their single ZIP member. Index
SHA-256: `3c566cff901be1024fa44354669e5d88c79e78cdcfe2db6016dc82978908bdef`.

The original report passes the current strict raw/public/foreign checker. Java
executes 14,089 checks and Kotlin 14,088. This retains the established zero-bound,
nested-position, relocation and dispatch observations; it does not supply the
missing full late-input snapshots for Java or Kotlin.

## Archive checks

Four registered test groups authenticate both archives and reject 154 missing or
corrupted original-file cases, including their indices and shared job records.
They preserve the failed attempt and failed whole-job status. The focused TAP
SHA-256 is `4fb9a91c7cb8099c0f6be83ad1121c0354566aa73d3528d28989c303ee399735`.
No type-surface observation or previous evidence file changes in this milestone.

The seven-root regression passed 118 tests with zero failures and 18 explicit
compiler/installed gates skipped. Its TAP SHA-256 is
`f703b0660b269ee98f4df1f5bd04a490399a3c8499515f5e2b23aa98e9d902dd`.
Checked JavaScript, targeted ESLint and all 16 generated reference pages passed.
