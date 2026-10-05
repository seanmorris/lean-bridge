# Recursive C# callbacks and closures

Original NuGet packages pass recursive callback and returned-closure checks on
both ordinary-source and reviewed-IR builds. The consumer installs each archive
offline into an empty cache. The test removes the author package before
installation, then removes the handoff and runs relocated consumers with only
the .NET runtime. No Lean, Node, C compiler, or .NET SDK is available to those
consumers.

Each source path covers:

- 33 exported functions and 18 callable signatures, with 8,808 recursive checks,
  170 native/managed layout observations, and 19 closure-lifetime checks.
- All nine copied shapes, 23,663 injected failures, 784,369 assertions, 25,110
  cleanup observations, and 36 deferred-disposal checks. No identities remain.
- Nine callback reply-lifetime checks. Removing reply ownership rejects all
  eight pointer-bearing shapes before decoding. Removing runtime retirement
  after malformed native output produces the expected managed exception.
- 24 compile-time rejections against the installed assembly, plus named-argument
  callers. Invalid cold calls do not load assets; tampering with any of the four
  native libraries rejects before executing it.
- The exact [publisher example](../publish/nuget.md#export-recursive-callbacks-and-closures)
  and [C# consumer](../consume/dotnet.md#recursive-callback-values). The latter
  prints `20`, `19`, and `20` from the original installed assembly.

A second pair of packages combines the recursive API with all nineteen primitive
callback types and sixteen-argument `Func`/`Action` delegates. Each package
exports 97 functions with 59 signatures and passes 128,266 primitive checks and
274,237 acyclic checks after source removal and SDK-free relocation.

The earlier primitive and structured callable suites also pass. All fifteen
copied-package regression tests pass, including original installs, independent
archive reproducibility, mixed C++/.NET composition, shared retirement, and
coordinate conflicts. Those regression runs used isolated staging imports;
their ten implementation modules match the promoted modules byte for byte.
The recursive acceptance run uses the normal repository imports.

## Reproduce

```sh
source scripts/env.sh
LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST=1 \
  node --test tests/dotnet-recursive-callables.test.mjs
node --test tests/dotnet-recursive-callable-contract.test.mjs \
  tests/dotnet-recursive-callable-evidence.test.mjs
```

CI retains `build/recursive-callables/dotnet.json`. The
[execution receipt](dotnet-recursive-callables-20260926.json) contains original
archive and file hashes, terminal logs, installed consumer results, and isolated
probe observations. The
[integration receipt](dotnet-recursive-callable-integration-20260926.json)
authenticates source changes and adds exactly four inventory cells: recursive
callback input and result positions on the two source paths.

## Ownership and limits

C# callbacks use synchronous `Func` or `Action` delegates. Returned
`LeanClosure<TDelegate>` values expose `Invoke`, `IsClosed`, and `Dispose`.
Use `using` for deterministic release. Finalization is a fallback; disposal
during invocation waits until that invocation returns. Invocation requires the
creating thread and process.

Conversions permit 128 value levels, 262,144 visited nodes, a 16 MiB native-copy
budget, and a separate 16 MiB accounted host-storage budget. Native reentry
permits 64 active calls; returned closures share 4,096 identity slots. These
bounds do not cover Lean working memory or every CLR allocation.

Resource identities or callable identities inside copied aggregates, retained
host callbacks, asynchronous delivery, and post-fork reuse remain unsupported.
This record covers .NET 8 on little-endian Linux x86-64. Five profiles still need
recursive callable acceptance: Java, Kotlin, native PHP, PHP-Wasm, and WIT/WASI.
Explicitly owned resource aggregates and the final audits remain in VO 1219.
