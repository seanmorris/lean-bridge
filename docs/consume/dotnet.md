# C# and .NET

Install the Alpha NuGet package and call its generated C# API from a .NET 8 console application. The archive includes the compiled Lean libraries; package installation does not invoke a native compiler.

## Use a prepared release

### Prerequisites

Use the .NET 8 SDK on x86-64 Linux with glibc 2.38 or newer. Check your machine with `dotnet --list-sdks`, `uname -m`, and `ldd --version`. The [support contract](../consumer-support.v1.json) records the tested platform.

This example consumes `LeanBridge.Alpha.0.0.0.nupkg`, the Alpha interoperability package. Follow [Use a prepared release](receive-package.md) to obtain and authenticate the archive. Put it in a local directory and set `LEAN_BRIDGE_NUGET` to that directory's absolute path. No public NuGet feed is assumed.

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

Profiles: C#. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -128..127; reject overflow before narrowing. |
| `Int16` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `ReadOnlyMemory<byte>` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `ReadOnlyMemory<uint>` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Payload` (input, result) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Transform delegate` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `OwnedTransform` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

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

It does not map Lean arbitrary-precision integers to `uint` or automatically turn a Lean function into a .NET `Task`.

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
