# Native arrays of generic records

The ordinary-source package checks cover Array-valued generic-record fields,
arrays of generic records as inputs and results, and records containing those
arrays. Each consumer retains all original direct record exports, List and
Option cases, separate namespaces and nine finite specializations.

The fixture exports `pushCount`, `rowTotal`, `rowOf` and `rowBoxSum` over
`ArrayBox := Box (Array Nat)`, `BoxRow := Array NatBox` and
`RowBox := Box (Array NatBox)`. The Binding IR checks retain each alias,
its origin and the exact order of its type arguments.

## Retained executions

| Consumer | Checks per execution | Retained report group |
| --- | ---: | --- |
| C | 2,078 | First archive |
| C++ | 2,058 | First archive |
| Python 3.11.16 | 2,144 | First archive |
| Python 3.12.14 | 2,144 | First archive |
| Rust | 2,034 | Remaining-host archive |
| Ruby | 2,141 | Remaining-host archive |
| C# | 2,088 | Remaining-host archive |
| Java | 2,105 | Remaining-host archive |
| Kotlin | 2,067 | Remaining-host archive |
| Native PHP | 2,124 | Remaining-host archive |
| WIT/WASI | 2,091 | Remaining-host archive |
| Perl 5.36.3, threaded and unthreaded | 2,145 each | Corrected Perl attempt |
| Perl 5.38.2, threaded and unthreaded | 2,145 each | Corrected Perl attempt |

The [first archive](generic-record-arrays-20261009/receipt.json) retains three
successful selections at `c5e9760`. The
[remaining-host archive](generic-record-array-hosts-20261009/receipt.json)
retains six successful selections at `c92090f` and four corrected Perl
selections at `4c54801`. Together they contain 13 successful selections and
15 language/runtime observations.

Every selection builds from two author roots and compares package digests.
The harness removes author and staging inputs before offline installation,
then executes the generated public API without the compiler on the consumer
PATH. Static-language consumers compile against generated types. Array checks
include empty values, 1,000 rounds, invalid representable members, and recovery.
Rust's unsigned big integer cannot represent a negative member; its consumer
records that distinction.

The first Perl attempt failed because the consumer expected copied-graph
diagnostics from a plain-XS package. That failed result and the three selections
it prevented remain in the archive. The correction checks the exact diagnostic
against rendered and shipped XS before executing the consumer. All four retries
passed. Two never-launched retry candidates also remain recorded as unlaunched.

## Scope and recurring checks

These are local installed-package executions on glibc 2.36. They do not establish
the hosted release floor. Package archive digests are retained in reports;
the original package archive bytes are not retained in these evidence directories.
No reviewed-IR, browser, PHP-Wasm, callback, inherited, indexed or refined
generic-record coverage is added by this supplement.

The consumer workflows now run `tests/generic-record-arrays.test.mjs` for each
native profile, with both Python floors and all four Perl configurations.
Each selection requires its own nonempty `array-*.json` report and uploads it,
including on job failure. The existing base generic-record and specialization
tests remain mandatory. Workflow configuration is not a hosted pass; the first
run of this integration must still complete successfully.

The inventory attaches these reports as supplementary test evidence to the
nine existing native generic observations. It preserves their installed-package
evidence and support states, and does not relabel failed or unstarted attempts.
