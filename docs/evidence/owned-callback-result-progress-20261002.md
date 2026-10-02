# Callback-result lifetime implementation

VO task 1219. This work extends the explicit ownership profile so a returned
Lean function can borrow its result from one of that function's arguments.
Installed C and npm acceptance passes on both authoring paths. The remaining
language projections and full regression integration are pending. The support
matrix has not been promoted.

## Author contract

For the tested `Owned.makeRecord` export, `arities` selects one outer argument.
The returned function accepts `Bool` and `Bundle`. This decision anchors its
result to the second callback argument:

```json
{
  "result": {
    "ownership": "lease",
    "lifetime": { "scope": "explicit", "anchor": null },
    "callable": {
      "result": {
        "ownership": "borrow",
        "lifetime": { "scope": "parameter", "anchor": "arg1" }
      }
    }
  }
}
```

Place that object under `contracts["Owned.makeRecord"]`. Callback parameter
names are local to the callback. They do not count the outer export's arguments
or the private closure handle. Reviewed contracts may use different parameter
names; the compiler reconciles their positions and types.

The selected argument's original owner controls the result lifetime, even when
the function returns captured data. Closing that owner expires the result and
its borrowed descendants. Explicit retention or copying creates an independent
owner. Empty recursive values still carry their declared owner.

Host callbacks can return a borrowed argument. The bridge converts the reply
before releasing the callback's argument owner. Escaped callback views expire
on return. A leased and a borrowed callback with otherwise identical types have
different semantic identities.

## Executed checks

- Fresh Lean metadata and generated carriers pass for ordinary and reviewed
  authoring, with host callbacks enabled and disabled. Model and descriptor
  mutations reject missing capabilities and changed anchor positions.
- The public C runtime passes four configurations under normal execution and
  address/undefined sanitizers. Each non-host run executes 627 checks and 21
  allocation failures. Each host run executes 1,846 checks and 62 allocation
  failures. Compiled mutations break the expected lifetime assertions; restored
  implementations pass. All runs finish with zero live allocations and identities.
- The wasm32 runtime and TypeScript checks pass six tests without skips. The
  runtime covers records, recursive empty results, transitive expiration,
  retained copies, host callback replies, reentry, exceptions and publication
  failures. Each runtime configuration tests nine native and ten host allocation
  failures and finishes with zero owners, allocations, identities and callbacks.
- Four production shared-loader checks pass: ordinary and reviewed authoring,
  each with the owned component or legacy Alpha component loaded first. The
  components share one runtime initialization and shut down without live handles.
- Installed npm archives pass in Node, strict TypeScript, and Chromium, Firefox
  and WebKit page, React and worker contexts. Each execution runs 43 assertions;
  each browser context repeats twice. Both ordinary and reviewed source paths
  build with an offline-installed CLI. The consumer installs the original archives
  after producer source and build output have been removed. Independent rebuilds
  and reassembly produce the same archives; 17 receipt/source mutations reject
  per authoring path. Browser execution uses only the bundled assets, with external
  network requests blocked. The consumer environment excludes Lean and native
  build tools.
- Both C authoring paths pass 134 public checks through pkg-config and
  again after relocation through CMake. The installed CLI leaves author source
  unchanged. Producer files and CLI installation are removed before consumer
  installation. Independent rebuilds and reassembly reproduce the original
  archive; 12 altered adapter receipts or generated files reject per authoring path.
- Combined wasm32 fixtures pass on both authoring paths with all four independent
  capabilities present: callback-result anchors, export-result anchors, receiver
  methods and ownership transfers. A consuming receiver expires its callback
  results and their descendants before reentry. Retained copies survive. Borrowed
  transfers reject without consuming their owner; callback exceptions after the
  handoff leave the owner consumed. Both runs finish with zero owners, allocations,
  identities and callbacks.
- Combined C/npm releases also pass through the offline-installed CLI on both
  authoring paths. The original archives install after source, producer output
  and CLI removal. Each path runs 219 public C checks through pkg-config and
  relocated CMake, then 40 JavaScript checks in Node and nine browser contexts,
  plus strict TypeScript. The test exposed a missing callback capability in the
  combined builder's native-model reconstruction; the corrected builder checks
  all four capabilities on both word widths.
- Six Wasm semantic mutations reject on each authoring path: lost transitive
  anchors, independently owned native results, unchecked anchor membership,
  missing host whole-owner unwrapping, host view expiration before reply conversion,
  and omitted unpublished-owner cleanup. Changed native code compiles and changed
  JavaScript parses before execution. Each fault fails its named assertion, not
  a syntax error or memory trap. Restoring the implementation passes all six cases.

The tests cover [C runtime](../../tests/owned-callback-result-runtime.test.mjs),
[compiler metadata](../../tests/owned-callback-result-metadata.test.mjs),
[wasm32 and TypeScript](../../tests/owned-callback-result-wasm.test.mjs),
[shared-loader coexistence](../../tests/owned-callback-result-wasm-coexistence.test.mjs),
[installed C](../../tests/owned-callback-result-c-packaging.test.mjs),
[installed npm](../../tests/owned-callback-result-npm-packaging.test.mjs),
[combined capabilities](../../tests/owned-callback-result-combinations.test.mjs),
[installed combined releases](../../tests/owned-callback-result-combined-packaging.test.mjs)
and [Wasm semantic mutations](../../tests/owned-callback-result-wasm-mutants.test.mjs).
They use `LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST=1`; the Wasm checks also require
the pinned runtime inputs and prepared shared runtime.

`npm run test:owned-callback-results` selects 33 tests in eleven files. The new
`owned-callback-results` consumer CI job requires all 33 to pass without skips or
cancellation and preserves 23 reports. Its contract tests reject omitted reports,
disabled execution and a missing summary dependency. The final run passed all
33 tests with no failures, skips or cancellation in 1,547 seconds. It also
executes the JavaScript documentation example. A supplemental combined-package
run passed in 333 seconds and records both native and Wasm compiler inputs.

The [acceptance record](owned-callback-results-20261002.json) preserves all 23
complete reports and both execution logs. Content-addressed JSON nodes share
repeated data without dropping fields. The verifier reconstructs the compiler
models, public adapters, generated Lean, private ABI and installed runtime files.
It checks the source identities, capability descriptors, public assertions,
allocation failures, semantic mutations, browser assets and source-free installs.
Repository-wide regressions and CI are separate from this acceptance record.

The consumer and author guides now document callback-local argument numbering,
whole-owner calls, host reply handoff and expiration. The source-history ledger
records 48 exact transitions from `ac6b9d4`. It preserves the earlier immutable
receipts and exposes unrecorded edits. The source inventory refreshes 658 hashes
without promoting support cells. Historical WIT CLI inventories and JavaScript
receiver mutant checks now reconstruct their original authenticated sources.

## Remaining acceptance

Run the full regression suite and commit the C/npm milestone. Implement and
verify the C++, Rust, Python,
Ruby, C#, Java/Kotlin, Perl, native PHP, PHP-Wasm and WIT/WASI projections. Update
their guides and acceptance evidence from installed results, then complete the
support-matrix audit. Run the required CI jobs after committing each milestone.

This capability does not enable retained host callbacks, asynchronous delivery,
or callback input ownership transfers.
