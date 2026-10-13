# Native consumer CI partition

Predecessor: `3fc6a085155dea5266ded890d9f16a0976e33ae6`.
The two workflow files at that revision match `ad83883`, the failed hosted run.

## Observed failures

The [C/C++ job](https://github.com/seanmorris/lean-bridge/actions/runs/38249924226/job/114813264454)
reached its 360-minute job budget while the native graph package tests were
still passing. Its original sequence took about 44 minutes for the copied
corpus, 162 minutes for refinements and variants, and at least 124 minutes for
callbacks, owned values and recursive packages. Setup and ordinary C/C++
acceptance added about 30 minutes. No assertion failure precedes cancellation
in the retained log.

Original log SHA256:
`471dab844bbfbff9d24524813d305519b1c6860fea3b7949b6cefa0532d5a6b3`.

The [Perl shared compiler job](https://github.com/seanmorris/lean-bridge/actions/runs/38249924226/job/114813264450)
reached its 60-minute budget as its final six tests reported success. The
cancelled prerequisite caused the combined Perl observation to fail.

Original log SHA256:
`09aca6ed5fe0d9688fa74cfb3eedd1cd28cc7634a99460337f30d16f010bb6b8`.

## Changes

The existing `native-consumers` C/C++ job retains the base installation,
ordinary C/C++ checks, refinements, checked records and variants. Its budget
remains 360 minutes. Python and Rust retain their existing 240-minute budgets
and do not wait for the new job.

The independent `native-c-family-values` job runs the copied corpus, callbacks,
owned values and recursive packages with a 240-minute budget. It checks out
the complete source history and installs its own dependencies and pinned Lean
compiler. Its acceptance step fails on any command failure; its artifact
upload runs even after a failure.

The partition preserves all 191 original command lines and 77 artifact paths.
The additional shell setup enables strict error and pipeline handling. The
existing observation script no longer attributes the moved commands to its
own job. The combined support summary checks both job outcomes before it
publishes an accepted report. Failure, cancellation or skipping either job
prevents that publication.

The Perl shared compiler budget increases from 60 to 90 minutes. Its commands,
environment flags and combined-result dependency remain unchanged. Other Perl
jobs retain their existing budgets.

## Evidence boundary

These changes repair CI scheduling and enforcement. They do not replace fresh
hosted execution or add language/type support. The inventory keeps all 500
evidence entries and 585 observations, refreshing only exact current-source
identities. Earlier receipts, source ledgers and archived files remain intact.
The source ledger records the complete transition against its Git predecessor.

Java and Kotlin nominal caller compilation is separate work. No JVM installed
acceptance is attributed to this CI partition.

## Regression corrections

The initial documentation run passed 42 tests and failed one assertion that
recombining the recording scripts must exceed the expression budget. The
partition removes enough text that this is no longer true of the current
scripts. The test still checks every live workflow against the budget and
now reproduces the overflow using the authenticated pre-partition workflow.
Original TAP SHA256:
`2367fd76715245e0d8ea35d38cb98711197cb8b0ffbd69213d4fdfc669368a35`.

The first nine-root regression passed 350 tests, failed two and explicitly
gated off 26 compiler/installed cases. The failures were in unchanged guide
assertions: one still required nominal fields to be unaudited on every native
host, and one applied the browser scope to the combined Node/browser row.
Git confirmed those tests and their affected guide bytes matched the
predecessor before correction. Original TAP SHA256:
`4685d380ad99cbc5d57c9d90311cb7cdbb5bb5e51c5401d6521e9df5248d04dd`.

The native assertion now checks field coverage against the current inventory.
The browser assertion checks the explicitly labeled browser group. Both keep
their authenticated historical conversion checks and require callback positions
to remain unaudited. The two corrected cases pass without failures or skips.
No consumer guide content or accepted support position changes in this repair.

## Final validation

The frozen CI sources pass 33 focused checks and 43 documentation checks, with
no failures or skips. The nine-root regression passes 352 tests with zero
failures and 26 explicit compiler/installed gates skipped. Those skips do not
supply installed acceptance.

Final TAP SHA256 values:

- Focused: `2c787abb2065b93480552d5fa911519adced3c821073240a5d3bd921bb7a6db4`.
- Documentation: `a1e9968ca7d65ba6d30f4852ba939d322e3585e01131deb3903fc27e0e88e6b9`.
- Regression: `9c4ea047ddfc6276614c9ac5d161fd3f0b579bba252cd2a4de2574fe59a00f70`.

Full ESLint, checked JavaScript, all sixteen generated reference checks and
actionlint pass. The focused tests also parse every native job's shell block
with `bash -n`, exercise 193 command omissions and 77 artifact omissions, and
check all 25 combinations of the two required job outcomes.

The independent audit reverses all fourteen source transitions against the
Git predecessor and verifies that only 143 source pins change in the inventory.
All earlier evidence and support claims remain unchanged. Source ledger SHA256:
`b354447210fdfabbf4846e27c0af548569cad55a03b5820eedc9fd4e0b06daad`.
These results cover the CI repair; separate uncommitted JVM work is excluded.

The staged whitespace check found one extra blank line at the end of the new
history updater. Removing that line was the only source change after the full
regression. ESLint and both history/updater tests pass on its final bytes;
their TAP SHA256 is
`ec4d12db4a8f6ef6b94cdf7b6f757629d4e3554a42812aacfd2ecbbe7ec20d1f`.
