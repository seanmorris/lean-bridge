# C# existing-family regressions during recursive NuGet integration

The recursive NuGet package changes pass all six existing C# installed-family
suites. Each suite builds from ordinary Lean source and independently reviewed
IR, installs the original NuGet archive, and repeats consumer execution without
the producer sources or .NET SDK.

The [record](dotnet-recursive-family-regressions-20260923.json) retains the fresh
observations, passing log, current source hashes, and hashes of the unchanged
original receipts. The verifier compares public signatures, assertion counts,
compiler rejections, failure probes, and source-free execution requirements.
Negative tests reject missing source paths, weakened cleanup checks, changed
parameter order, and fewer runtime-only executions.

| Existing family | Assertions per source path | Additional checks |
| --- | ---: | --- |
| Arrays and records | 660,970 | 551 native and 391 host allocation checkpoints; 512 concurrent calls |
| Options, results, and tuples | 41,534 | 12 compiler rejections; 94 failure assertions |
| Lists | 99,180 | 12 compiler rejections; 214 failure assertions |
| Aliases | 3,876 | 12 compiler rejections; 180 failure assertions |
| Variants | 209,519 | 8 compiler rejections; 152 host failure assertions; 242 native allocation failures |
| Primitive callbacks and closures | 128,247 | 7 compiler rejections |

These are behavioral regressions, not byte-for-byte reproductions of every
older C# package. The original receipts predate changes to the shared runtime
broker, native allocation guards, and generated structural equality. The fresh
runs use the current development glibc declaration, 2.38. Each receipt keeps its
own archive and generated-source hashes. The collection API source, consumer
sources, compiler rejection inputs, and failure-check counts remain unchanged.

The reviewed compound fixture also includes the earlier named `Deep` correction.
The verifier reconstructs both complete source trees and accepts that exact
transition. It does not waive other source changes.

Cross-language regressions and final recursive NuGet acceptance are separate
checks. This record does not promote C# recursive coverage or claim support for
structured callback payloads or resource-containing aggregates.
