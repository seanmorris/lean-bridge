# WIT/WASI original-owner borrowed results

VO 1219. This milestone adds parameter-anchored results to the native-backed
WIT/WASI package. It does not add a standalone WASI command or support arbitrary
caller-owned Wasmtime stores.

## Ownership contract

A borrowed result follows its declared input's original result owner. Releasing
or consuming that owner expires resource views and descendants immediately.
Empty arrays, empty Lists, absent options and empty nested collections retain
their anchors. Retain and typed copy helpers create independent owners; resource
equality compares canonical identities. Active calls pin storage until they
unwind without extending the semantic lifetime.

Both the native import and final public result publication check the original
anchor. Component Model owned handles carry transport storage; they do not
replace the original owner with an independent snapshot.

## Required acceptance

Run `npm run test:owned-wit-borrows`. The enabled gate requires eight passing
tests with no skipped or cancelled tests and six execution reports:

- Ordinary and reviewed compiled Lean paths exercise all 26 exports, including
  19 borrowed results and four consuming exports. Instrumentation counts actual
  Component Model calls, native imports and Lean entries.
- Separate ordinary and reviewed packages with 22 exports and no input transfers
  exercise four empty shapes, transitive expiration, the 128-level borrow limit
  and allocation failures.
- Native allocation faults cover borrowed calls and failures before and after
  consuming handoff. ASan/UBSan runs compare against the untouched startup leak
  baseline and require zero remaining bridge allocations and native identities.
- Nine compiled semantic mutants must fail the original consumer assertions.
  Each adapter is restored, compiled again, and checked against the baseline.
- An offline-installed CLI archive builds ordinary and combined reviewed C/WIT
  releases. Every installed CLI source matches its archive inventory. The CLI
  verifies the final handoff without the producer tree, then is removed before
  downstream installation.
  Reassembly and an independent rebuild must reproduce the original archives.
  Consumers install offline after removal of the producer sources and outputs,
  then compile through pkg-config and relocated CMake package metadata.
- Installed checks reject forged ownership metadata, altered generated sources
  and conflicting loaded libraries. The documented borrow/retain example runs
  against the installed archive.

CI retains the logs and all six reports. The source-bound JSON receipt records
the completed gate, compiler inputs, package inventories and exact source edits.
Historical receipts remain immutable. Source-hash refreshes do not promote
unrelated installed-support cells.

## Remaining work

Receiver and callback-result anchors remain unsupported. This milestone does
not claim Docker qualification or completion of the final cross-language audit.
