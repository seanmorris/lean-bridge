# Application objects in installed NuGet records

Two offline installs of `Workshop.Host/1.0.0` ran the same [C# application](../../tests/fixtures/dotnet-host-record/Program.cs)
on Linux x86-64 with .NET SDK 8.0.424. The [Lean project](../../tests/fixtures/dotnet-host-record/Workshop.lean)
defines public records containing application meters, copied byte arrays and an arbitrary-size natural number.
The ordinary build selected its exports from Lean. The reviewed build accepted a documentation edit to the byte field;
when the review reversed field order the publisher refused to create a release.

| Author route | Verified package set | Installed execution |
| --- | --- | --- |
| Ordinary Lean project | [NuGet receipt](dotnet-host-record-20261126/ordinary.package-set.json) | [C# result](dotnet-host-record-20261126/ordinary.execution.json) |
| Reviewed interface | [NuGet receipt](dotnet-host-record-20261126/reviewed.package-set.json) | [C# result](dotnet-host-record-20261126/reviewed.execution.json) |

The client constructed `Pair<Meter>` and passed two borrowed pairs to one compiled Lean function.
Results contained the **original CLR objects** in the order selected by Lean. The input, two output
byte-array properties and later reads did not alias each other's mutable bytes. A natural number larger
than 128 bits survived a Lean increment. A [separate negative compilation](../../tests/fixtures/dotnet-host-record/WrongMeter.cs)
refused `Pair<object>` at the `Pair<Meter>` parameter (CS1503).

A disposed second record or a negative natural number failed before the first meter was read.
When application code threw during a valid call, the caller caught the original exception object.
A second record returned two copies of the same byte buffer with an application object between them:
exceeding the shared 16 MiB limit on the **second** copy released the already-exported meter.
The weak reference cleared and the same binding accepted the next call.

A returned Lean function kept two captured fields alive after its input record was disposed; closing
the function released both. A separate returned record remained readable after its binding closed.
Disposing that record twice released its last meter without disposing the application object itself.

Reproduce with `npm run test:dotnet-host-records` on the supported Linux producer with the Lean and
.NET SDK toolchains. The [installer test](../../tests/helpers/dotnet-host-record-installed.mjs) restores from
each verified local archive, removes the package cache and runs the relocated application without build tools.
This covers synchronous host-object record fields, not records delivered by an async cursor or inside an EIO error.
