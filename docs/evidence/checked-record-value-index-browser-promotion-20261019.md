# Hosted checked-record value indices in npm and browsers

The public inventory now records installed acceptance for closed `Bool`, `String`, and `Nat` indices at top-level copied checked-record parameters and results in all five npm profiles: Node JavaScript, strict TypeScript, browser JavaScript, React, and dedicated workers. Ordinary Lean source and independently reviewed Binding IR both pass. Full packages establish parameters and results; standalone result-only packages establish results without checked-input metadata.

The promotion is bound to GitHub Actions run `39201330491`, job `117894730442`, artifact `12164886878`, and producer/npm-checker/consumer/checker revision `79359306d2e50a5893affe04cafed95d54166b88`. The [archive index](checked-record-value-index-browser-20261019/index.json) authenticates the original API records, workflow logs, split artifact ZIP, package receipts, TAP streams, destructive controls, reports, browser observations, and 1,877 frozen source files. Its independent verifier reconstructs the ZIP and replays all four checkers byte for byte.

## Promoted cells

The four retained routes are:

- ordinary source, full API;
- reviewed IR, full API;
- ordinary source, result-only API;
- reviewed IR, result-only API.

The full routes support `parameter` and `result`; the result-only routes support `result` only. Across five profiles and two source paths, this changes exactly 20 inventory cells. Checked-record fields and callback positions are unchanged. Evidence for nested, inherited, and recursive checked-record shapes remains separately scoped and is not widened by this promotion.

## Exact index boundary

The fixture retains both `Bool` values; `String` indices `"ab"`, `""`, and `"λ🌱"`; and `Nat` indices `0` and `340282366920938463463374607431768211457`. Indices are authenticated compile-time metadata, never host object fields. The installed objects contain only proof-free runtime payloads.

Open or opaque indices are rejected during analysis. Reviewed metadata also rejects noncanonical decimal and Boolean spellings, malformed Unicode scalar text, omitted or changed instantiations, and a value recorded under the wrong kind. `Int`, `Char`, fixed-width and platform-width integers, `Fin`, functions, proofs, instances, and other index kinds require separately reviewed representations. This archive does not promote fields, callbacks, owned positions, value-carrying dependent payloads, zero-payload checked records, or another host.

The required [recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/checked-record-value-index-browser.yml) runs on pushes, pull requests, and manual dispatch. It serializes all four selections, builds the pinned shared Wasm runtime, executes Node and strict TypeScript consumers, and runs Chromium, Firefox, and WebKit page, React production/StrictMode, and worker consumers. Each route records 12 browser executions and 51 lifecycle observations.
