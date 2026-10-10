# Required reviewed Subtype browser checks

The reviewed npm CI runner now requires browser execution after its original
two-root npm and strict TypeScript checks. It selects Chromium, Firefox and
WebKit explicitly, overriding inherited partial-engine selections. The
existing required npm workflow step, outcome enforcement and always-uploaded
record directory cover the expanded run.

`scripts/check-reviewed-subtype-browser-reports.mjs` requires the original
passing installed TAP and all 75 retained package/browser records. It checks
both compiler builds, exact callers and declarations, installed manifests,
package locks, content-addressed runtime identity, deployed and served Wasm,
twelve engine/build executions and all 51 lifecycle observations. It also
checks React production/strict counters, pending unmounts, worker shutdown
and restart, module reuse and missing-asset recovery.

The earlier npm-only checker remains available for historical runs.
Historical npm-only archives pass that checker and fail the new browser
checker because they contain no browser observations.

The shell preserves partial records and both output streams, rejects stale
output directories and propagates producer, package-checker and browser-checker
failures. Shell tests use stand-ins; installed acceptance comes from the
[original browser run](reviewed-subtype-browser-acceptance-20261010.md).
These integration checks do not rerun Lean or establish hosted acceptance.

## Verification

Eighteen focused tests passed without failures or skips. Controls cover
75 missing records, 76 mirrored report alterations, 27 substituted callers
or runtime/component manifests, invalid CLI arguments, inherited partial
engine selection, shell failure propagation and recurring workflow enforcement.
Focused TAP `build/vo1444-browser-ci-focused-r1.tap`, SHA-256:
`e26be9af41b07b5160f1dd0f841bc4f33c9013e883aaaf60fac41907dcc651fe`.

The seven-root regression passed 670 tests with zero failures and seven
explicit compiler/installed gates in 168.26 seconds. TAP
`build/vo1444-browser-ci-registered-r1.tap`, SHA-256:
`995484b2b66d65f31f504db30d2b00de92f85d56acd7f48e1b969a2b9a1b1b90`.
Full lint, checked JavaScript, ShellCheck and sixteen generated-reference
checks passed.

The eight-transition history changes twelve current-source pins only.
All 419 evidence entries, 518 observations and 6,023 older evidence files
retain their claims and original bytes. Ledger SHA-256:
`4620e03038605119a5a1f0b33a73c327c195ae7d903cf189ae13debe0cc3ad76`.
Independent audit `build/vo1444-browser-ci-audit-r1.json`, SHA-256:
`3f72377f815ff284e2e6bc981e14059189c1fc499116f481796fa70393c7a0c4`.

Exact browser support promotion and documentation are next. Nested,
nominal, callback and remaining generic Subtype requirements remain open.
