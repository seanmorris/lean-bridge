# Installed checked Subtypes in PHP-Wasm

Ordinary and independently reviewed packages passed all 24 installed Node and
Chromium configurations. Each configuration ran 2,024 public checks through the
generated PHP API, including rejection followed by successful calls. Both routes
reproduced their archives in two author roots, removed source/build roots, and
installed offline before execution.

The producer was `b7706ed7be1b24c0592fa4e3f7eccbd21ba7eb5d`. The
[archive index](php-wasm-subtype-installed-20261010/index.json) has SHA-256
`fcad1416ce70d9ee17c619b8333bc18997561d44af6e188bb80de17d839aff8b`.
It authenticates 40 files: the successful run's eight original records, five
records from the failed first attempt, and 27 selected producer sources. This is
not a complete source or toolchain archive. The fixture removed package binaries
after testing; the reports retain their hashes, sizes, identities, and installed
file manifests.

## Executed API

The twelve exports use String, Nat, Int, ByteArray and UInt8 bases. Cases include
two checked arguments, mixed Fin/Subtype arguments, constructor rejection,
normalization of a 100-bit value, input preservation after rejection, two
specializations of one generic with different constructors, and a zero-argument
refined result. The fixture preserves every native PHP Subtype case and adds
eight checks.

Each route runs eight Node combinations (embedded/Composer, startup/lazy loading,
weak/strict PHP) and four Chromium combinations (bundled, startup/lazy,
weak/strict). Runtime versions are Node 22.23.2, Chromium 152.0.7977.75 and PHP 8.4.1
with 32-bit words. These versions belong to this run, not the earlier Fin runs.

The [ordinary report](php-wasm-subtype-installed-20261010/ordinary.json) hashes to
`3288e86cdfa2c746f276085c21460b23a033bc11eb763397a494f99dce7bab30`.
The [reviewed report](php-wasm-subtype-installed-20261010/reviewed.json) hashes to
`fa28f40ef8e6442991c8bd2aa8c1f5476cc759e65e7005dab0c0e1ce79df6d75`.
The [successful TAP](php-wasm-subtype-installed-20261010/run.tap) records two
passed installed gates, zero failures and zero skips in 386.5 seconds. Its hash is
`bcab754e5282489326c1ad1c04caec6ac61d18c3851fbc6cef4a7be3ab1d85b4`.

Constructor, adapter and source entry counts were not measured. Nested Subtype,
refined callback signatures, and packages mixing refinements with graph or owned
transports remain outside this acceptance. This local run does not establish a
hosted CI result or close the broader refinement task.

## Failed first attempt

The [first TAP](php-wasm-subtype-installed-20261010/failed-host-path/run.tap)
records two failures before PHP execution. The default PHP-Wasm host path
resolved beneath the side worktree, where that host package did not exist. Its
SHA-256 is `527a785ce82ab7ed2dd081832a9a1e46add000957059e2542dc5bac1c6eb2b32`.

The retry used the supported `LEAN_BRIDGE_PHP_WASM_HOST` setting to locate the
existing host package. The source revision and copied runtime were unchanged.
Both attempts retain their original runners, start/end records and runtime
manifests. The successful run kept at least 2,232 MiB free and did not trigger its
768 MiB stop floor. Paths in these records describe the local run; CI uses its
own bootstrapped workspace paths.

## Report and CI gates

`scripts/check-php-wasm-subtype-reports.mjs` requires both complete reports. It
compares constructor and specialization choices with the independent fixtures,
checks every execution count and loading phase, reconstructs package receipts,
and checks npm/Composer locks and deployed runtime/library identities. It rejects
missing reports, unknown command arguments, altered contracts, missing execution
modes and claimed dispatch counts.

The existing PHP-Wasm CI job runs fresh Lean constructor checks, both installed
routes and the paired-report checker, then uploads both original reports. The
job's failure enforcement remains in place. Fresh constructor checks also cover
wrong input/output types, unsafe/partial constructors, an out-of-scope or missing
constructor, and contradictory reviewed Fin bounds or transports. The earlier
[source-admission evidence](php-wasm-subtype-source-20261010.md) retains those
original compilation results.

This archive/CI milestone records installed evidence without changing the
type-surface observations. The source-history ledger preserves earlier report
bytes and records only exact current-source hash updates in that inventory.

The [ledger](php-wasm-subtype-acceptance-source-history-20261010.json) hashes to
`8ece9a966dee723f1dd88a396656661fba75bfa32cf79c1358a3a920c9c1256b`.
An independent Git audit verifies ten exact transitions and 108 current-source
hash updates. All 405 existing evidence entries and 507 observations retain their
acceptance claims. Report/archive/CLI tests passed 8/0/0; history and CI checks
passed 19/0/0. The eight-root integration regression passed 193 tests, failed none,
and skipped fourteen explicitly gated compiler/installed tests. Checked JavaScript
and all sixteen generated-reference checks passed. Full lint and the final ten
focused archive, report, CI and history checks also passed.

The first integration-history draft failed two checks: a binary source was
decoded as UTF-8 before hashing, and the old CI round-trip check compared commands
at different historical versions. The corrections preserve binary bytes and
authenticate the old CI version before applying its mutation controls. The
original failed log remains at `build/vo1443-subtype-acceptance-history-r1.tap`
with SHA-256 `46fc82cb50f775eac3f034d15f5ff232a935f3ceeb5af53e0b1621ded006f2f5`.
The passing rerun is `build/vo1443-subtype-acceptance-history-r2.tap`, SHA-256
`b14243531bf380f5fe97688bd9118e3950cfeeb417c6bcb1d3a58dda04049c4c`.
