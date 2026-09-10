# C# and .NET

Install the Alpha NuGet package and call its generated C# API from a .NET 8 console application. The archive includes the compiled Lean libraries; package installation does not invoke a native compiler.

## Use a prepared release

### Prerequisites

Use the .NET 8 SDK on x86-64 Linux with glibc 2.38 or newer. Check your machine with `dotnet --list-sdks`, `uname -m`, and `ldd --version`. The [support contract](../consumer-support.v1.json) records the tested platform.

This example consumes `LeanBridge.Alpha.0.0.0.nupkg`, the Alpha interoperability package. Follow [Receive a package](receive-package.md) to obtain and authenticate the archive. Put it in a local directory and set `LEAN_BRIDGE_NUGET` to that directory's absolute path. No public NuGet feed is assumed.

### Create the application

Create an empty directory and save these two files inside it.

`Consumer.csproj`:

```xml file=dotnet/Consumer.csproj
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="LeanBridge.Alpha" Version="0.0.0" />
  </ItemGroup>
</Project>
```

`Program.cs`:

```csharp file=dotnet/Program.cs
using LeanBridge.Alpha;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

using var box = new Box(42);
Check(box.Read() == 42 && ReferenceEquals(box.Identity(), box), "Box identity");
Console.WriteLine($"Box: {box.Read()}");

var payload = Alpha.RoundTrip(new Payload(
    true, 41, "Lean λ", new byte[] { 0, 255 }, new uint[] { 0, uint.MaxValue }));
Check(!payload.Enabled && payload.Count == 42 && payload.Label == "Lean λ"
    && payload.Bytes.Span.SequenceEqual(new byte[] { 0, 255 })
    && payload.Values.Span.SequenceEqual(new uint[] { 0, uint.MaxValue }), "Payload");
Console.WriteLine($"Payload count: {payload.Count}");

var callback = Alpha.WithCallback(40, value => value + 2);
Check(callback == 44, "Callback result");
Console.WriteLine($"Callback: {callback}");

using var adder = Alpha.MakeAdder(2);
Check(adder.Invoke(40) == 42, "Returned callable");
Console.WriteLine($"Callable: {adder.Invoke(40)}");

try
{
    Alpha.WithCallback(40, _ => throw new InvalidOperationException("callback marker"));
    throw new Exception("Callback failure was accepted");
}
catch (InvalidOperationException error) when (error.Message == "callback marker") { }

adder.Dispose();
adder.Dispose();
box.Dispose();
box.Dispose();
try
{
    box.Read();
    throw new Exception("Closed Box was accepted");
}
catch (DisposedResourceException) { }
try
{
    adder.Invoke(40);
    throw new Exception("Closed callable was accepted");
}
catch (DisposedResourceException) { }
Console.WriteLine("Errors and cleanup: passed");
```

### Restore and run

Set the path to your authenticated package directory, then run these commands from the application directory:

```sh
export LEAN_BRIDGE_NUGET=/absolute/path/to/nuget-package-directory
dotnet restore Consumer.csproj --source "$LEAN_BRIDGE_NUGET" --ignore-failed-sources
dotnet build Consumer.csproj --configuration Release --no-restore --disable-build-servers
dotnet bin/Release/net8.0/Consumer.dll
```

Expected output:

```text
Box: 42
Payload count: 42
Callback: 44
Callable: 42
Errors and cleanup: passed
```

### Type conversions

These mappings describe the prepared Alpha NuGet package's `LeanBridge.Alpha` namespace.

| Lean type | C# type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Native Boolean value. |
| `UInt32` | `uint` | Full unsigned 32-bit range. Use `checked` when converting signed or wider application values. |
| `String` | `string` | Encoded as UTF-8 across the native boundary; `null` is rejected. |
| `ByteArray` | `ReadOnlyMemory<byte>` | Accepts a `byte[]`; `Payload` copies it and exposes read-only memory. |
| `Array UInt32` | `ReadOnlyMemory<uint>` | Accepts a `uint[]`; `Payload` copies the elements. |
| `Payload` | `Payload` | Sealed record with get-only properties and copied buffers. |
| `Box` | `Box` | `IDisposable` resource; `Identity()` returns the same wrapper. Use `using`. |
| `UInt32 → UInt32` callback | `Transform` | Generated `uint Transform(uint value)` delegate; runs synchronously. |
| Returned Lean closure | `OwnedTransform` | `IDisposable` resource with `Invoke(uint)`; use `using`. |

This Alpha release exposes no `Nat`, `Int`, floating-point, optional, or asynchronous operations. It does not map Lean arbitrary-precision integers to `uint` or automatically turn a Lean function into a .NET `Task`.

### Values and resource ownership

Lean `UInt32` maps to C# `uint`. The public API also copies `bool`, UTF-8 strings, byte sequences, and unsigned integer sequences. `Payload` copies incoming buffers; its `Bytes` and `Values` properties expose `ReadOnlyMemory<T>`.

Alpha's `RoundTrip` flips `Enabled` and increments `Count`, preserving the label and buffers. `WithCallback` calls your delegate with the input plus one, then adds one to its result: `40 → 41 → 43 → 44`. Callbacks run synchronously. `MakeAdder(2)` returns a Lean callable that adds two.

`Box` and `OwnedTransform` implement `IDisposable`. Use `using` so exceptions also release them. `Box.Identity()` returns the same managed wrapper. Repeated disposal is harmless; subsequent calls raise `DisposedResourceException`. The example closes both resources early to check that behavior.

### Errors and troubleshooting

- An exception thrown by your callback propagates back as the original .NET exception. The example handles `InvalidOperationException`.
- Other reported Lean/native failures raise `LeanBridgeException` or its generated subclasses. Catch the specific failure your application can handle.
- If restore cannot find `LeanBridge.Alpha`, check that the source directory contains the original `LeanBridge.Alpha.0.0.0.nupkg` and the project requests version `0.0.0`.
- A native-library load error can indicate an unsupported architecture, an older glibc, or a missing packaged library. Inspect the original archive and the platform requirements. Do not substitute arbitrary system Lean libraries.
- Leave `LEAN_BRIDGE_NATIVE_ROOT` unset for package consumption; it overrides the packaged native-library location.

## Start from a raw Lean package

For Alpha, [build the managed NuGet package](../contributing/testing.md#managed-packages) to produce `LeanBridge.Alpha.0.0.0.nupkg`. Put the completed archive in the local package directory used by the [restore command above](#restore-and-run).

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Author, publish, and verify

Alpha's managed bindings use the [managed target profile](../architecture/adr/23-managed-runtime-target-profiles.md). The [publishing guide](../publishing.md) covers package handoffs.

Contributors can [build the managed examples](../contributing/testing.md#managed-packages) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [managed acceptance evidence](../evidence/managed-consumer-acceptance.md).

### Publish this package

See [Publish to NuGet](../publish/nuget.md) for package preparation, distribution, and verification after upload.
