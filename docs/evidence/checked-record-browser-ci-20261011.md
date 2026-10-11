# Required installed checked-record browser CI

VO #1446, within #1220. `.github/workflows/checked-record-browser.yml` runs on pushes, pull requests and manual dispatch. Its dedicated 180-minute job leaves the existing 330-minute Node consumer job unchanged.

The job checks out full Git history with persisted credentials disabled, installs pinned compiler tools and Chromium/Firefox/WebKit, builds the locked component engine and shared Wasm runtime, and invokes `scripts/run-checked-record-browser-ci.sh`. The acceptance step has a 60-minute limit. Failures remain failures, including a skipped or cancelled acceptance step. An always-run upload preserves all route records and engine/runtime logs for 30 days.

## Required selections

The shell executes these selections sequentially:

1. `ordinary-source`
2. `reviewed-ir`
3. `result-only-ordinary-source`
4. `result-only-reviewed-ir`

Each runs the actual installed-package producer with Node, strict TypeScript, all three browsers, page/React/worker consumers and lifecycle checks enabled. The shell records the checkout's producer commit, refuses an existing output directory before opening logs, preserves combined stdout/stderr, and stops if the producer or report checker fails.

`scripts/check-checked-record-browser-ci.mjs` accepts only the named route, exact producer commit, record directory and original TAP. It requires one complete test, one pass, zero failures/cancellations/skips/todos, and the exact installed test name. It then runs the full existing installed-report verifier, including both compiler builds, checked constructors, receipt/caller identities, Node relocation, strict TypeScript and browser lifecycles. It reads retained files rather than paths reported by the original producer.

## Verification

The checker and CLI accept all four unchanged local installed archives from `checked-record-browser-20261011`. Wrong routes and producer commits, missing compiler/caller/browser records, incomplete or duplicated TAP summaries, skipped tests, and renamed selections are refused.

Nine real-shell stand-in scenarios check the four-route success sequence and each producer/checker failure. They verify that partial records and original stdout/stderr survive, later routes do not start after failure, and a second invocation cannot overwrite earlier output. These are shell controls, not new installed executions.

Workflow tests refuse 22 changes that bypass acceptance, remove a browser or build prerequisite, substitute an ambient engine/runtime, narrow uploaded records, hide missing artifacts, or disable final enforcement. Actionlint 1.7.12 validates the workflow, including its shell commands.

The source-history ledger records three exact registration/history changes against `86406da5c59d790b8abfecd14af03853aaf9d276`. The existing consumer workflows, earlier evidence and support inventory remain unchanged. Fresh hosted results and exact support/documentation promotion remain pending; this CI wiring does not establish PHP-Wasm or broader checked-record support.

The complete four-root regression passed 201 tests with zero failures and 51 explicit compiler/installed gates skipped. Its original TAP SHA-256 is `9e188f08e78f68515111ae6ceb1687c23b9f2f5258aeacd61a195366d07cf6ba`. Focused CI and history checks passed nine tests with no skips, TAP SHA-256 `884dc56b84c6e5136fb3eaf34fc52d683ce4619dd1b8e28f13110f8e448973b0`. Documentation passed 133 tests with no skips, TAP SHA-256 `b9edc648e59dae55567ce979cea1c2383fe399cab62cf9a268519bef642ca513`. Full lint, typecheck, all 16 generated-reference checks, actionlint and shellcheck passed.

The independent audit verifies all 16 milestone files, restores each exact predecessor source, and preserves all 9,766 earlier evidence files and the byte-identical 464-claim/555-observation inventory. The immutable ledger SHA-256 is `b17b034622d19a38ef2b1496f3d0408beb341da60521630c961c4ce6b5cb094a`.
