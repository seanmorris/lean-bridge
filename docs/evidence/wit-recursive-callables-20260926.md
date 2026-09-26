# Recursive WIT callbacks and owned closures

Plan node 1219. Base revision `7daacb859a45f3c90ba8739bd9396fa5d970813d`.

Prepared WIT/WASI archives now accept finite recursive callback arguments,
callback replies and values captured by returned Lean functions. Both ordinary
Lean sources and independently reviewed signatures pass installed execution.
This completes recursive copied-value and callback coverage across all seventeen
consumer profiles. Explicitly owned resource aggregates remain unfinished.

The [execution record](wit-recursive-callables-20260926.json) retains the original
logs, compiler receipts, installed-file identities and observed results. The
[integration record](wit-recursive-callable-integration-20260926.json) records
the exact source changes and promotes four callback cells in type inventory
0.107.0. Installed coverage rises from 4,826 to 4,830 of 6,562 cells. Other cells
keep their previous status and evidence.

## Installed packages

The package gate builds WIT-only archives for a 33-export fixture with eighteen
callable signatures and a 99-export companion with fifty-nine signatures. Each
fixture builds through both source paths. Consumers compile against installed
public headers, then run twice after removal of the author, installation headers
and archive handoff. Neither installation nor execution requires Lean tooling.

Every archive passes deterministic, compiler-free reassembly. Nine deliberately
changed and re-signed generated sources are rejected per archive. Tests preserve
the original archive hashes and all six shared-library hashes during relocation
and execution. The evidence verifier independently reconstructs source semantics,
native carriers, public headers, typed helpers and the guarded Wasmtime host from
the recorded compiler metadata and receipts.

Each copied-value consumer checks nine shapes, callback-only nested aliases,
exact large integers, UTF-8 and embedded NUL, every Option/Except branch, repeated
callbacks, captured copies, wrong signatures, stale tokens and failed outputs.
Each execution records 8,546 checks, 758 callbacks and 540 rejections. The mixed
consumer also covers all nineteen primitives, 114 primitive variants and a
sixteen-argument Unit callback, recording 4,905 calls and zero remaining native
identities. Typed callers check active close and copied results after session
closure. The published Lean definitions and C consumer compile and execute
verbatim against both package variants.

Separate installed probes interpose malformed native results without changing
the package libraries. Wrong kinds, missing buffers, noncanonical integers and
cycles retire the shared runtime. Depth and node limits leave both sessions
usable. Failed calls leave output slots unchanged.

## Sanitizers and failure injection

Compiled Lean transport checks exercise raw calls, typed calls and the complete
copied-value consumer with ASan and UBSan on both source paths. LSan runs with
leak detection enabled. A separate cold-session process reports 128 bytes in
twelve GMP allocations from Lean's numeric initialization. Exercised processes
must produce exactly that normalized report, with no additional allocation or
diagnostic. The record retains both reports and the sanitizer settings.

A synthetic native provider separately exercises 7,756 allocation failures,
10,904 rejected calls and 5,904 successes. Its 730,344 checks require zero live
allocations, no unintended runtime retirement and no sanitizer diagnostics.
A premature-release mutant fails with a heap-use-after-free diagnostic. A
missing-owner mutant fails the allocation-accounting assertion. These synthetic
checks are not counted as installed Lean execution.

## Regressions and commands

Fresh installed runs also pass for the original recursive copied-only packages,
acyclic callbacks, callback-only aliases and the existing structured examples.

```sh
npm run test:wit-recursive-generated
npm run test:wit-recursive-packages
```

The generated gate passes 10 tests, the package gate passes 3, and the focused
installed regression gate passes 4. All three runs have zero failures or skips.
The downstream WIT CI job requires both commands and retains their reports.

Consumers use the [typed recursive example](../consume/wit-wasi.md#recursive-callback-values).
Authors use the [export configuration](../publish/wit-wasi.md#export-recursive-callbacks).
The public C helpers construct WIT's finite node tables internally; the manifest
retains the original Lean declarations and proof metadata separately.

Sessions and tokens remain thread- and process-bound. Host callbacks borrow one
synchronous call; returned functions own explicitly closeable tokens. Recursive
copies enforce 128 nested levels, 262,144 expanded visits and separate 16 MiB
input/output budgets. Resource-containing aggregates, callable fields and
asynchronous operations need separate contracts.
