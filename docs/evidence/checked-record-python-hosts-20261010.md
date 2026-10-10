# Installed Python checked records

Python 3.11.16 and 3.12.14 passed all four checked-record package routes at
producer commit `5a730e4a970ee43485553b6357ae68e4fbfab827`. Each run used
the ordinary generated Python API, two independently built author roots,
offline installation after author removal, and the unchanged caller after
physical relocation of the installed package.

| Package route | Python 3.11 checks | Python 3.12 checks |
| --- | ---: | ---: |
| Ordinary source | 9,024 | 9,024 |
| Independently reviewed source | 9,024 | 9,024 |
| Ordinary result-only | 1,002 | 1,002 |
| Reviewed result-only | 1,002 | 1,002 |

These counts total 40,104 checks before relocation. Every run repeated its
checks after relocation. All eight producers passed one installed test
with zero failures or skips. Both Python versions reproduced identical
model, Binding IR, receipt and package archive hashes for each route.

The full callers exercise Interval arguments, the closed-length Triple
record, independent normalizing constructors, Percent bounds, values above
64 bits, unchanged caller arrays and independent result storage. Each of
four constructors has 1,000 rejection/recovery pairs. Standalone result-only
packages do not depend on registration of an input refinement.

## Original records and verification

The [archive index](checked-record-python-hosts-20261010/index.json) pins
168 original artifacts: 144 execution records, 21 selected producer source
snapshots, the runner, and the Python 3.12 queue source and log. Its SHA-256
is `ed3430414be55f41b66c03192d038176c7ead292c724045a34436fc0885edd97`.
An independent audit compared every archived byte with its original run
file or producer Git blob.

The registered archive checker validates both author models against the
independent fixture, exact per-export constructor selections and payload
trees, ordinary/reviewed authority, package identities, Python versions,
closed-environment records, source removal and relocated replay. It checks
original TAP results, runner selection, disk observations and completion
records. Historical absolute paths describe the original environment;
the checker reads only archive-relative files.

Corruption controls alter all 169 files, including the index, by appending
a byte and changing one byte without changing length: 338 refused inputs.
Separate semantic controls coordinate changes across individual and
combined reports, recompute changed model identities, alter constructor
requests and payload layouts, and weaken installation or replay facts.
They also reject changed callers, noncanonical records and wrong Python
floors. These controls exercise the independent validators, not installed
Python execution.

The source-history update preserves every older evidence file and all 420
evidence claims and 519 observations. It changes only current source pins
for the updated author guide. The author table links this archive; support
inventory promotion and recurring installed CI gates remain separate work.

## Execution scope

These are local Linux runs with glibc 2.36. They do not measure Lean source,
constructor or adapter entry counts. The archive retains package hashes,
not package binaries or a complete toolchain/input closure. No hosted
release-floor acceptance follows from these runs.

The minimum free space across all eight producers was 2,089 MiB. No run
reached the 768 MiB stop floor, and every run met the 2,048 MiB start floor.

The first archive/history focused run passed the three archive tests but
failed two history tests because the draft ledger had not been written.
The writer had correctly refused a draft requiring source-pin changes
when its four original changed files had no inventory pins. That draft
was corrected and the seven-root regression passed 285 tests with zero
failures and 21 explicit installed/compiler skips. These were checker
development failures, not failed installed Python runs. Original logs
remain under `build/vo1446-python-archive-*`.

After updating the author guide and its receipt-backed tests, the final
seven-root regression again passed 285 tests, failed none and skipped 21
explicit compiler/installed gates. Its TAP is
`build/vo1446-python-archive-regression-r3.tap`, SHA-256
`d3888216e400a4323706bd5538f041575247eea2653dacde9e8d9e313eb9c440`.
Full lint, checked JavaScript and all 16 generated reference checks passed.

The independent Git audit verifies seven exact source transitions, 18
source-pin updates and all 6,031 older evidence files unchanged. The ledger
SHA-256 is `09f90b179bc965f4e262843ab680c86764eb44307ebfaad0ab0bee2ed814b31c`.
The audit is `build/vo1446-python-history-audit-r2.json`, SHA-256
`2b21f5ce7db176505f156337ca12de10f1ee27803ad1db688216342920731ef0`.
The separate 168-artifact comparison is
`build/vo1446-python-archive-audit-r3.json`, SHA-256
`32c09dda1bb44542a43599e4f5ebc6bd5a5aaab6ef31ea1449cc2df63dbcdd39`.

## Remaining work

Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI have generated
adapters and source-checked callers; their installed checked-record runs
remain pending. Perl, PHP-Wasm and browser checked records have separate
gates. Nested, refined, recursive and inherited records, dependent runtime
payloads, other indices, zero-payload decisions and callback/owned
combinations remain in #1220's original scope.
