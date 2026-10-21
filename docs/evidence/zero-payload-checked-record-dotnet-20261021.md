# Zero-payload checked records in .NET

The immutable [hosted evidence archive](zero-payload-checked-record-dotnet-20261021/index.json) records all four ordinary-source, reviewed-IR, full and result-only .NET NuGet package selections from [GitHub Actions run 39561655735](https://github.com/seanmorris/lean-bridge/actions/runs/39561655735). The archived artifact is `12329431983`; its SHA-256 is `77f66059e6ab3c3988559fc0616d7e4f828d7b99b20b0b6aabe36d7c8b1b707e`.

Each selection reproduces the complete NuGet package from two author roots, removes the author sources, installs without network access, relocates the installed tree and replays an independently compiled C# caller. The run used Ubuntu 24.04, x64, glibc 2.39 and .NET SDK 8.0.424 with a declared glibc 2.38 package floor.

The fixture distinguishes these values:

- proof-only `Witness`, checked through a selected nullary Lean constructor;
- `Token`, whose `Unit` field remains present;
- plain empty `Marker`;
- `Option Witness`, including explicit absence;
- arrays of zero-payload values; and
- the active and inactive branches of `Mark`.

C# exposes `Witness` as a nominal zero-component record. It is not null, absence, `Unit`, `void`, or interchangeable with `Marker` or `Token`. Arrays preserve their lengths and contain independent nominal values.

Full packages run the exact selected nullary constructor on checked inputs, reject null at the public boundary, preserve rejected caller values and recover on the next valid call. Result-only packages project Lean-produced proof-erased values without input-constructor metadata.

The archive retains every NuGet package, receipt, report, caller observation, terminal TAP stream, generated probe, tool identity, GitHub API record, artifact ZIP byte and exact producer, consumer, checker and archiver source closure. Producer, consumer and checker use revision `a6173cade3bbe158baa1a5695e3e93e1037359b0`; the corrected immutable archiver uses revision `45adeda636c236b1fb5bccf451266804bfe2ae4d`. The independent verifier is [`tests/helpers/zero-payload-checked-record-dotnet-evidence.mjs`](../../tests/helpers/zero-payload-checked-record-dotnet-evidence.mjs).

This evidence promotes copied parameter and result sites for the named fixtures in .NET. It does not promote fields, callbacks, owned positions, other zero-payload shapes or another host. Lean, .NET and the operating system remain trusted external toolchains.
