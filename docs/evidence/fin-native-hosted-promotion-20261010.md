# Hosted native Fin products and fields

The inventory now cites all 78 original hosted reports from `ff71335c762628da47887bfd4f208e62c39b94b7`. They contain 90 installed-consumer observations across C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP, WIT/WASI and Perl. Ordinary source and independently reviewed IR remain separate. Python 3.11.17 and 3.12.15 have separate commands and execution records; Perl 5.36.3 and 5.38.2 each retain threaded and unthreaded results.

The [original receipt](fin-native-hosted-20261010/receipt.json) authenticates reports against their GitHub artifact ZIP members, successful job logs, commands, fixture trees, consumers, review contracts and package identities. Hosted run 37969725049 succeeded. These executions use configured glibc floor 2.38 with no local override; they do not measure execution on a minimum-libc machine. Consumer compilers remain available where the host language needs them; Lean and producer tools do not.

## Inventory changes

The [promotion](../../tests/helpers/fin-native-hosted-promotion.mjs) adds 78 installed evidence entries and supplements 31 existing observations without replacing their earlier reports. Eight new field cells cover Java, Kotlin, native PHP and Perl on both source routes. The inventory has 401 evidence entries and 507 observations.

Only C measures adapter/source dispatch in these hosted product and field reports. Every other host remains explicitly unmeasured here. Earlier scalar, container, callback and inherited-field observations retain their own evidence and measurement scope.

The [source history](fin-native-hosted-promotion-source-history-20261010.json) preserves the exact predecessor at `216b10cde1a0f7882ce155169339305416fd2499`. Original reports, ZIPs, logs, receipts and older source ledgers are unchanged. Only the named support observations and their corresponding current-source pins change.

## #1441 acceptance

| Requirement | Evidence |
| --- | --- |
| Exact Fin 0, Fin 1, Fin 10 and wider-than-64-bit bounds | The original `FinProducts` fixture and eleven public consumers exercise endpoints, invalid bounds and empty/absent Fin 0 values. |
| Both product positions and active Except branches | `first`, `second`, `wide`, `okOnly`, `errorOnly` and `both`; inactive payloads retain ordinary values. |
| Array/List/Option and transparent aliases | `nested`, `aliased`, `FinProductArrays.rows` and `reversed`, including invalid first, middle and last elements. |
| Valid results, input preservation and recovery | Bounded results and 1,000 valid/invalid pairs per consumer fixture. Rejected inputs are compared before callers restore them. |
| Checked construction before source dispatch | Compiled checked Lean adapters and generated caller-bound checks; archived C counters include nonzero positive controls. Other hosts do not borrow those counters. |
| Independently authored reviewed bounds | Both installed source routes and the hosted C-family fresh-Lean mismatch tests. Review metadata must match compiler-owned constraints before output. |
| Reproducible, source-free packages and supported runtime selections | Original two-root package reports, source removal before offline installation, both Python selections and four Perl ABIs. |
| Recurring CI | Consumer and Perl workflows run both product families on both source routes, require their report files and propagate failures. |

## #1442 acceptance

The original `FinRecords` fixture and installed consumers cover plain records, nested records, active variant cases, heap-backed fields before a failing bound, absent Fin 0 options, inactive Fin 0 variant cases, bounded results and Array/List/Option/Prod/Except composition. Empty arrays and lists contain `Tile`, whose field is Fin 5, not Fin 0. All thirteen exports execute on both source routes in the eleven-profile hosted matrix.

The generated native adapters use private erased mirrors and checked conversions to construct the real Lean values. Nominal Binding IR definitions retain the field/case constraints. Public callers preserve inputs on failure and recover after rejection. C records adapter/source controls; other hosts retain unmeasured dispatch. Complete nested field, case and element-index diagnostics have separate installed observations at `af1dcbf`: [reviewed C/C++ and Python 3.11](native-fin-diagnostic-installed-20261010.md), [Python 3.12, Ruby and JVM](native-fin-diagnostic-installed-20261010/python312-ruby-jvm.md), and [Rust, .NET, native PHP and WIT](native-fin-diagnostic-installed-20261010/rust-dotnet-php-wit.md). Those local runs use glibc 2.36; they do not replace the older hosted environment records.

The [separate fresh-Lean run](fin-record-review-omission-compiled-20261010/index.json) passes all seven independently changed reviews: tightened fields, moved fields, a loosened nested bound, a tightened variant field, a loosened Fin 0 case, omitted record constraints and omitted variant constraints. Every case requires `reviewed-ir-source-mismatch` and an absent output directory. This adds the two omission controls missing from the earlier hosted five-case suite.

Consumer and Perl workflows retain the installed record gates and both required reports. The new compiled omission checks use the existing C-family fresh-review gate.

The original #1442 acceptance also requires empty collections involving Fin 0 fields. The current fixture does not execute that case. Add a separate supplemental fixture covering Array/List fields of Fin 0 and arrays/lists of a record with a Fin 0 field, including empty successes, populated refusals, unchanged inputs and recovery on both source routes. Keep #1442 open until the eleven native profiles, both Python selections and four Perl configurations execute those checks. Existing reports remain evidence for the cases they ran.

## Verification

The promotion regression passes 150 tests with ten explicitly gated installed/compiler skips. The docs and inventory suite passes all 151 tests. Full repository lint, checked JavaScript and all sixteen generated reference pages pass. A separate Git comparison authenticates all 23 predecessor transitions, exactly 90 old source-pin refreshes, and the complete inventory against the reviewed promotion. No original execution report, receipt or earlier history ledger changed.

## Remaining #1220 work

These observations cover closed structural Fin and plain nominal fields. They do not add PHP-Wasm, reviewed Subtype, checked/indexed records, recursive or generic Fin fields, or other refinement transports. The stricter [native container foreign-carrier matrix](fin-container-foreign-measured-20261010/index.json) is a separate local observation.

The current integration run remains separate from the successful hosted producer above. Its unresolved JVM debugger failure and any pending jobs must not be presented as passing CI.
