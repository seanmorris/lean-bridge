# Compiled C# Lists

VO1219 adds copied `List T` inputs, results and record fields to prepared NuGet
packages. Both ordinary-source and independently reviewed-IR builds compile the
same 27-export Lean fixture. C# uses typed `T[]` values. Lists retain their
distinct Binding IR and native C identities, preserve order and duplicates,
and nest with arrays, copied records, options, results and binary products.
Returned arrays and mutable payloads own independent storage.

## Installed validation

```sh
LEAN_BRIDGE_DOTNET_LIST_TEST=1 node --test tests/dotnet-lists.test.mjs
node --test tests/dotnet-list-contract.test.mjs
```

The [machine-readable record](dotnet-lists-20260920.json) retains archive,
receipt, source, compiler, assembly and deployed-file hashes. Each source path
passes 99,180 consumer assertions with .NET SDK 8.0.424 and runtime 8.0.30.
The test removes the producer workspace before offline installation from a
relocated NuGet feed. The consumer references only the prepared package.

The consumer checks all nineteen primitive elements, exact 5,121-bit integers,
fixed-width bounds, signed zero, subnormals, infinities, NaN classification,
Unicode and embedded NUL, empty Lists, duplicates and non-symmetric reversals.
It checks nested Lists and arrays, record fields, option presence, both result
branches and binary products. A 24-level fixture exercises every empty level.
Results remain independent after input or sibling-result mutation. Four
concurrent callers retain independent call state. Oversized inputs and outputs,
invalid nested payloads and partial conversions reject; subsequent calls pass.
A 30,000-element generated List checks the native traversal.

Twelve independent invalid C# programs reject with specific compiler codes.
They cover wrong elements, containers, nesting, option presence, product arity,
record fields, result assignments, fixed-width overflow and platform overflow.

The test verifies the installed assembly and native assets against the receipt,
then removes sources, build directories, NuGet caches, the feed and probes.
Only the relocated deployment and a copied .NET runtime remain. With no SDK
and `PATH=/unavailable`, the consumer passes 99,180 assertions twice; deployed
file hashes remain unchanged.

## Cleanup and malformed output

A separate instrumented copy of the verified generated adapter uses the same
compiled native libraries. It leaves the installed release assembly unchanged.
Across 214 injected conversion and scratch-allocation failures per source path,
the probe checks zero live scratch buffers, one output clear per native call
and a successful next call. Sixteen partial-input failures check cleanup before
Lean runs.

Nine malformed-output checks cover oversized lengths, missing buffers,
misalignment, poisoned empty buffers and invalid nested List buffers. Sequence
guards run before allocation or element reads. Alignment follows the native
element type, including compound field alignment. The record retains original
and instrumented source hashes. Native allocator fault coverage remains in the
[C/C++ List suite](native-lists-20260920.md).

Managed input copying has a 16 MiB accounting budget. Native copying shares a
separate 16 MiB budget across inputs and outputs. The per-sequence output guard
also limits each allocation. These checks do not bound every managed allocation
or Lean working memory. Types have a 32-level nesting limit. Local acceptance
uses Linux x86-64 with glibc floor 2.36; CI builds supported 2.38-floor packages.

This milestone promotes six C# profile/path/position cells: List inputs,
results and fields through both source paths. List callback payloads, aliases
with distinct runtime identity, arbitrary or recursive variants and
resource-containing copies remain separate work.
