# Native late-input preservation callers

This milestone adds complete late-input preservation callers for C, C++, Python,
Rust, Ruby, .NET, Java, Kotlin and native PHP under #1454/#1427. WIT/WASI has its
separate accepted supplement. These source checks do not establish installed
acceptance for the nine callers.

Each caller retains the complete original Fin edge consumer and adds nine
position/value combinations followed by 1,000 rejection/recovery pairs. Both
complete inputs are compared after rejection and recovery. The string input
contains an embedded NUL and suffix bytes. Six deliberate mutations check that
the saved values detect changes in every element. C also checks the unchanged
output sentinel. C adds 7,072 assertions; each other caller adds 6,063.

The opt-in installed harness preserves original models, package-set receipts,
source files, installed receipts, closure observations and execution transcripts.
It reproduces the package from two author roots, removes each author before
installing its package, and relocates the complete first installation before
replaying the unchanged caller. The second build follows the first installation
and replay. Failed temporary roots are retained. Existing non-supplement
consumers, counts and dispatch gates keep their behavior.

`scripts/check-fin-late-native-report.mjs` requires an exact successful installed
TAP, the selected profiles, an explicit glibc floor, and the exact Python minor
when applicable. It authenticates the retained files, caller source, both build
identities, refinement trees, package identities, full output and host closure
observations. It requires PHP's relocated strict execution separately. It
rejects a dispatch claim: this supplement does not measure entry counters.

Verification:

- All nine callers compile or parse using generated public types where required.
  The final source run passed 11 tests, including the report controls, with zero
  failures or skips. Original TAP: `build/vo1454-late-native-source-r3.tap`,
  SHA-256 `2159fd8db5c578a65c7245bc85c8d94f1a11fa50d21f2b68fead314c5e37480f`.
- Registered six-root regression: 121 passed, zero failed, 26 explicitly gated
  tests skipped. Original TAP: `build/vo1454-late-native-regression-r3.tap`,
  SHA-256 `cde01a593639c94e9ad2ed50a9eab0a5fb7fa0089ac20cfbcd2b7a26a0f603c5`.
- Targeted lint, checked JavaScript and all 16 generated reference checks pass.
- The source-history ledger records three exact transitions from `9f26b9b`.
  Its SHA-256 is
  `2906393eba413b3619999d7669920b8719e0da1b01372b37f070061197ce59e9`.
  The support inventory and all earlier evidence files remain unchanged.

The first registered regression failed one historical source comparison. The
new exact history transition fixes that comparison without rewriting earlier
receipts. Original R1 and R2 logs remain under `build/`. A mistyped reference
script name in `reference-r1.log` did not run the reference check; R2 ran the
correct command successfully.

Installed execution, independent report checks against those executions,
immutable acceptance archives, recurring CI and the original-case closure audit
remain required. Both supported Python minors and PHP weak/strict modes remain
in scope. No support cell is promoted by this milestone.
