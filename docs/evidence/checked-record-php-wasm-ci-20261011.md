# Required PHP-Wasm checked-record CI

VO #1446, within #1220. The dedicated [workflow](../../.github/workflows/checked-record-php-wasm.yml) runs ordinary, independently reviewed and both standalone result-only packages. It keeps this acceptance outside the existing 330-minute PHP-Wasm corpus job.

## Required execution

The job checks out full producer history and uses Node 22, pinned Lean/Emscripten/PHP inputs and Chromium. It builds and verifies its own shared runtime before running the four configurations. Composer runs without host debugging instrumentation. Runtime preparation and acceptance logs are retained on failure.

The [runner](../../scripts/run-checked-record-php-wasm-ci.sh) refuses a pre-existing output directory. It first enables nine fresh Lean checks: four wasm32 package compilations, four invalid reviewed-source changes and one valid constructor change. The [compiler checker](../../scripts/check-checked-record-php-wasm-compiler-ci.mjs) requires every named test and its compiler observation, with no missing, failed or skipped checks. The runner then enables installed tests explicitly and requires the same four routes in order. It captures producer stdout/stderr and checker output with pipeline failure propagation. A failed producer or checker stops later routes without overwriting its original records.

The [checker](../../scripts/check-checked-record-php-wasm-ci.mjs) accepts a closed route/producer/directory/TAP option set. It requires exactly one successful installed test with no skipped, cancelled, failed or extra tests. It then authenticates the complete original record set, both compiler models, source/review decisions, package/runtime identities, caller bytes and all twelve Node/Chromium contexts. It reads retained records, not absolute paths reported by another machine.

The workflow uploads complete or partial output on every outcome and explicitly fails if acceptance did not succeed. No step tolerates an acceptance failure or omits a source route.

## Validation scope

The runner tests use stand-ins to check all ten producer/checker failure points and success, plus stale-output refusal and invalid invocation. Those eleven scenarios establish shell behavior, not installed Lean execution. Synthetic TAP tests check the compiler parser's rejection rules, not compiler acceptance. Separate CLI/report tests read the four [original installed runs](checked-record-php-wasm-20261011/index.json), reject substituted routes and producers, missing required records, ambiguous options and altered TAP. Workflow controls reject 25 ways to weaken tools, conditions, records or failure enforcement.

This milestone adds recurring gates. It does not claim a fresh hosted success, expand installed support to other record shapes, or change the support inventory. Exact support and consumer documentation promotion follow separately.

Local validation:

- Registered checked-record, type-surface, source-history and profile tests: 264 tests, 222 passed, no failures, 42 intentionally gated installed/compiler skips. TAP SHA-256: `78b361c42f8a4f49193b6ec2ae2fe1cbd5a051c492b17bf8bbf5144b1cd7748f`.
- Focused CI tests: 8 passed, no failures or skips. TAP SHA-256: `83aa86c146da6446cc6062b4ba9a0c52bc649484d26c93c8e5511d1e57833bd3`.
- Documentation tests: 133 passed, no failures or skips. TAP SHA-256: `425c6788172ab9cc39bce346879fca311309bdaf73b08f2dde0cf68fc1884b38`.
- Full lint, checked JavaScript typecheck, all 16 generated reference pages, actionlint 1.7.12 and Bash syntax passed. ShellCheck was unavailable and was not run.
- The compiler checker accepted the original nine-test fresh-Lean TAP recorded for the [foundation](checked-record-php-wasm-foundation-20261011.md). This was validation of the retained run, not a new compiler execution.
- The source-history ledger records three exact changes against `d65842fa5ac87dda2a364adc43c510685730027c`. Its SHA-256 is `76f460ad02e332e3987950fd9e355d86db40802fd41a87a2b926591f84fac2fe`. All 10,003 older evidence files and the 468-claim, 567-observation inventory remain unchanged.
