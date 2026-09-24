# Current recursive NuGet package checks

All five recursive C# gates passed on September 24: cold package assembly,
installed packages, shared-runtime composition, independent reproduction and
coordinate conflicts. The combined run completed in 1,036.8 seconds with no
failures or skips.

The [current record](dotnet-current-graph-packages-20260924.json) retains all
four package reports and the complete log. It binds 51 source snapshots and four
verifiers, and references the
[current existing-family checks](dotnet-current-family-regressions-20260924.md).
The [original package receipt](dotnet-recursive-packages-20260923.json) remains
unchanged.

Each source path installed its original archive offline, exercised 18 exports
with 685 assertions and 256 concurrent calls, and rejected eight invalid C#
callers. Both relocated, runtime-only executions passed. The documented C#
example also compiled and ran. Tampering with each of four native libraries,
three graph receipts and three regenerated adapter sources was rejected.

Independent ordinary-source and reviewed builds reproduced the original NuGet
archives byte for byte. Shared loading passed with two recursive packages and
one ordinary package, including mixed C++/NuGet output. Coordinate-conflict tests
rejected a different build before mapping its component, preserved the first
package and accepted an identical build.

The comparison preserves every report field except the downstream test
application's DLL/PDB digests and the containing report digest. It checks the
raw report digest before comparison. Package archives, installed assemblies,
native libraries, source hashes and safety observations stay exact.

The contract test now checks this current record alongside the old receipt.
Reversing only its added import and receipt-check call reconstructs the complete
test module that executed the five gates. Installed test bodies are unchanged.
Final acceptance still requires the remaining repository evidence and inventory
checks.
