# Callback-result lifetime implementation

VO task 1219. This work extends the explicit ownership profile so a returned
Lean function can borrow its result from one of that function's arguments.
Installed C, C++, Cargo, PyPI, RubyGems and npm acceptance passes on both authoring paths.
Rust's complete enabled gate passes all 13 tests without skips. Its six runtime
configurations, four installed Cargo cases and two combined releases preserve
the selected callback owner. The support matrix has not been promoted.

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

The C/npm milestone, packaging repair and C++ milestone are committed and pushed. C++ has a
[complete acceptance record](owned-cpp-callback-results-20261002.json), with all
12 enabled tests passing. Its final repository-wide regression passed 2,994
tests, with 668 explicitly gated skips and no failures.

Rust's [acceptance record](owned-rust-callback-results-20261002.json) preserves
all 12 reports and the complete 13-test gate. Both source paths build one
C/C++/Cargo/npm release with 118 Rust, 76 C++, 219 C and 40 JavaScript public
checks, strict TypeScript and nine browser contexts. Cargo consumers install
offline and run after producer sources, the CLI and package sources are removed.
Runtime checks include address/undefined sanitizers, allocation failures, Rust
panics and compiled semantic mutations. The final repository regression passed
3,002 tests, with 679 explicitly gated skips and no failures. Commit `a310013`
is pushed.

Core CI exposed a missing opt-in guard on Rust's compiler-only test. The core
job does not install the pinned Cargo toolchain. The corrected test uses the
same explicit flag as the other Rust runtime and package checks. A regression
requires enabled execution to fail when Cargo is missing; all three typed API
variants still pass with Cargo. The required Rust job continues to require all
13 tests with zero skips. The site workflow test now checks the current
`IO`/`Task` diagnostic wording in the export guide.

The downstream Rust callback job also omitted its pinned compiler installation.
Both the Rust job and the new Python job now invoke the existing Rust bootstrap;
the Python combined-release test also consumes Cargo packages. Regression checks
reject either job if that installation is removed.

Python's six runtime configurations pass on three interpreter and typing setups.
The probes use the actual malloc allocator, compare complete cold and exercised
leak reports, execute all five sanitizer controls, and reject lifetime and
report mutations. All four standalone wheel cases pass installation, strict
typing, automatic shared loading and source-free relocated execution. Both
source paths also install one C/C++/Cargo/PyPI/npm release, with 407 Python
checks per interpreter, 118 Rust, 76 C++, 219 C and 40 JavaScript checks, plus
nine browser contexts. The first complete Python gate passed 12 of 13 tests;
GCC 12's dynamic-TLS
tracking crashed in the remaining sanitizer case. The
[TLS diagnosis](python-callback-sanitizer-tls-20261002.md) records the unmapped
range and the repair. The repaired case passes on all three interpreter setups,
including controls that preserve dynamic-TLS reachability and detect a leak
after clearing its only TLS pointer. The repaired complete gate passes all 13
tests with no failures, skips or cancellation in 2,637 seconds. Its
[acceptance record](owned-python-callback-results-20261002.json) preserves all
13 reports and the complete execution log. The verifier reconstructs the
generated sources and rejects 41 forged reports. Its final repository regression
passed 3,009 tests, with 692 explicitly gated skips and no failures. Commit
`0fc33e4` is pushed, including the Rust CI setup repairs above. Remote CI remains
separate from this local acceptance record.

Ruby's generator and compiled probes pass all six source/capability
configurations under address, undefined-behavior and leak sanitizers. They
exercise GC, bounded borrow ancestry, thread and fork affinity, close races,
nonlocal exits, interrupted callbacks and allocation failures before and after
consuming handoff. A heap trace exposed an exited-thread retention cycle;
retiring the state now clears its thread reference. The public weak-key
regression and the mutation that removes this repair both execute. Six no-host
and ten host-capable mutations fail their named assertions; restored sources
reproduce the passing results and the complete cold leak baseline.

Ruby's complete enabled gate passes all 12 tests with no failures, skips or
cancellation in 2,090 seconds. All four original gem variants install offline
after producer source removal and execute again after relocation. No-host gems
pass 173 checks per installation; combined gems pass 206. Both authoring paths
also install one C/C++/Cargo/PyPI/RubyGems/npm release, with 206 Ruby, 407 Python
per interpreter, 118 Rust, 76 C++, 219 C and 40 JavaScript checks, strict
TypeScript and nine browser contexts. The
[acceptance record](owned-ruby-callback-results-20261002.json) preserves all 12
reports and the complete execution log, including the cold and exercised leak
reports and sanitized observations. The verifier reconstructs the generated
sources and rejects 52 forged reports. Repository-wide regression and remote
CI remain separate from this local acceptance record.

Implement and verify C#,
Java/Kotlin, Perl, native PHP, PHP-Wasm and WIT/WASI callback-result projections.
Update each guide and acceptance record from installed results, then complete
the package/container checks and support-matrix audit. Run the required CI jobs
after committing each milestone.

This capability does not enable retained host callbacks, asynchronous delivery,
or callback input ownership transfers.
