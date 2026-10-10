# Reviewed native Subtype workflow gates

The downstream and Perl workflows now invoke the strict runner prepared in
`33f1db0daaff269627dcdbb684a4e1a9f164729f`. Each invocation follows its existing
ordinary-source Subtype gate. Existing tests, outcome enforcement, time limits
and artifact uploads remain in place.

The twelve runtime selections cover Python 3.11 and 3.12, Rust, .NET,
Java/Kotlin, Ruby, native PHP, WIT/WASI, and all four Perl version/threading
configurations. Python uses the interpreter path from the corresponding
setup step. Perl keeps the existing matrix-selected interpreter and checks
its actual version, threading and multiplicity in the report.

Every lane retains its combined original TAP and full record directory under
`build/reviewed-subtype-ci/<lane>/`. The existing unconditional uploads include
the entire directory, including partial failed runs. Producer and checker
failures reach the job's existing acceptance gate. Recorded execution
descriptions include the new commands.

This workflow milestone adds no installed support observations. Fresh hosted
acceptance is still required. The separate reviewed C/C++ and npm installed
tests are not invoked by these gates. Their workflow integration, reviewed
browser coverage, and the remaining nested, nominal, callback and generic
Subtype requirements remain open under #1444.

## Preservation checks

The exact source ledger starts at `33f1db0daaff269627dcdbb684a4e1a9f164729f`.
It records ten source transitions and refreshes only 142 current-source pins.
All 419 evidence entries and 518 observations retain their claims. The
independent Git audit verifies all 5,830 older evidence files byte for byte.

Ledger: `reviewed-subtype-host-ci-source-history-20261010.json`, SHA-256
`5e13607300b651bb48ba6567efa65a4d8327b652afb4d2b1c613f43b92780177`.
Audit: `build/vo1444-reviewed-native-ci-workflow-audit-r2.json`, SHA-256
`9623f320c1b25ab181968451133eebf16a48595568d1c0b2b58d6b6d74f3dea8`.

Workflow mutation tests reject omitted or misplaced gates, wrong interpreter
selections, discarded original records, truncated uploads, suppressed failures
and missing command descriptions. The inverse workflow transformation must
recover the exact authenticated predecessor. Both workflow files parse as YAML.

The first seven-root regression finished with 804 passing tests, one failure
and 26 explicit installed/compiler skips. The failure was the documentation
test comparing the older artifact order without first validating and removing
the new workflow additions. The repair validates both current workflows,
removes only this milestone's additions, and retains the older exact checks.
Original failed TAP: `build/vo1444-reviewed-native-ci-workflow-registered-r1.tap`,
SHA-256 `5fb8fdb1a56ab88fcae6e6ce36e298fd6474cac88293ce66597ea694ae8ace53`.

The corrected seven-root regression finished with 805 passing tests, zero
failures and 26 explicit installed/compiler skips in 379.98 seconds. It ran
the reviewed-Subtype, type-surface, type-corpus, author-documentation,
documentation, native-Fin-record and PHP-Wasm-Fin roots with concurrency one.
Original TAP: `build/vo1444-reviewed-native-ci-workflow-registered-r2.tap`,
SHA-256 `36b588f838cb649bc3224ed148b23e52c990140b1194da2dd4ba73cd7a5f6d8c`.
The focused workflow and PHP-Wasm predecessor tests also passed all eleven
tests without skips. Full repository lint, JavaScript typecheck and all
sixteen generated-reference checks passed.

## Hosted CI audit

The job list for downstream run `38071834965` at `d177236` has 45 jobs.
The earlier 30-job view was incomplete. At this audit, 30 jobs passed, 11
failed, and native PHP, PHP-Wasm, .NET and C/C++ were still running. The
workflow changes in this milestone have not been pushed into that run.

The completed Rust, Python, WIT and Ruby jobs repeat the three historical
Buffer-reader assertions repaired in `7b56b06`. Combined Perl fails because
its four prerequisite jobs failed. Original job-log SHA-256 values:

| Job | Original local log | SHA-256 |
| --- | --- | --- |
| Rust | `build/vo1220-rust-d177-114270644075.log` | `730c92940b587396a0a4f8e2cdac778248c6d9d48cfa6b6949ea8e89c2cdeec6` |
| Python | `build/vo1220-python-d177-114270644089.log` | `c9be9482a2f4d5f49c148b8e2bd5d06e1d0944fe49427742d599b5f2f5a97f7f` |
| WIT | `build/vo1220-wit-d177-114270644098.log` | `886e8e68291b8bf293819f5c7eccef5394a47238aa6742836dc78cf74193abbb` |
| Ruby | `build/vo1220-ruby-d177-114270643995.log` | `18bcf5e332ed3a8623e3427498f7aa846bcbdff48fd9ebb71b5cd854ca7479c0` |
| Combined Perl | `build/vo1220-perl-combined-d177-114295416438.log` | `78e61f17dcbb910aff2e5470f15964b7808878745aff43d93118ad1b415d19fa` |

JVM plugin acquisition remains a separate failure. The earlier successful
empty-cache local probe does not establish why the hosted downloads failed.
