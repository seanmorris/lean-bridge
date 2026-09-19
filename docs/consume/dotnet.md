# C# and .NET

Install a prepared NuGet package and call its generated C# API. The archive includes the compiled Lean component and shared runtime. Consumers need .NET, not Lean, Node, a C compiler, or handwritten conversions.

## Use a prepared release

### Prerequisites

Use the .NET 8 SDK on x86-64 Linux with glibc 2.38 or newer. Check your machine with `dotnet --list-sdks`, `uname -m`, and `ldd --version`. The [support contract](../consumer-support.v1.json) records the tested platform.

Follow [Use a prepared release](receive-package.md) to obtain and authenticate the archive. Put it in a local directory and set `LEAN_BRIDGE_NUGET` to that directory's absolute path. No public NuGet feed is assumed.

### Call an ordinary Lean package

The package's README names its NuGet coordinate, generated namespace, and functions. The `Aurora` acceptance package uses `Acme.Aurora` version `2.0.0-rc.1` and exposes `LeanBridge.Aurora.Api`. These example coordinates identify a locally built archive, not a published NuGet.org package.

Create `Consumer.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Acme.Aurora" Version="[2.0.0-rc.1]" />
  </ItemGroup>
</Project>
```

Save `Program.cs` beside it:

```csharp
using System;
using System.Numerics;
using LeanBridge.Aurora;

Console.WriteLine(Api.EchoNat(BigInteger.One << 200));
Console.WriteLine(Api.EchoText("Lean λ🌿"));
Console.WriteLine(string.Join(", ", Api.Matrix(new uint[] { 1, 2, 3 })[1]));
```

Restore from the prepared archive directory, then build and run:

```sh
dotnet restore Consumer.csproj --source "$LEAN_BRIDGE_NUGET"
dotnet build Consumer.csproj --configuration Release --no-restore --disable-build-servers
dotnet bin/Release/net8.0/Consumer.dll
```

Nat and Int use `BigInteger`. Fixed-width numbers use their corresponding C# numeric types. Strings preserve Unicode and embedded NUL; invalid UTF-16 throws. Arrays use `T[]`, byte arrays use `byte[]`, and copied Lean records become sealed C# records. Calls copy nested values; changing a returned array cannot change the input. Unit arguments use `default(Unit)` and Unit results return `void`.

