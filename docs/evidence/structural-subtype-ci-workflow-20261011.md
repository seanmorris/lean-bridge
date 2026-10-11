# Required structural Subtype consumer gates

The consumer workflows run the installed structural Subtype corpus through both
ordinary-source and independently reviewed author routes. The shared runner and
complete report checker are documented in the
[CI foundation note](./structural-subtype-ci-foundation-20261011.md).

## Required hosts and retained records

The native C/C++, Python 3.11 and 3.12, Rust, Ruby, .NET, JVM, native PHP and
WIT/WASI lanes run inside their existing enforced corpus steps. Python uses the
explicit interpreter selected by each setup step. PHP-Wasm uses the runtime
prepared by its preceding entry-probe setup. These steps retain the complete
output directory on success or failure, including original TAP and partial
compiler/package records.

The Node/browser lane has a required step using the locked component engine and
prepared runtime. Its runner requires Chromium, Firefox and WebKit. Both Node
consumer observations include the structural outcome and command. The Perl
lane runs in the existing checked-record job after all four pinned ABIs have
been prepared. The combined Perl result still requires that job to succeed.
Neither new step tolerates failure. Their full output directories upload with
`if: always()` and `if-no-files-found: error`.

No earlier producer, job or job timeout is removed or changed. Tests reverse
only this milestone's additions and compare both workflows with the exact
predecessor, `fb99ddabe63722eeda0da7a4e54c5b289c2edd7c`.

## Verification

The focused workflow checks reject 169 native/PHP-Wasm mutations, 13 Node
mutations and 18 Perl mutations. Eight actual Bash executions check that Node
observations report both JavaScript and TypeScript accurately when the
structural step succeeds, fails, is skipped or is cancelled. These tests use a
stand-in recorder, not installed packages.

Actionlint accepts both workflows. The largest expanded run expression is
17,886 characters in the consumer matrix and 4,855 in Perl, below the repository's
20,000-character guard. Older workflow tests retain their assertions after
validating and removing this required layer for historical layout comparisons.

The first draft's Node observation simulation omitted the preceding shell
assignments. Another wrapper omitted the workflow name, and a Perl mutation
targeted the old complete job before removing the new block. Their failing
logs remain separate from the corrected tests. The documentation, browser and
scalar-probe checks also needed the new layer validated before their original
layout checks. No producer failure was turned into an accepted run.

The final host regression passes 263 tests with 51 explicit compiler/installed
skips. The separate PHP-Wasm regression passes 112 with 14 explicit skips.
Neither has failures. All 133 documentation tests pass without skips, as do
the six focused workflow/history tests and 22 earlier gate/history checks.
Full lint, typecheck and all 16 generated-reference checks pass. The original
broad run's 369 passes, one browser layout-check failure and 65 skips remain
under `build/vo1444-structural-ci-workflow-regression-r1.tap`.

The [source-history ledger](./structural-subtype-ci-workflow-source-history-20261011.json)
records fourteen exact transitions and 131 updates to existing source hashes.
Its SHA-256 is
`211592c944558e45795414e89e32b060a3ecad4b8c132eef3c2253a2d1871525`.
An independent audit restores every predecessor from Git and verifies all
9,326 older evidence files byte-for-byte. The inventory retains 440 evidence
claims and 555 observations, with no other changes.

## Scope

This milestone changes recurring CI requirements and source-history records.
It does not promote a supported-type cell or claim hosted execution of these
new gates. Exact structural support-table and author/consumer documentation
updates follow separately. Nominal, callback, owned and broader dependent
combinations remain open under #1220.
