# Required native checked-record CI

The downstream consumer workflow now runs installed checked-record acceptance
in its existing native PHP, Python, Rust, .NET, JVM, Ruby and WIT/WASI groups.
Each lane runs ordinary-source, reviewed-IR, ordinary result-only and reviewed
result-only packages. Python 3.11 and 3.12 use separate, explicit interpreter
selections. The JVM lane tests both Java and Kotlin.

| Consumer group | Acceptance step | Lanes |
| --- | --- | --- |
| Native PHP | `type_corpus_php_native` | `php-native` |
| Python | `type_corpus_python` | `python311`, `python312` |
| Rust | `type_corpus_rust` | `rust` |
| .NET | `type_corpus_dotnet` | `dotnet` |
| JVM | `type_corpus_jvm` | `jvm` |
| Ruby | `type_corpus_ruby` | `ruby` |
| WIT/WASI | `ordinary_wit` | `wit-wasi` |

## Gates and retained records

`scripts/run-checked-record-host-ci.sh` runs one route at a time, retains the
producer's original TAP output, then invokes the independent report checker.
The checker requires the selected installed test to pass without skips and
validates the package, source, caller, installation and relocation records.
The runner preserves the default glibc 2.38 package floor and refuses any
environment override, even an empty one. It also refuses an existing output
directory instead of mixing old and new records.

Each workflow group retains its earlier commands, outcome enforcement and
uploads. A lane's full `build/checked-record-ci/<lane>/` directory is uploaded
on success or failure, including partial route output. Recorded consumer
commands include the new calls. Perl and PHP-Wasm checked-record acceptance
are not included in this native milestone.

## Regression controls and scope

Workflow tests require all eight lanes in their assigned jobs and verify the
explicit Python selections, adjacent predecessor gates, consumer command
descriptions, unconditional complete uploads and final failure enforcement.
Mutation controls remove or move gates, substitute interpreters, weaken exit
handling and discard output. Shell tests separately exercise all four routes
and producer/checker failures with stand-in tools. Report CLI tests validate
all sixteen original successful run groups from the three installed archives.

The existing CI documentation assertion now validates and removes this new
layer before comparing the earlier command and upload order. Its original
failure at the .NET upload-order comparison remains in
`build/vo1446-host-ci-doc-contract-r1.tap`. The corrected assertion passed.

The [exact source-history ledger](checked-record-host-ci-source-history-20261011.json)
preserves all 436 evidence claims and 551 observations from `5721e52`. Its
source-pin updates do not claim a new installed or hosted execution. The
[native promotion](checked-record-native-promotion-20261011.md) identifies the
previously accepted local runs. Hosted acceptance of these new CI lanes must
come from a subsequent workflow run.

The nine-root regression passed 252 tests with zero failures and 18 explicit
compiler/installed gates skipped (270 total). Focused workflow, history and
promotion checks passed 16 tests without failures or skips. Full lint,
changed-source lint, checked JavaScript, ShellCheck, YAML parsing and all 16
generated references passed.

An independent audit verifies seven exact source transitions and 133
source-pin updates. All 6,484 older evidence files are byte-identical. The
ledger SHA-256 is
`9fa30cc51ec6911a0ec43305c252f7be0dba7d3958088ab7e7206bba6d5e9ad2`.
The audit result is `build/vo1446-host-ci-audit-r1.json`, SHA-256
`ad1064fe95f72b55145b154e0ad026ab2b51569e3af340e7d1bb9b4cff16dc55`.