Null strings, arrays and records, negative Nat inputs, and oversized input copies throw before invoking the Lean function. Input and output share a 16 MiB conversion budget, including array slots and record storage. An oversized result throws after Lean returns. Generated code releases temporary input buffers and native results on failure. Native library hashes and runtime compatibility are checked automatically when loading. See the [author guide](../publish/nuget.md#build-an-ordinary-lean-project) for admitted signatures.

### Callbacks and returned Lean functions

Ordinary-source and compiler-checked reviewed packages accept synchronous callbacks and returned functions across all nineteen primitives. Callbacks use typed `Func<...>` delegates, or `Action<...>` for a Unit result. Parameters and results retain their ordinary C# mappings, including `BigInteger` and `Rune`. No native pointer or marshalling code appears in your application.

For the Aurora acceptance package, add these calls to `Program.cs`:

```csharp
Console.WriteLine(Api.CallWord(40, value => value + 1)); // applies twice: 42
using var addTwo = Api.MakeWord(2);
Console.WriteLine(addTwo.Invoke(40));                  // 42
Console.WriteLine(Api.CallWord(40, addTwo.Invoke));    // 44
```

Host callbacks borrow the enclosing call. The adapter keeps delegates alive while Lean uses them and supplies independent managed copies of strings, bytes and exact integers. You may retain those copied arguments. Lean must not retain the host function; invoking an expired borrow throws. Nested synchronous calls are supported up to 64 active native callable invocations.

A callback exception returns to the C# caller as the same exception object, with its original stack, after native cleanup. Later callbacks in that failed Lean call do not run. Task-returning delegates do not match the generated signatures. The adapter rejects `async void` delegates, including multicast entries, before invoking them. Callbacks must finish their work synchronously; do not start detached work that uses a borrowed Lean function.

Returned functions use `LeanClosure<TDelegate>`. Call `Invoke` on the thread that created the closure. `Dispose` is idempotent, can run on another thread, and defers native release until an active invocation finishes. All aliases, including a saved `Invoke` delegate, reject calls after disposal. Keeping that delegate keeps the lease alive. `IsClosed` reports explicit disposal; finalization releases abandoned leases as a fallback. Use `using` for deterministic cleanup.

The runtime shares a capacity of 4,096 closure identities. Each call has a 16 MiB conversion budget; the limit does not bound Lean's own allocations. Calls in a forked child require starting a fresh process. Compound callable arguments, resources and asynchronous delivery remain outside this profile. The [installed callable checks](../evidence/dotnet-callables-20260919.md) record exact values, exceptions, ownership and source-free execution.

### Alpha interoperability example

The following example consumes `LeanBridge.Alpha.0.0.0.nupkg`. Its separate fixture API also demonstrates identity-bearing resources, which ordinary NuGet source builds do not yet admit.

## Create the application

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

## Restore and run

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

## Values and cleanup

### Type conversions

Profiles: C#. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `Unit` (input, field, callback input); `void` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Pass default(Unit); Unit results return void. Unit fields and array elements use the generated Unit value type. Pass default(Unit); Unit callback results use Action and return void. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `byte` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `ushort` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `ulong` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `sbyte` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `short` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Arbitrary-precision BigInteger. Negative input throws; zero and multi-limb magnitudes copy without floating-point conversion. Exact System.Numerics.BigInteger; negative Nat inputs and callback results throw. Copied arguments and captured values remain independent. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Signed arbitrary-precision BigInteger with exact sign and magnitude. Signed exact System.Numerics.BigInteger; no fixed-width or floating-point narrowing. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Strict Unicode conversion preserves embedded NUL. Invalid UTF-16 input throws; null is not an empty string. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `byte[]` (input, result, field, callback input, callback result); `ReadOnlyMemory<byte>` (field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Copied byte arrays with independent returned storage. Null is rejected. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `T[]` (input, result, field); `ReadOnlyMemory<uint>` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Recursive copied T[] values, including jagged arrays and arrays of records. Input scratch and deep native outputs are released on failure. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated sealed record` (input, result, field); `Payload` (input, result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Generated sealed C# records preserve declared fields through compiler-owned constructors and accessors. Arrays inside returned records are independent copies. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Func<...> / Action<...>` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Typed synchronous Func/Action delegates borrow the call. Exceptions preserve their original object and stack after cleanup. Async void delegates reject before execution. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | `System.Text.Rune` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Rune preserves supplementary characters; System.Char alone cannot. System.Text.Rune stores one Unicode scalar, including NUL and supplementary code points. Surrogates are rejected by its constructor. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `ulong` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. ulong for the 64-bit compiled Lean target; all bits are preserved. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. long for the 64-bit compiled Lean target; signed endpoints are preserved. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
| `Lean function returned to the host` | `LeanClosure<TDelegate>` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | `LeanClosure<TDelegate>` owns a captured Lean function. Use Invoke, IsClosed and Dispose; all delegate aliases share its lifetime. Invocation requires the creating thread. Required: Preserve captured state, call signature, errors and deterministic disposal. |
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

## Errors and troubleshooting

- An exception thrown by your callback propagates back as the original .NET exception. The example handles `InvalidOperationException`.
- Other reported Lean/native failures raise `LeanBridgeException` or its generated subclasses. Catch the specific failure your application can handle.
- If restore cannot find `LeanBridge.Alpha`, check that the source directory contains the original `LeanBridge.Alpha.0.0.0.nupkg` and the project requests version `0.0.0`.
- A native-library load error can indicate an unsupported architecture, an older glibc, or a missing packaged library. Inspect the original archive and the platform requirements. Do not substitute arbitrary system Lean libraries.
- For the Alpha fixture, leave `LEAN_BRIDGE_NATIVE_ROOT` unset; it overrides the packaged native-library location. Ordinary NuGet packages always load their supplied native assets and do not use this override.

## Start from a raw Lean package

Follow [the C# / .NET build-and-publish guide](../publish/nuget.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Author, publish, and verify

Continue in the [build-and-publish workflow](../publish/nuget.md). Maintainers run the [installed consumer checks](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/nuget.md).
