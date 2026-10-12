# Installed nominal Subtypes in C and C++

All four selections passed from frozen producer
`f2600a5efb6f8e0a64c0ed9f6903bf75f40ea332`. The runs started on 11 October and
finished on 12 October 2026. Each selection produced identical packages from
two independent author roots, removed those roots, installed offline, moved
the installed consumer tree, and replayed unchanged executables and sources.

| Author route | Export selection | C checks per execution | C++ checks per execution |
| --- | --- | ---: | ---: |
| Ordinary | Full, 26 exports | 4,149 | 4,122 |
| Reviewed | Full, 26 exports | 4,149 | 4,122 |
| Ordinary | Result-only, 13 exports | 2,042 | 2,042 |
| Reviewed | Result-only, 13 exports | 2,042 | 2,042 |

Each caller has recorded installed and relocated executions. Those 16 records
contain 49,420 successful assertions. The full callers distinguish the two
selected constructors on repeated record fields and variant branches, verify
accepted normalization, require Fin diagnostics even when an earlier constructor
would refuse, and exercise 1,000 late-refusal/recovery iterations. C checks that rejected
calls preserve borrowed inputs and previously populated outputs.

The standalone result-only packages contain no input-constructor configuration.
They project scalars, arrays, lists, options, products, result branches, records,
variants and aliases. Exact 100-bit Nat results cross both native APIs without
being normalized or rejected by an input constructor.

## Original records

`docs/evidence/nominal-subtype-native-20261011/` holds 146 original files plus its
index, approximately 3.2 MB. It retains the original producer logs, resource
records, both models and package-set receipts, author-input snapshots, installed
package receipts, callers and execution records. Thirty-six selected producer
source snapshots match their exact Git blobs. The runner and independent report
checker are also preserved.

The index SHA-256 is
`ce84736ea4a7e580e66eeacf49412aba3c6291e301a730a603d342ec7b57d992`.
The archive writer refuses an existing destination. Earlier evidence and the
preparation note remain unchanged.

The report checker independently reconciles each named refinement tree with the
native positional representation, authenticates the source fixture and extractor,
checks both reproduced models, and ties installed metadata back to those models.
It verifies the recorded package closure and unchanged caller identities at both
installation locations. Its tests reject 294 missing/corrupted originals and
134 coordinated changes to constructor choices, projections, runtime claims,
isolation flags and replay results. All three archive tests passed with no skips.

The archive test log is `build/vo1444-nominal-native-evidence-r1.tap`, SHA-256
`a5432284fe2a8a5ccc666df17ae112c33daa256ad31310668ed6b90d52474c66`.
The separate filtered-engine/source-history suite passed 12 tests with no skips;
its log is `build/vo1444-nominal-native-boundary-r1.tap`, SHA-256
`fe031fef6031693a3c09839fc22f51f92fbecf17415b3d46ff5df53b3a171223`.

The final registered component, author, source-history, support-inventory,
documentation and test-registration regression passed 179 tests with no failures.
Ten expensive cases were explicitly skipped: two existing compiler/source cases
and four npm plus four native installed gates. The four native gates passed
separately in the archived runs above. The regression log is
`build/vo1444-nominal-native-archive-regression-r1.tap`, SHA-256
`9959c90d1a602e487457bd68936004c725863024fc0903e53225d344e0e60490`.

## Runtime and remaining work

The observed runtime is Linux x64/glibc 2.36, with GCC 12.2 and Lean 4.32.2.
This is local acceptance, not a hosted release-floor result. Native package
archives and full toolchain closures are not retained; their original receipts
and hashes are retained. These callers do not measure constructor/source entry
counts or memory usage.

The runs were serial, on one CPU with nice 19, idle I/O and one Lean thread.
`MAKEFLAGS=-j1` was set, but GMP explicitly invokes `make -j2`; those jobs shared
the same CPU. Every run remained above the configured disk and memory floors.
Successful temporary installations were removed after recording their results.

This archive adds no support-inventory cells. Next: promote the tested C/C++
parameter, result and nominal-field scope and update their consumer documentation,
then add Perl and the remaining native hosts. Recurring installed CI gates,
measured entry probes, other primitive-base nominal Subtypes, browser/PHP-Wasm
contexts, callbacks, owned values, recursive graphs and broader generic Subtypes
remain open. VO #1444 and #1220 are not complete.
