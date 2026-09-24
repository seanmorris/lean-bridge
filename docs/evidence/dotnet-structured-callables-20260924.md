# Structured C# callbacks and returned closures

VO task 1219, 24 September 2026.

Original NuGet archives run from offline installations after removal of the
producer project. Ordinary-source and independently reviewed-IR builds execute
the same typed consumer with .NET SDK 8.0.424 and runtime 8.0.30.

The accepted payloads are arrays, Lists, nested options, results, binary
products, copied records, variants and transparent aliases. The fixture has
26 exports and 14 callback signatures. Calls copy callback arguments, callback
results, closure captures and closure results into independently owned values.

Each installation passes:

- 274,237 public checks, including 937 runtime rejections.
- 14 independently specified compiler rejections against the installed assembly.
- 5,444 injected allocation/conversion failures across 40 execution paths.
- 15 invalid native tag or sequence-span rejections.
- The exact [documented C# example](../consume/dotnet.md#structured-callback-values).
- Two relocated runtime-only executions after removing all sources, the package
  feed and the SDK from the execution environment.

Fault probes compile separate copies of the verified generated C# sources and
load the original installed native libraries. The installed assembly and package
files remain unchanged. Probes check scoped allocation and callback-root cleanup,
zeroed native outputs, and native closure counts returning to baseline after
every failure. They cover repeated callbacks, closure creation, invocation and
already-held closures. Closing an active closure defers disposal until return.

Public tests check nested presence and branch identity, structural equality and
hashes, mutable-buffer independence, retained callback arguments, exception
identity and stack preservation, re-entry, creating-thread invocation, disposal
from another thread, expired borrows, GC and copy-budget failures.

Six predecessor generated packages remain byte-identical. A separate fresh
primitive regression passes 128,247 checks per source path across 62 exports.
The source transition preserves the earlier C, C++, Rust, Python and Ruby
receipts without rewriting their recorded executions.

The local run uses the existing test-only glibc 2.36 floor override and verifies
the native libraries' required symbols. It does not change the published
platform contract or bypass compatibility checks.

[Execution record](dotnet-structured-callables-20260924.json),
[source transition](dotnet-structured-callable-integration-20260924.json), and
[generator regression](dotnet-structured-codegen-regression-20260924.json).

This milestone promotes exactly 32 C# callback cells. Recursive callback
payloads and resource-containing aggregates remain assigned work in task 1219.
