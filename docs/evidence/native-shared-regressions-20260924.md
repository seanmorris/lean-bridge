# Current shared native regressions

Six fresh installed gates passed without skips. Their
[combined record](native-shared-regressions-20260924.json) preserves the original
package receipts and compares current executions against them.

| Gate | Executed coverage | Declared glibc floor |
| --- | --- | --- |
| C/C++ | Both languages and source paths; source-free consumers | 2.36 |
| Java/Kotlin | Both languages and source paths; 633,010 assertions | 2.36 |
| Perl | 32 installs across two source paths, two builds, four ABIs and both install modes | 2.36 |
| Python | Both source paths on three interpreter environments | 2.36 |
| Ruby | Both source paths; original gems and complete failure observations | 2.38 |
| Rust | Both source paths; original crates and 28 allocation/unwind checkpoints each | 2.36 |

Archive identities, native libraries, public contracts and failure observations
match the original receipts. Rust's test-consumer executable paths and three
Perl installer bookkeeping files retain their previously measured exceptions.
No shipped package or library hash is waived. The record separately references
the six [current C# family gates](dotnet-current-family-regressions-20260924.md).

The source checks reconstruct the three shared build modules before NuGet,
before Maven and before native PHP admission. Every reconstruction must match
the complete source hash in its corresponding original receipt. Target-test
updates also preserve their full predecessor modules, including older Python
and Ruby verification changes.

Historical receipts retain their original verifier hashes. The new record keeps
the complete old NuGet verifier and authenticates it against the unchanged
PHP-Wasm receipt. Exact checker-only insertions reconstruct the preceding JVM,
Python and Ruby verifier sources. The current record checks the new verifier
bytes and the full installed matrix; unrelated source edits still fail.

Negative tests reject changed packages, missing language/source/ABI runs,
weakened runtime checks, skipped or substituted gates, modified source snapshots
and corrupted verifier history. Full structured-types acceptance still requires
the support inventory, remaining implementation work and complete repository
suite.
