# Installed Ruby, Java and Kotlin checked records

Producer commit `71ef6f081bfab86e9556545250a44bb04c420604` builds each
selection from two independent author roots. Ruby, Java and Kotlin then
use their ordinary generated APIs after author removal and offline
installation. Every consumer runs again after physical installation
relocation. Kotlin imports the generated Kotlin API, not the Java facade.

| Package route | Java checks | Kotlin checks | Ruby checks |
| --- | ---: | ---: | ---: |
| Ordinary source | 9,024 | 9,024 | 9,024 |
| Independently reviewed source | 9,024 | 9,024 | 9,024 |
| Ordinary result-only | 1,002 | 1,002 | 1,002 |
| Reviewed result-only | 1,002 | 1,002 | 1,002 |

All four producers passed one installed test without failures or skips.
The twelve selections total 60,156 checks before relocation and repeat
those checks after relocation. The minimum recorded free space was
1,754 MiB; no producer reached the 768 MiB stop floor, and every producer
met the 2,048 MiB start floor.

The full callers check both Interval arguments, closed-length Triple
records, separate normalizing constructors, Percent bounds, values above
64 bits, unchanged caller arrays and independent result storage. Each
checked constructor has 1,000 rejection/recovery pairs. A standalone
result-only package contains no checked-input export.

## Records and independent checks

The report checker verifies both build models against the independently
authored API, exact constructor selections and payload layouts, ordinary
versus reviewed authority, reproduced package identities and caller bytes.
It binds every Ruby and JVM package receipt to the original model, source
identity, runtime identity and local glibc floor.

Ruby checks the exact gem payload, cached archive and installed gemspec
inventory. JVM checks the original JAR, consumer source, isolated compiled
output and package file inventory. Manifest extensions, service discovery,
unexpected classpath files and changed Kotlin namespace/version metadata
are refused. These checks read recorded bytes, never historical absolute
installation paths.

All four routes passed the independent checker and 73 coordinated
report-mutation controls per route. The [archive index](checked-record-ruby-jvm-20261010/index.json)
authenticates 120 original artifacts: 88 execution records, 29 selected Git
source snapshots, the runner and queue source, and the queue log. Its SHA-256
is `c35c6f25d21296610be8a4e9904deee893d7117a93a10e24b4bc3f288fabc1f5`.

The registered tests reject 242 byte-corruption attempts across the 120
artifacts and index. Their 312 semantic controls include the 292 report
mutations above and 20 coordinated model/identity mutations. Focused
archive/history checks passed six tests without failures or skips. TAP
SHA-256: `af9e0c3f642968482f0ebf1fff36d8af40ec49a8f74df15a9e166a92c1d82601`.

The final seven-root regression passed 291 tests, failed none and skipped
21 explicit compiler/installed gates. Its TAP is
`build/vo1446-ruby-jvm-regression-r1.tap`, SHA-256
`653d2094b055b0594137ed54e343e52a12af34e24892d0bda2594432110ac8a9`.
Full lint, final changed-file lint, checked JavaScript and all 16 generated
reference checks passed. Two draft lint runs found formatting errors;
the corrected drafts passed before the regression.

An independent audit compared every archived artifact with its original
run file or producer Git blob. Audit SHA-256:
`698925f31adf50ade37631b47276cf328c4c2c35e369f12e3e7e6d9c9b5f4569`.
The separate Git audit verifies seven exact source transitions, 18 current
source-pin updates and all 6,202 older evidence files unchanged. Its SHA-256
is `16e492f03afc04efbbcd96b6d700e1a255c9a5ffecd478523ecd25848f7de6ac`.
The [source-history ledger](checked-record-ruby-jvm-source-history-20261010.json)
has SHA-256 `2173c8a6e6c400714d040177791a5d41833bad07f158a654de6b3f46f8b3a889`.

The 420 evidence claims and 519 support observations keep their previous
claims. The author guide links these installed results; support-inventory
promotion and required installed CI gates remain separate work.

## Scope and remaining work

These are local glibc 2.36 executions. They do not measure Lean source,
constructor or adapter entry counts, and they do not establish hosted
release-floor acceptance. The archive preserves selected producer
sources and package hashes, not package binaries or a complete toolchain
closure.

Rust, .NET, native PHP and WIT/WASI still require installed checked-record
acceptance. Perl, PHP-Wasm and browser checked records remain separate
gates. Nested, refined, recursive and inherited records, dependent runtime
payloads, other indices, zero-payload decisions and callback/owned
combinations remain in #1220's original scope.
