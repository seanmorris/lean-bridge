# Shared native target admission

The contract tests now check C, C++, Cargo, PyPI, RubyGems, CPAN, NuGet, Maven
and native PHP as individual graph targets and as a combined target set. CPAN
combinations with NuGet, Maven and native PHP preserve the Perl namespace and
do not introduce a public C target. Invalid namespaces, duplicate targets and
unsupported targets still reject.

The source comparison reconstructs all three shared build files before NuGet,
before Maven and before native PHP admission. Each complete reconstructed file
must match its original execution receipt. Missing or duplicated edits reject;
unrelated changes remain visible in the resulting hash. This check establishes
the source changes, not installed-package acceptance.

Two older tests needed updates. The CPAN test still expected Maven to reject.
The NuGet reconstruction test needed the post-NuGet source before applying its
NuGet-only reversal. Both now pass. A separate test reconstructs their immediate
predecessors. The NuGet test also reverses its earlier Maven/Composer target
expansion and matches the complete original test hashes in both the package
and existing-family receipts. Missing, duplicated or unrelated edits reject.

Fresh installed checks have passed for C/C++, Rust and Python on ordinary and
reviewed source paths. C/C++ archives and native libraries match the originals.
Rust archives, native libraries, generated sources and safety observations also
match; its consumer executable paths retain the previously measured build-path
variation. Python's complete observations match its original receipt across
all six installations.

Java/Kotlin and Ruby shared regressions have also passed. The
[JVM comparison](jvm-shared-regressions-20260924.md) verifies all four
language/source combinations against the original installed packages. Ruby's
complete observations match its original receipt on both source paths.

Perl's fresh gate passed 32 source-free installations across both source paths,
two independent builds, four Perl ABIs and prebuilt/XS-only installation modes.
The six-backend comparison now passes in full. It preserves original archives,
native libraries and public observations. Only the previously measured Rust
consumer build paths and Perl installer bookkeeping may differ.

All six [current C# family gates](dotnet-current-family-regressions-20260924.md)
and all five [recursive NuGet package gates](dotnet-current-graph-packages-20260924.md)
have passed. The [combined native record](native-shared-regressions-20260924.md)
binds the shared runs and each preceding target-admission stage. Remaining
source-evidence checks and the complete repository suite must pass before the
support inventory changes. Structured-types acceptance remains open.
