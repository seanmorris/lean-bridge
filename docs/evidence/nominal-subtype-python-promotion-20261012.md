# Nominal Python support and recurring CI

Predecessor: `ad3f7716d997ef8a4331ec8a3f2a6524a2ca3b30`.

The support inventory adds four installed evidence entries from the
[original Python acceptance](nominal-subtype-python-acceptance-20261012.md).
It adds two Python field entries, one per author route, and supplements the
four existing parameter/result entries. Other profiles and value positions
keep their previous claims. The inventory now has 488 evidence entries and
579 observations.

The consumer, author and generated reference guides describe the tested Nat
Subtype fields in acyclic records and variants, per-use checked constructors,
normalization, aliases, mixed Fin guards and copied constructor-free results.
The author guide's earlier example now omits the result constructor selection;
the adjoining explanation already described that behavior. Python callers use
generated frozen dataclasses and ordinary `int` payloads, without proof fields.

## Required CI

The existing Python native-consumer job runs all four nominal source/API
selections after its previous corpus gates. Each selection requires both
`actions/setup-python` interpreter paths, reproduces one wheel in two author
roots, installs it offline on Python 3.11 and 3.12, then moves both installed
trees and replays the unchanged caller. The gate selects the hosted glibc 2.38
package floor and refuses an ambient floor or interpreter-matrix override.

The new step has a 45-minute limit and cannot tolerate failure. Its verifier
requires complete zero-skip TAP and authenticates original records against
the current Git producer, both interpreter floors and actual host runtime.
An always-run upload retains the complete output tree, including partial
failed runs, for 30 days. Earlier steps, uploads, job budgets and the required
native-consumer summary dependency remain unchanged.

Local CI controls passed:

- Twenty workflow mutations reject skipped gates, missing floors, suppressed
  errors, weakened time limits and partial uploads.
- Three report tests reject malformed selections, 140 incomplete or mismatched
  TAP variants and 56 altered producer/runtime/record cases.
- The real shell passes nine complete/failing sequencing scenarios, rejects
  nine stale-output reuses and rejects ten invalid argument/override cases.
  Stand-in tools exercise shell behavior without claiming compiled acceptance.
- Bash syntax and actionlint passed. All sixteen generated references match
  the current contracts.

## Source and claim audit

Twenty-two exact source transitions preserve the prior evidence chain. The
[promotion ledger](nominal-subtype-python-promotion-source-history-20261012.json)
refreshes 229 current-source pins without rewriting earlier archives or
committed ledgers. An independent audit reconstructs every predecessor source
from the recorded spans and checks it against Git, then verifies preservation
of all 484 prior evidence entries and the six changed Python cells.

Ledger SHA-256:
`66a28670c7db87f80414169112d8cc7d80fc7dbf646b4e1abf3dc68d63314427`.
Independent audit: `build/vo1444-nominal-python-promotion-audit-r3.json`, SHA-256
`8bebfa2b392db3048f9cff2494df23eae4345537c6f2b33e0d58ab901465c31f`.

The first registered regression found two stale assertions: the structural
guide check still expected Python and Perl fields to be unaudited, and the
ordinary Python inventory check expected its earlier parameter/result-only
Subtype coverage. Updating the guide check also exposed the Perl guide's
missing hosted release-floor qualification. The corrected assertions require
the actual field coverage and its exact evidence IDs; callback positions
remain unaudited. The Perl qualification is restored.

All three focused repair/history tests passed without failures or skips:
`build/vo1444-nominal-python-promotion-repairs-r2.tap`, SHA-256
`28241e21a93184b68ba93e179161939c8d9510f0c96a755f80845b08c23a31b5`.
The seven-root regression passed 302 tests, failed none and recorded
39 explicit compiler/installed skips. It covers component refinement mirrors,
the support inventory, structural Subtypes, checked JavaScript, documentation,
generated references and test-profile registration. Original TAP:
`build/vo1444-nominal-python-promotion-regression-r2.tap`, SHA-256
`deade29d61ed846396cd21df5afae79649de86538f90423ac6a8ed5c61f343a1`.
The failed first regression and intermediate repair logs remain separate.

After the final formatting and source-pin refresh, the CI report, history and
complete inventory checks passed again. This run also exercised six source-only
checks from the separate Ruby draft, with four Ruby installed gates explicitly
skipped: 75 passed, zero failed. TAP:
`build/vo1444-nominal-python-promotion-final-r2.tap`, SHA-256
`03aefe92c4424575d1f4dbfdbbbaf3b6c2b51a07e6c32ed320b99d32a444ad9f`.
Repository typechecking and focused ESLint checks pass. The Ruby draft does
not add installed support claims to this milestone.

These support claims retain the original CPython 3.11.16/3.12.14 and local
Linux x64/glibc 2.36 observations. Adding the CI gate does not claim that a
hosted run has passed. Constructor/source entry counts, other primitive-base
nominal fixtures, remaining host contexts and the original callback, owned,
recursive, dependent and generic requirements remain open under VO #1444.
