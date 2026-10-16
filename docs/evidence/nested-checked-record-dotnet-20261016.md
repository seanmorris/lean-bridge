# Nested checked records in .NET, 16 October 2026

The [authenticated archive](nested-checked-record-dotnet-20261016/index.json) records four installed NuGet selections: ordinary Lean source and independently reviewed Binding IR, each as a full API and a standalone result-only API. Every selection was reproduced from two author roots, installed from an offline NuGet source after the author sources were removed, replayed after relocating the installed tree, and executed again after deleting the consumer sources.

The full APIs pass a proof-free generated `Packet` record through direct and repeated parameters, arrays, Lists, options, tuples, both `Result` branches, an enclosing record field, and an active variant field. `Packet` contains a `Fin 10` digit and a checked `Nat` subtype word. C# supplies `BigInteger` payloads; generated adapters invoke the exact selected constructors at every present input site. Rejected graphs retain every caller value, and a later valid call proves recovery. Lean-produced arrays and optional results expose payloads without proof fields or input-constructor metadata.

The local archive used .NET SDK 8.0.424 and shared framework 8.0.30 on Linux x64/glibc 2.36 with a 64-bit machine-word contract. The [recurring workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-dotnet.yml) rebuilds the same four selections on Ubuntu 24.04 and enforces the glibc 2.38 hosted floor.

This evidence covers the exact acyclic `Packet`, `Holder`, `ChoicePacket`, and copied-container forms in the archive. Generic, recursive and inherited records, other indices, open dependent and zero-payload records, callbacks, owned positions and other platforms require separate acceptance.
