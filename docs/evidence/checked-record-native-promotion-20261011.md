# Installed checked records on native hosts

The support inventory records checked-record inputs and results for Python,
Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI on ordinary-source and
independently reviewed routes. This adds 32 cells, 32 observations and 16
installed evidence entries. Existing C/C++ and Node observations are unchanged.

## Original installed evidence

| Archive | Producer | Executions |
| --- | --- | --- |
| [Python](checked-record-python-hosts-20261010/index.json) | `5a730e4` | Python 3.11.16 and 3.12.14, four routes each |
| [Ruby and JVM](checked-record-ruby-jvm-20261010/index.json) | `71ef6f0` | Ruby, Java and Kotlin, four routes each |
| [Remaining native hosts](checked-record-remaining-hosts-20261010/index.json) | `c9d11f7` | .NET, native PHP, Rust and WIT/WASI, four routes each |

Each host passed ordinary-source, reviewed-IR, ordinary result-only and reviewed
result-only packages. Full callers ran 9,024 checks per host; standalone
result-only callers ran 1,002. Every run reproduced two author builds, removed
the author sources before offline installation, moved the installed package and
repeated the unchanged caller. Kotlin called the generated Kotlin API. Native
PHP ran weak and strict modes.

The promotion authenticates all three archive indexes and every indexed artifact,
then runs their independent report validators. Each input observation references
the matching full caller. Each result observation references both that caller
and its standalone result-only package. Python observations retain both version
floors. The failed PHP tool-selection attempt stays in its original archive and
is not selected as a passing execution.

## Supported values

The installed fixtures cover `Interval`, `Sized 3` and `Bounded 0 101`, with
runtime payload fields and erased `Prop` fields. The selected safe Lean
constructor checks each input. Tests cover per-parameter constructor choices,
normalization, mixed arguments, wrong lengths, invalid intervals, bounds above
64 bits, unchanged caller data and 1,000 rejection/recovery cycles. Results
project their payload without transporting proof values.

These observations do not establish nested, refined, recursive or inherited
checked records, general dependent payloads, other index kinds, zero-payload
records, callbacks or owned transports. Perl, PHP-Wasm and browser checked-record
acceptance remains separate work. The runs used local glibc 2.36; they do not
establish hosted release-floor acceptance. Entry counts were not measured.
The archives contain original reports, selected source snapshots and package
digests, not package binaries or a complete toolchain closure.

## Inventory and regression controls

The [source-history ledger](checked-record-native-promotion-source-history-20261011.json)
records exact transitions from `0ff897e`. The updater refuses an unrelated HEAD,
a committed ledger and unrecorded inventory changes. Older evidence files and
observations retain their contents; only recorded current-source pins change.

Registered tests compare every inventory cell before and after promotion,
authenticate both Python floors, distinguish input and result-only references,
reject altered references and archive bytes, reject overlapping or repeated
promotion, and check the eight consumer guides against generated tables.

The independent audit verifies 14 exact source transitions and 62 source-pin
updates. It preserves all 420 older evidence claims, 519 observations and 6,482
older evidence files. Ledger SHA-256:
`022b0f0d207d056a3602c66497d415d428de9fa972a7802adb6d7199b8ae6b41`.

The first eight-root regression found eight stale ordinary-host coverage
assertions, each expecting 92 supported copied-value cells instead of 94. The
correction requires the exact new checked-record evidence and still excludes
field and callback positions. Its original failing log remains at
`build/vo1446-native-promotion-registered-r1.tap`, SHA-256
`d73ecda0186177a7891a73eac111a9d458e2c65891d353ccf95047941168c90a`.

The corrected eight-root regression passed 210 tests with zero failures and
18 explicit compiler/installed gates skipped (228 total). TAP SHA-256:
`9cefe378ab82a11c0f37856e064ce398367f0473d76bcba09add81e053b0267c`.
Focused promotion/history checks passed nine tests without failures or skips.
Full lint, the final changed-source lint check, checked JavaScript and all 16
generated reference pages passed. These source regressions do not replace the
original installed executions linked above. The prepared native checked-record
CI runner still needs workflow integration.
