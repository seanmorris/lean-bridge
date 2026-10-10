# Reviewed native Subtype CI gate

The gate consists of a lane runner and an independent report checker:

- `scripts/run-reviewed-subtype-host-ci.sh`
- `scripts/check-reviewed-subtype-host-reports.mjs`

The runner selects Python 3.11 or 3.12, Rust, .NET, Java/Kotlin, Ruby, native
PHP, WIT/WASI, or one of the four Perl version/threading configurations. It
executes the complete twelve-export installed corpus with test concurrency
one. It captures both original output streams and retains partial records when
the producer fails. A second invocation refuses to overwrite those records.
Producer and checker failures propagate to the caller.

The checker requires the exact installed test name, one passing test and
zero failures, skips, cancellations or TODOs. It checks both independent build
records, their reviewed APIs, source/configuration identities, package receipts,
host reports, source removal, offline installation and relocated replay.
Python lanes require the selected minor version. Perl lanes require the actual
selected version, threading and multiplicity reported by `Config`.

The hosted runner rejects local glibc-floor overrides and retains the default
2.38 floor. Receipt checks on Ruby, JVM, .NET and native PHP accept an explicit
expected floor; archive readers still default to their original 2.36 floor.
Other host reports do not retain that receipt field, so the checker does not
claim an independent glibc measurement for those reports.

For example, a Python CI step selects the interpreter supplied by its tool
setup before running the lane:

```sh
LEAN_BRIDGE_PYTHON="$PYTHON311" bash scripts/run-reviewed-subtype-host-ci.sh python311
```

The runner writes `build/reviewed-subtype-ci/python311/run.tap` and a `records/`
directory beside it. CI must upload the complete lane directory with
`if: always()`, including failed runs. Selecting another Python interpreter
does not satisfy the 3.11 gate.

This milestone prepares and tests the gate. The workflow jobs do not invoke
it yet. Workflow wiring and fresh hosted acceptance remain required under
#1444. The checks below use the original local archives and stand-in processes
for shell wiring; they add no installed support observations.

## Preservation audit

The seven-transition source ledger starts at
`e9d1387654c0973bd74e7383097f7a1644036701`. It refreshes only 36 validator/test
source pins. All 419 evidence entries and 518 observations keep their claims.
The independent Git audit checks all 5,828 older evidence files byte for byte.

Ledger SHA-256:
`5e827c8b3c2cd9223f6634b1c523f4b0bf0fd7782812d0f1c755e7e2a5f6224f`.
Audit output: `build/vo1444-reviewed-native-ci-gate-audit-r1.json`.

## Verification

The final affected regression ran the registered reviewed-Subtype, type-surface
and author-documentation roots, plus the two recent history-repair suites:
149 tests, 145 passed, zero failed, four explicit installed/compiler skips.
The command used `node --max-old-space-size=2048 --test --test-concurrency=1`.
Original TAP: `build/vo1444-reviewed-native-ci-gate-affected-r2.tap`.
SHA-256: `6d0d5a2d06c67c2410ed67c21183c9a238aaf357325136900d43f17b821d26d1`.

All twelve original archived runs pass the report checker both through its API
and through the actual CLI. Negative cases reject missing files, weakened
isolation flags, altered build identities, wrong Python/Perl selections, skips,
duplicate totals and substituted tests. Shell controls cover all twelve lanes
with passing, failed-producer and failed-checker exits, preserve both original
streams and partial records, and reject another run over the same output.
Six invalid-input/platform-override cases stop before creating an output tree.
The shell controls use stand-in tools and do not count as installed execution.

Full repository lint, JavaScript typecheck, ShellCheck and sixteen generated
reference checks passed.

The first affected run was stopped while Node formatted a Buffer-versus-string
assertion failure. The corrected test verifies the reader's documented Buffer
identity for unchanged input. The stopped TAP is
`build/vo1444-reviewed-native-ci-gate-affected-r1.tap`, SHA-256
`8ad18651bf3f1a4273fc53d4ee1a5f6c87e832f17a2679fdbb95d92fa6a9a5b6`.
A small direct reproduction exits with the same assertion failure without the
large diff: `build/vo1444-reviewed-native-ci-buffer-assertion-repro.log`,
SHA-256 `8a463a66f4e8465a04e8de890329375d3908ed912c7bdfe8534d1c7d2dd5aac0`.
Neither failed attempt is passing acceptance evidence.
