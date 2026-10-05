# Compiler-only ownership analysis

VO task 1219. Both ordinary `ownedAggregates` configuration and independently
authored schema-4 reviews now reach the shared ownership semantic model through
`lean-bridge analyze`. The engine compiles fresh Lean interfaces and extracts
types without emitting C, adapters or package binaries.

The public reader reconstructs the authorized resource selection, policy,
exports, arities, source hashes, interface hashes and invocation identity. It
compares the resulting Binding IR with engine output. Reviewed field order and
ownership must agree with Lean. Copied-only elaboration and build requests keep
their existing admission rules; schema-3 parser-only review analysis remains
available without a compiler.

## Executed checks

The enabled analysis and compiled-parity suites pass seven checks with no skips.
Each source path checks 51 exports, relocation and eleven authenticated mutation
rejections. Relocated CLI packages load their own analyzer and engine after the
producer package directory is removed. Their source APIs match separately
compiled `javascript-wasm-owned-v1` components. The existing compiler-analysis,
metadata, entry-module and reviewed-source suites pass 46 checks with no skips.

These tests run the pinned Lean compiler and real Wasm compilation through an
injected Nix process transport. They do not establish Nix or Docker isolation.
The required downstream ownership job runs both suites, rejects skipped tests,
retains the analysis log and propagates failures to the support summary.

The broad contract run also found an obsolete Word cleanup assertion. Like the
previous Char repair, the new checks require malformed replies to quarantine
their arena and poison the runtime without invoking native cleanup. Valid replies
and invalid host inputs still release normally. The Word, Char, scalar-codec and
runtime regression group passes 32 checks with no skips.

## Evidence and remaining work

[`owned-analysis-integration-20260928.json`](owned-analysis-integration-20260928.json)
retains the original failures, complete passing logs, current source identities
and exact reversible edits from commit `caeec40`. Earlier receipts are unchanged.
The public schemas and author documentation describe the new analysis route.
No installed-support classifications were promoted.

Owned npm isolated builds and signed publication, WIT/WASI ownership, transferred
inputs, anchored borrowed results and final cross-language acceptance remain open.
