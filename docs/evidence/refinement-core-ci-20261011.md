# Core test repair after refinement evidence expansion

[Core run 38095922167](https://github.com/seanmorris/lean-bridge/actions/runs/38095922167)
failed four tests at `c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722`.
All four failures reproduced locally at
`08eb94ef6321b8a58ea4c57b9e13dfa7522ee49b` before the repair.

| Test | Cause | Repair |
| --- | --- | --- |
| CLI project analysis | The test assumed the repository contained one Binding IR. Installed evidence archives added other valid reviews. | Analyze an isolated project with one explicit review. Add a second review and require exit 2 with both choices. |
| Existing Binding IR analysis | The same repository-wide assumption left `bindingIr` null. | Test an isolated single-review project, verify its semantic digest and unchanged files, then separately require ambiguity when another review is under `docs/evidence`. |
| Historical Perl promotion | The test compared a historical claim with current documentation after reviewed Subtype acceptance. | Reconstruct the authenticated documentation at that historical milestone. Keep the original assertions. |
| Scalar Fin source-entry workflow | The test required immediate adjacency to compilation, before the newer required Subtype checks existed. | Validate the complete Subtype workflow layer, remove that exact layer for the historical adjacency check, and retain every original enforcement mutation. |

No analyzer, runtime, generated adapter or workflow command changed in this
repair. Multiple reviews still require a user selection. The analyzer does
not ignore `docs/evidence` or silently select the first review.

## Original evidence

The [archive index](refinement-core-ci-20261011/index.json) authenticates seven
original artifacts: hosted failure log, run and job metadata, direct local
analysis output and stderr, the four-failure reproduction, and the focused
five-test repair. Local analysis reports `needs-input`, as expected for the
repository's multiple reviews. These local repair results do not establish
a hosted Core pass or new installed consumer acceptance.

Index SHA-256:
`978f96736a75311ff69cab082d830d99d5471c9a5e0dcdcd4e9dbdeabcc1117e`.
The archive script verifies every original digest before copying and refuses
to replace different destination bytes. Archive tests reproduce the archive,
reject changed destination files and refuse missing originals. Readers use
archive-relative paths; captured build and environment paths are provenance.

## Verification

The focused repair passed five tests without failures or skips. The nine-root
regression passed 244 tests with zero failures and 30 explicit compiler or
installed gates skipped, 274 total. Those skips are not new installed evidence.
The regression covers CLI analysis, project analysis, compiler analysis,
historical Perl promotion, scalar Fin rejection, checked records, documentation,
type-surface inventory and test registration.

The final history and archive controls passed four tests without failures or
skips. Full lint, final changed-source lint, checked JavaScript and all 16
generated reference pages passed.

The [new source-history ledger](refinement-core-ci-source-history-20261011.json)
records eight exact transitions from `08eb94e` and five source-pin updates.
The independent audit reconstructs every predecessor directly from Git,
authenticates 3,893 distinct source pins and checks that all 6,486 earlier
evidence files are byte-identical. All 436 evidence entries and 551 observations
preserve their support claims. No acceptance status is promoted.

Ledger SHA-256:
`7966304b44718f88e0f6a13a6e12ae34497098788a4aa2edf356b26cc6e5499d`.

Original working logs:

- `build/vo1220-core-followup-registered-r1.tap`
- `build/vo1220-core-followup-history-focused-r2.tap`
- `build/vo1220-core-followup-audit-r2.json`
- `build/vo1220-core-followup-lint-r1.log`
- `build/vo1220-core-followup-typecheck-r1.log`
- `build/vo1220-core-followup-reference-r1.log`
