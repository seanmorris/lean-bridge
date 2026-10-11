# Structural Subtype CI runner and PHP-Wasm admission correction

The shared runner executes ordinary-source and independently reviewed installed
packages for twelve explicit lanes:

| Lane | Required consumers |
| --- | --- |
| `c-cpp` | C and C++ |
| `python311`, `python312` | Both declared Python minor versions |
| `rust`, `ruby`, `dotnet` | Each installed native package |
| `jvm` | Java and Kotlin |
| `php-native` | Weak and strict PHP callers |
| `wit-wasi` | Installed WIT host and adapter |
| `perl` | Four pinned Perl ABIs, prebuilt-only and build-XS delivery |
| `node-browser` | Node, strict TypeScript, page, React and worker in three engines |
| `php-wasm` | Twelve Node/Chromium distribution, loading and strictness contexts |

`scripts/run-structural-subtype-ci.sh` selects one lane and runs its two author
routes sequentially. It refuses stale output and native release-floor overrides,
retains original combined stdout/stderr and partial records, and stops at the
first producer or checker failure. The Perl lane uses all four pinned toolchains.
The browser lane explicitly requests Chromium, Firefox and WebKit.

`scripts/check-structural-subtype-ci.mjs` requires the selected producer revision,
host lane, author route and native glibc floor. The original TAP must contain one
installed pass, zero skips/failures/cancellations and complete, unique totals.
The checker then invokes the existing full host-specific report validator.
Neither a success marker nor a report file's existence is sufficient.

The checker accepts 24 original installed reports across the twelve lanes and
rejects 92 wrong producer/route/floor or missing compiler-model selections. These
dispatch tests use explicitly synthetic TAP; they do not claim fresh installed
execution. A separate CLI invocation accepts the unchanged reviewed PHP-Wasm
report and its actual original TAP. Sixty real-shell scenarios use stand-in
tools to check both routes, failure propagation and original-output retention.

## Stale admission test

The broader PHP-Wasm regression retained 169 passes, one failure and 36 explicit
compiler/installed skips. Its failure was an older expectation that Array
Subtypes must be rejected. Structural Subtypes now pass the actual installed
PHP-Wasm corpus archived in
[`structural-subtype-php-wasm-acceptance-20261011.md`](./structural-subtype-php-wasm-acceptance-20261011.md).

The corrected source test requires the array refinement tree and the exact
`Sample.checkedText` constructor. It still requires classified refusal of
refined callable, copied-graph and owned packages, with a successful unrefined
graph control. Its targeted test passes. The first correction draft used a
binding-type shape instead of the refinement tree's `kind: "array"`; the failed
draft remains in `build/` alongside the corrected result.

## History and scope

The four exact transitions from
`f00ea7bfab11216cc6d1fc31f848560b0d88c960` cover test registration, the corrected
admission assertion and the historical-source readers. The ledger is
[`structural-subtype-ci-foundation-source-history-20261011.json`](./structural-subtype-ci-foundation-source-history-20261011.json),
SHA-256 `3db21cdac95bf3680624dba3b21d9f22adc6dbac2015605401fffc17a5141f93`.
The independent audit restores each predecessor directly from Git, preserves
all 9,324 older evidence files, and confirms the support inventory is unchanged.

The integrated four-root regression passed 181 tests with zero failures and 36
explicit compiler/installed gates skipped. All eleven focused runner/history
tests and all 133 documentation tests passed without skips. Full lint, checked
JavaScript and all 16 generated references passed. The earlier failed broader
regression remains alongside this complete corrected run.

The first report-control draft tried to omit `model.json` in the npm lane, which
records compiler binding IR instead. The corrected control removes the actual
lane-specific compiler record. Earlier history and formatting-check failures
also remain under `build/`; no installed producer was rerun for those repairs.

Required workflow calls, complete unconditional uploads, failure enforcement and
hosted execution follow this runner milestone. Precise support-table promotion
and consumer/author documentation remain separate work. No source/host/position
support claim changes here. All remaining #1220 type combinations stay open.
