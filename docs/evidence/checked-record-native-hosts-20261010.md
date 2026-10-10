# Checked-record native host adapters

VO #1446 extends top-level checked-record package generation to Python, Rust, Ruby,
.NET, Java, Kotlin, native PHP and WIT/WASI. These adapters use the existing verified
C payload mirrors. Each input keeps its selected Lean constructor, including two
different constructors for the same record type. A Lean-produced result projects
payload fields without requiring an input constructor.

The shared native refinement documentation describes rejection, normalization,
unchanged caller records and result-only exports. It also removes the stale claim
that reviewed Subtype APIs are unsupported.

## Conversion audit

| Host | Payload conversion |
| --- | --- |
| Python | Typed ctypes records; scoped input buffers; independent output copies. |
| Rust | `repr(C)` mirrors; borrowed inputs; scoped scratch and RAII output cleanup. |
| Ruby | Stored record fields copied into scoped buffers; fresh output records. |
| .NET | Typed native structs; scoped input storage; generated output records. |
| Java and Kotlin | Shared Java record and FFM conversions; scoped input storage. |
| Native PHP | Initialized field checks, typed FFI records and independent outputs. |
| WIT/WASI | Named Component Model records; exact field checks and native C calls. |

The [generator tests](../../tests/helpers/checked-record-native-host-tests.mjs)
compare complete conversion source and record layouts against unconstrained records
with the same payload fields. That comparison verifies transport reuse, not permission
to erase an actual Lean contract. The compiled C validators and Lean adapters retain
responsibility for checking the selected constructors. No converter, ABI layout or
compiler lowering changes in this milestone.

Both ordinary-style and independently reviewed generation inputs cover `Interval`,
`Sized 3` and `Bounded 0 101`, multiple checked parameters, per-site constructor
choices and result-only packages. Invalid or missing constructor metadata fails.
The ordinary-style test input reproduces ordinary parameter naming; it does not
replace fresh Lean compilation.

## Acceptance still required

These are source and generation checks. This milestone adds no installed support
observations. Each host still needs ordinary and reviewed two-root builds,
source-free offline installation, relocated replay, rejection and recovery, exact
diagnostics, normalization and unchanged caller-data checks. Result-only packages
need their own installed coverage. WIT source generation uses placeholder component
bytes in these tests and makes no executable-component claim.

Existing [C/C++ and npm acceptance](checked-records-20261008/receipt.json) remains
unchanged. Perl, PHP-Wasm and browser execution have separate outstanding gates.
Nested, recursive and inherited checked records, other indices, dependent runtime
payloads, zero-payload records, callbacks and owned-value combinations remain within
the original #1220 scope.

## Verification

The nineteen-root regression passed 855 tests with zero failures and 50 explicit
compiler or installed-package skips. The first run's single documentation-wording
failure remains in its original log; the corrected run is
`build/vo1446-native-host-source-regression-r2.tap`, SHA-256
`680969d3d7921c5288b3c1a2689efd43d652a1727acc88c0c4458f0ce2ebbe3b`.
Full lint, checked JavaScript and all sixteen generated reference pages passed.

The [source-history ledger](checked-record-native-host-source-history-20261010.json)
records seventeen exact transitions from `641e216` and 258 current-source pin
updates. The independent Git comparison preserves all 6,027 earlier evidence
files, all 420 evidence claims and all 519 observations. Final source-comment and
history checks follow the broader regression; none is installed-host acceptance.
