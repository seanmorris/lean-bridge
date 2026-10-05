# Recursive C# packages

The NuGet package layer compiles typed C# methods and value declarations with
private native converters and an authenticated loader. A NuGet-only build needs
no public C package. Mixed native builds validate every selected target.

The [package observations](dotnet-recursive-packages-20260923.json) record passing
installed-package, reproduction, composition, and coordinate-conflict tests.
Final acceptance still requires the shared-backend regressions, source-lineage
checks, and full suite. The type inventory has not promoted C# recursive cells.

## Installed calls

Ordinary Lean source and independently reviewed IR each produce an original
NuGet archive. The tests install it offline into an empty cache, compile the
external caller, and check 18 exports with 685 assertions and 256 concurrent
calls. Eight invalid C# callers fail compilation.

The tests remove the author project, handoff, feed, package cache, and consumer
sources. Two relocated executions then use a copied .NET 8 runtime with no SDK.
The exact recursive example from the C# consumer guide also compiles and runs in
that deployment.

Each installation rejects changes to all four native libraries before calling
Lean. Build checks reject three graph-receipt mutations and three re-signed
adapter-source mutations. Generated public C# must match complete regeneration,
including its public-file list.

## Reproduction and shared loading

Independent ordinary-source and reviewed builds reproduce the original archive,
native binary, binding IR, and model hashes. The original installed reports stay
unchanged during comparison.

Three original packages exercise shared loading: two recursive packages and an
ordinary package, including one mixed C++/NuGet build. Both loading orders pass
192 concurrent calls, shared runtime retirement, and use of copied values retained
before retirement. Libraries remain loaded for the process lifetime.

Two other packages use the same component identity but return different values.
Four isolated scenarios check both loading orders, rejection before mapping the
conflicting component, continued use of the first package, and reuse of an
identical build. The tests preserve the original deployed bytes.

The [existing-family regression record](dotnet-recursive-family-regressions-20260923.md)
separately checks arrays, records, options, results, tuples, Lists, aliases,
variants, and primitive callbacks and closures. Structured callback payloads and
resource-containing aggregates remain separate implementation work.
