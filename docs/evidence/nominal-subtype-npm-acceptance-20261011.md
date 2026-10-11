# Installed nominal Subtype npm acceptance

All four ordinary/reviewed and full/result-only npm cases passed at producer
`fab6d1b1c054a7a818bf70e4be84c80d7e8ec5c7`. This records the installed execution
that was still pending in
[the harness checkpoint](nominal-subtype-npm-harness-20261011.md).

## Observed executions

Each case built the package in two independent author roots and reproduced the
Binding IR, receipt, component archive and runtime archive. The harness removed
both author roots before installing the archives offline with a Node-only PATH.
It checked installed files against the verified archives, ran the JavaScript
caller and strict TypeScript examples, moved the installed consumer directory,
and replayed unchanged callers after confirming the old location was absent.
Package and caller bytes remained unchanged around both executions.

| Selection | Exports | Checks per execution | Expected refusals per execution | Installed and relocated runs |
| --- | ---: | ---: | ---: | --- |
| Ordinary, full | 26 | 3,172 | 1,032 | Passed |
| Reviewed, full | 26 | 3,172 | 1,032 | Passed |
| Ordinary, result-only | 13 | 2,078 | 0 | Passed |
| Reviewed, result-only | 13 | 2,078 | 0 | Passed |

The eight caller executions performed 21,000 checks and observed 4,128 expected
refusals. These counts include repeated recovery loops. All executions used
Node 22.23.2 on Linux x64. TypeScript ran with `--strict --noEmit` and
`--skipLibCheck false`.

The full callers distinguish two valid constructors at separate uses of the
same nominal type: 40 becomes 41 or 42. They cover repeated record fields,
variants, aliases, optional array elements, result branches, late constructor
refusals, mixed Fin guards and unchanged rejected inputs. Result-only callers
exercise copied values above both input-constructor limits, empty branches and
100-bit Nat values without choosing an input constructor.

All four producers ran serially at nice 19, idle I/O priority and CPU 3, with
single-threaded Lean and make settings. Resource guards did not stop a producer.
The fourth producer waited for host load to fall before starting.

## Retained originals and verification

[The immutable archive](nominal-subtype-npm-20261011/index.json) retains 138 files
plus its index: original producer start/end records, TAP logs, both builds'
compiler plans and receipts, source and consumer files, installation and replay
observations, the runner, the report checker, and 34 selected producer source
snapshots. Snapshot bytes match Git at the producer revision.

The index SHA-256 is
`34f4069f2ba682bcd29e9a4a2da0fd1483449726f06a5f17a7705b3676b181c0`.
The archive retains receipt identities and installed-file hashes, not package
binaries or complete toolchain closures.

`tests/helpers/nominal-subtype-npm-report.mjs` reconciles the original reports
with the independent fixture contracts, compiler plans, receipts and observed
runtime. The evidence suite checks all four selections, 278 missing/corrupted
original controls and 110 coordinated claim/compiler-contract controls. Its
three tests passed with no failures or skips. The log
`build/vo1444-nominal-npm-evidence-r1.tap` has SHA-256
`a182ce6aa04f272ee0f89f7a23dbdba7b3dd528699d628cf977ab093c95a4427`.

The evidence tests are registered through the existing component-refinement
test root. The registered component-refinement and test-profile regression
passed 35 tests, with zero failures and five explicit skips: the existing
generated-Lean source gate and the four installed gates. Those four gates passed
separately in the executions archived here. The regression log
`build/vo1444-nominal-npm-archive-regression-r1.tap` has SHA-256
`a52df867551361272c03ee4d62c06ffeb234e5b678458ed2685e279d9b56a88f`.

## Remaining work

This archive records only the tested nominal fixtures on Node 22.23.2. It does
not measure Wasm constructor/source entry counts, establish another runtime
floor, or establish native, browser, React, worker or PHP-Wasm acceptance.
Callbacks, owned and recursive values, and broader generic Subtypes still need
their own implementations and acceptance. VO #1444 remains open.

This milestone changes no production compiler source, support inventory or
previous evidence. The author guides and inventory still need a separate,
source-history-aware update for this exact Node result. Required recurring CI
coverage and the remaining consumers are also pending.
