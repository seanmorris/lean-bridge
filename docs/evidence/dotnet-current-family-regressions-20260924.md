# Current C# family regressions

All six installed C# family gates passed on September 24. Ordinary Lean source
and reviewed IR each exercised arrays and records, options/results/tuples,
Lists, aliases, variants, and primitive callbacks and closures. The twelve
executions completed 2,286,652 public assertions. Each consumer also ran twice
after removing producer sources and the .NET SDK.

The [current record](dotnet-current-family-regressions-20260924.json) retains
the executions, complete passing log, 46 source hashes and three verifier hashes.
It references the unchanged
[previous family record](dotnet-recursive-family-regressions-20260923.json)
and the six original family receipts.

The comparison checks both generations. Public signatures, callers, compiler
rejections, allocation-failure probes, source-free executions, NuGet archives,
installed package assemblies and native libraries match the preceding family
run. The older family receipts also retain their original behavior checks and
the documented named-`Deep` source correction.

Only downstream `Consumer.dll`/`Consumer.pdb` digests, local NuGet installer
metadata and the sanitizer test executable's digest may vary. Consumer file
sizes remain checked. The sanitizer compiler embeds temporary debug and runtime
search paths; its adapter source, instrumented source, caller, enabled sanitizers
and complete failure observations remain exact. Shipped packages and libraries
receive no digest exceptions.

Fresh execution replaces the need to reconstruct an unavailable intermediate
managed-auditor source. The old receipt still records that source's original
hash. This record binds the current auditor to actual installed executions.

Malformed-record tests reject changed archives, omitted source paths, altered
callers, weakened failures, skipped gates and changed source or verifier hashes.
Structured callback payloads and resource-containing aggregates remain separate
implementation work. The support inventory has not yet promoted recursive C#.
