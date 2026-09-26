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

Nat and Int use `BigInteger`. Fixed-width numbers use their corresponding C# numeric types. Strings preserve Unicode and embedded NUL; invalid UTF-16 throws. Arrays and Lists use `T[]`, byte arrays use `byte[]`, and copied Lean records become sealed C# records. Calls copy nested values; changing a returned array cannot change the input. Unit arguments use `default(Unit)` and Unit results return `void`.

Null strings, arrays and records, negative Nat inputs, and oversized input copies throw before invoking the Lean function. Managed input copying has a 16 MiB accounting budget. Native copying shares a separate 16 MiB budget across inputs and outputs, including array slots and record storage. These budgets do not bound every managed allocation or Lean working memory. An oversized result throws after Lean returns. Generated code releases temporary input buffers and native results on failure. Native library hashes and runtime compatibility are checked automatically when loading. See the [author guide](../publish/nuget.md#build-an-ordinary-lean-project) for admitted signatures.

### Arrays and records

Lean `Array T` uses a typed C# `T[]`, including nested arrays and arrays of
records. Each copied Lean record becomes a named sealed C# record with typed,
init-only properties. Empty and single-field records retain their own types.

For the `Lean.Collections` acceptance package, reference its prepared NuGet
archive using the local-feed steps above and save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Collections;

uint[][] input = { new uint[] { 1, 2, 3 }, Array.Empty<uint>() };
uint[][] reversed = Api.ArrayReverseUint32(input);
Console.WriteLine(string.Join(", ", reversed[1])); // 3, 2, 1
reversed[1][0] = 99;
Console.WriteLine(string.Join(", ", input[0])); // 1, 2, 3

Pair pair = Api.RecordMake();
Console.WriteLine(pair.First); // 42
Console.WriteLine(pair == new Pair(42, "\ufeff🌱\0")); // True
```

Returned arrays own independent storage. Records compare nested contents by
value, including arrays; different record types remain distinct. C# arrays
themselves retain their language equality behavior. See
[comparing copied values](#comparing-copied-values) and the
[installed collection checks](../evidence/dotnet-collections-20260922.md).

### Recursive values

Prepared recursive NuGet packages have installed acceptance on both authoring paths. The generated API
uses named records and variant cases, including direct and mutual recursion.
Arrays and Lists still use typed arrays. Consumers do not supply native pointers,
constructor numbers or serialized JSON.

The local `Lean.Recursive` test package exposes `LeanBridge.Recursive.Api`.
Reference its prepared archive and save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Recursive;

Spine input = new SpineNext(new SpineLeaf(42));
Spine copy = Api.Spine(input);
Console.WriteLine(copy == input); // True
Console.WriteLine(ReferenceEquals(copy, input)); // False
Console.WriteLine(Api.Grow(copy) is SpineNext(SpineNext(SpineLeaf(42)))); // True
Console.WriteLine(Api.Marker(new MarkerUnit(default)) is MarkerUnit); // True
Console.WriteLine(Api.Units(new Unit[3]).Length); // 3
```

Calls reject cycles, null payloads and malformed branches. Arguments and results
share limits of 128 nested values, 262,144 visited values and 16 MiB of native
copies, with a separate 16 MiB conversion-storage budget. These limits do not
bound every CLR allocation or Lean working memory. An oversized result throws
after Lean returns; temporary buffers and native outputs are released.

Native assets load automatically after input validation. Modified libraries
fail their hash checks. Malformed native output retires the shared runtime;
ordinary input and allocation failures remain recoverable. See
[recursive callback values](#recursive-callback-values) for callbacks and
returned closures. Resource-containing recursive values remain separate work.

### Named aliases

Copied Lean aliases use their target's C# values. A `Count` alias of `UInt32`
accepts and returns `uint`; an alias of a copied record uses that record class.
Alias chains and aliases nested in arrays, Lists, options, results and record
fields retain their conversion rules. Aliased `Nat` still rejects negative
`BigInteger` values, while aliased `Int` accepts them.

C# `using` aliases are local to source files, so a NuGet assembly cannot export
them as named types. The package keeps Lean alias names, original targets and
chains in `lean-bridge/dotnet/binding-manifest.json`, its README and XML API
documentation. Its method and record-field documentation names the original
contract types. No wrapper objects or consumer configuration are required.

For the `Lean.Aliases` acceptance package, reference its prepared NuGet archive
and save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Aliases;

uint count = Api.Make(); // Lean Count = AU32 = UInt32
Console.WriteLine(Api.Increment(count)); // 42, Lean OtherCount = UInt32
uint[][] rows = { new uint[] { 1, 2, 3 }, Array.Empty<uint>() };
Console.WriteLine(string.Join(", ", Api.ReverseRows(rows)[0])); // 3, 2, 1
```

`Rows` retains its `Array (List Count)` contract even though C# uses `uint[][]`.
Returned arrays own independent copies. Alias names are not new CLR identities;
for example, the assembly does not declare a `LeanBridge.Aliases.Count` type.
The [installed alias checks](../evidence/dotnet-aliases-20260921.md) cover both
source paths, exact diagnostics, conversion cleanup and SDK-free execution.

### Lists

Lean `List T` uses `T[]` in C# inputs, results and record fields. The adapter copies every element, preserves order and duplicates, and returns independent arrays. Lists can nest with arrays, records, `Option`, `Except` and binary products. List and Array remain distinct in the Lean signature and Binding IR, even though both use C# arrays.

For the `Lean.Lists` acceptance package, reference its prepared NuGet archive and save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Lists;

uint[] input = { 1, 2, 2, 3 };
uint[] reversed = Api.ReverseUint32(input);
Console.WriteLine(string.Join(", ", reversed)); // 3, 2, 2, 1
reversed[0] = 99; // input still contains 1, 2, 2, 3
Console.WriteLine(Api.ReverseUint32(Array.Empty<uint>()).Length); // 0
```

Pass an array, not `List<T>` or another `IEnumerable<T>` implementation. Null arrays and invalid nested payloads throw. Existing copy budgets and the 32-level type limit apply. The adapter checks native sequence lengths, missing buffers and alignment before allocating an output array or reading elements. [Installed List checks](../evidence/dotnet-lists-20260920.md) cover both source paths, compiler rejections, cleanup failures and deployments with no SDK. Lists also work in [structured callbacks](#structured-callback-values).

### Options, results and products

Ordinary-source and reviewed NuGet packages support `Option`, `Except` and binary products, including mixtures with arrays, Lists and copied records. The package generates readonly C# value types `Option<T>` and `Result<T, E>`; products use native `(A, B)` tuples. Nested products retain their binary structure.

For the `Lean.Compounds` acceptance package, use its prepared NuGet archive as the project dependency and save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Compounds;

var present = Api.OptionUint32(Option<uint>.Some(42));
Console.WriteLine(present.Value); // 42

var nested = Option<Option<Unit>>.Some(Option<Unit>.None);
Console.WriteLine(Api.Classify(nested)); // 1, distinct from outer None
Console.WriteLine(Api.TupleUint32((1, 2))); // (2, 1)

var result = Api.Duplicate(Option<byte[]>.None);
if (result.IsError)
    Console.WriteLine(result.Error); // empty
```

`Option<T>.None` and `default(Option<T>)` mean absence. `Some(default(Unit))` means a present Unit; `Some(Option<U>.None)` preserves the inner absence. Read `Value` only when `IsSome` is true. A null reference payload inside `Some` still fails the payload's conversion rules.

Lean `Except E T` uses `Result<T, E>.Ok(value)` or `.Err(error)`. Check `IsOk` or `IsError`, then read `Value` or `Error`. Domain errors return `Err`; load and conversion failures throw exceptions. An inactive payload property throws `InvalidOperationException`. `default(Result<T, E>)` has no branch and is rejected at the boundary. The wrappers compare active payloads by value, including nested arrays, and support safe `ToString()` calls in every state.

Calls copy array contents even when an option, result or tuple contains them. Returned arrays do not alias the input or each other. The existing 16 MiB conversion budgets and 32-level type limit also apply to compounds. [Compound acceptance](../evidence/dotnet-compounds-20260920.md) covers installed packages, compiler rejections, runtime-only deployment and separately instrumented cleanup checks. Compounds also work in [structured callbacks](#structured-callback-values). Resource-containing aggregates remain separate work.

### Tagged variants

Concrete copied Lean inductives use an abstract record and one sealed record per
constructor. Construct and pattern-match the named cases; you do not supply a
numeric tag or a native layout. Constructor and property names use PascalCase.
Trailing underscores remain when they distinguish source names.

For the `Lean.Variants` acceptance package, install its prepared NuGet archive
using the local-feed steps above and save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Variants;

var value = new SignalData(42, "ready");
Signal result = Api.Next(value);
Console.WriteLine(result switch
{
    SignalIdle => "Idle",
    SignalStopped => "Stopped",
    SignalData(var count, var label) => $"{count}: {label}",
    SignalMarker => "Marker",
    _ => throw new InvalidOperationException("Unknown constructor")
});
```

Run `dotnet run --no-restore`. Cases can contain all nineteen primitives,
copied records, arrays, Lists, options, results, products and other admitted
variants. Only the active case is converted. Empty cases and cases carrying
`Unit` remain distinct. Null cases, active null fields and unrecognized derived
records reject before Lean runs.

Returned arrays own independent storage. Record properties are init-only, but
their array elements remain mutable. Generated records compare nested contents
by value and retain constructor identity. The existing
32-level type bound and 16 MiB native copy budget apply. Failures release
scoped scratch buffers and native outputs. See the
[installed variant checks](../evidence/dotnet-variants-20260921.md).
See [recursive values](#recursive-values) for recursive families. Acyclic variants also work in [structured callbacks](#structured-callback-values). Identity-bearing copied fields remain separate work.

### Comparing copied values

Generated records, named variant cases, `Option` and `Result` compare payloads
structurally, including nested arrays and tuples. Equal values have equal hash
codes, so independently copied values work in dictionaries and hash sets.
Different record types and variant constructors stay distinct. `None`,
`Some(None)`, `Ok` and `Err` also stay distinct. Floating-point comparisons follow
.NET equality: NaNs compare equal, as do positive and negative zero.

Direct C# arrays and tuples keep their language equality behavior. Use
`StructuralComparisons.StructuralEqualityComparer` to compare their nested
contents. For the `Lean.Compounds` package, save this as `Program.cs`:

```csharp
using System;
using System.Collections;
using LeanBridge.Compounds;

var first = Option<byte[]>.Some(new byte[] { 0, 255 });
var second = Option<byte[]>.Some(new byte[] { 0, 255 });
Console.WriteLine(first == second); // True

var left = (new uint[] { 1, 2 }, new byte[] { 0, 255 });
var right = (new uint[] { 1, 2 }, new byte[] { 0, 255 });
Console.WriteLine(StructuralComparisons.StructuralEqualityComparer.Equals(left, right)); // True
```

Arrays remain mutable. Do not change a value's contents while it is a dictionary
key or hash-set member. Comparison does not relax conversion rules: an active
null payload still fails when passed to Lean.

### Callbacks and returned Lean functions

Ordinary-source and compiler-checked reviewed packages accept synchronous callbacks and returned functions across all nineteen primitives and acyclic copied values. Callbacks use typed `Func<...>` delegates, or `Action<...>` for a Unit result. Parameters and results retain their ordinary C# mappings, including `BigInteger` and `Rune`. No native pointer or marshalling code appears in your application.

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

The runtime shares a capacity of 4,096 closure identities. Each call has a 16 MiB conversion budget; the limit does not bound Lean's own allocations. Calls in a forked child require starting a fresh process. Recursive callable payloads, resource-containing aggregates and asynchronous delivery remain separate work. The [installed callable checks](../evidence/dotnet-callables-20260919.md) record exact values, exceptions, ownership and source-free execution.

### Structured callback values

The prepared `Lean.Structured` NuGet package uses typed `Func` delegates for
arrays, Lists, nested options, results, binary tuples, copied records, named
variants and aliases. These shapes also work in returned function arguments,
results and captured values. Install the archive using the local-feed steps
above, then save this as `Program.cs`:

```csharp
using System;
using LeanBridge.Structured;

var rows = new[] { Option<string>.None, Option<string>.Some("original") };
var copied = Api.CallArray(rows, values =>
{
    values[1] = Option<string>.Some("copied");
    return values;
});
Console.WriteLine(copied[1].Value);
Console.WriteLine(rows[1].Value == "original");

using var captured = Api.MakeArray(rows);
rows[1] = Option<string>.Some("changed after capture");
Console.WriteLine(captured.Invoke(true, Array.Empty<Option<string>>()).Length);
```

Run `dotnet run --no-restore`. The [installed checks](../evidence/dotnet-structured-callables-20260924.md)
cover both build paths. Callback inputs and results own independent
managed storage, including nested arrays. You may keep a callback argument
after the call returns. `None`, `Some(None)` and `Some(Some(default(Unit)))`
remain distinct; `Result` retains success and error branches. Aliases use their
target's C# type. Exceptions propagate after scoped buffers and native results
are released. Use `using` to dispose returned closures.

The 16 MiB per-call copy budget and 32-level acyclic type bound still apply.
[Recursive callback payloads](#recursive-callback-values) use the finite-graph
projection below. Resource-containing aggregates remain separate work. Host
callbacks borrow the call and must finish synchronously.

### Recursive callback values

Save this example as `Program.cs` in a project that references the prepared
`Lean.Structured` package:

```csharp
using System;
using LeanBridge.Structured;

var original = new TreeLeaf(19);
var changed = Api.CallRecursive(original, tree => tree is TreeLeaf leaf
    ? new TreeLeaf(leaf.Value + 1)
    : tree);
Console.WriteLine(((TreeLeaf)changed).Value);

using var choose = Api.MakeRecursive(original);
Console.WriteLine(((TreeLeaf)choose.Invoke(true, changed)).Value);
Console.WriteLine(((TreeLeaf)choose.Invoke(false, changed)).Value);
```

The output is `20`, `19`, then `20`. Callback inputs and results have independent
copied storage. `TreeBranch.Children` is a typed array, and transparent aliases
keep the underlying C# value type.

Callbacks use synchronous `Func` or `Action` delegates and expire when their
exported call returns. Returned `LeanClosure` values expose `Invoke`, `IsClosed`
and `Dispose`; `using` releases the native identity deterministically. A closure
runs on its creating thread and process. Disposal during an active call defers
release until the call returns. Callback exceptions retain their object identity
after conversion storage is released.

Conversions allow 128 value levels, 262144 visited nodes, a 16 MiB native-copy
budget and a separate 16 MiB conversion-storage budget. Native reentry allows 64
active calls, and owned closures share 4096 identity slots. These bounds do not
limit all CLR allocations or Lean working memory. Invalid copied inputs and
depth/node limits raise `ArgumentException`; native allocation or identity-arena
exhaustion raises `OutOfMemoryException`. Those errors allow subsequent calls.
Malformed native output retires the runtime.

Resource-containing aggregates, callable identities inside copied containers,
retained host callbacks, asynchronous delivery and post-fork calls are not part
of this projection.

The [installed acceptance record](../evidence/dotnet-recursive-callables-20260926.md)
includes both source paths, fault injection, typed callers, and SDK-free execution.

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
| `Unit` | `Unit` (input, field, callback input); `void` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass default(Unit); Unit results return void. Unit fields and array elements use the generated Unit value type. Pass default(Unit); Unit callback results use Action and return void. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `byte` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `ushort` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `ulong` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `sbyte` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `short` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Arbitrary-precision BigInteger. Negative input throws; zero and multi-limb magnitudes copy without floating-point conversion. Exact System.Numerics.BigInteger; negative Nat inputs and callback results throw. Copied arguments and captured values remain independent. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `BigInteger` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Signed arbitrary-precision BigInteger with exact sign and magnitude. Signed exact System.Numerics.BigInteger; no fixed-width or floating-point narrowing. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Strict Unicode conversion preserves embedded NUL. Invalid UTF-16 input throws; null is not an empty string. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `byte[]` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Copied byte arrays with independent returned storage. Null is rejected. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `T[]` (input, result, field); `T[] with independently copied contents` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Recursive copied T[] values, including jagged arrays and arrays of records. Input scratch and deep native outputs are released on failure. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Typed T[] preserves every primitive, element order, empty and nested arrays and records. Returned mutable storage is independent. Null arrays, invalid nested values and oversized copies reject without retaining scratch. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `Option<T>` (input, result, field); `Option<T>.None or Option<T>.Some(value)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated readonly record struct with None and Some factories, IsSome/IsNone and guarded Value. `default(Option<T>)` is None; Some(None) and Some(Some(Unit)) remain distinct. Active null reference payloads reject. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Result<T, E>` (input, result, field); `Result<T, E>.Ok(value) or Result<T, E>.Err(error)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean `Except E T` uses `Result<T, E>.Ok(value)` or `.Err(error)`. IsOk/IsError select guarded Value/Error. `default(Result<T, E>)` has no branch and rejects at the boundary. Domain errors return Err; bridge failures throw exceptions. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `(A, B) (nested binary products)` (input, result, field); `C# (A, B) tuples (nested binary products)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly two statically typed C# tuple elements, preserving binary nesting. Inputs are copied; returned arrays own independent storage. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated sealed record` (input, result, field); `Generated sealed C# record` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated sealed C# records preserve declared fields through compiler-owned constructors and accessors. Arrays inside returned records are independent copies. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Named sealed C# records preserve declared typed fields through init-only properties, constructors, deconstruction and with expressions. Empty and one-field records remain distinct. Records compare nested payloads structurally and hash consistently; floating equality follows .NET NaN and signed-zero semantics. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `CLR target value; named Lean contract in installed metadata and XML docs` (input, result, field); `CLR target value without an extra wrapper` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Aliases add no wrapper identity or consumer configuration. CLR signatures keep exact widths, BigInteger, Rune, typed arrays and copied records. Nat rejects negatives despite sharing BigInteger with Int. Unit results return void; nested Option/Result presence and existing copy budgets remain unchanged. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `abstract C# record with sealed named constructor records` (input, result, field); `Abstract record with named sealed constructor records` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Construct and pattern-match named case records without numeric tags or unmanaged layouts. Empty cases and Unit payloads stay distinct. Inputs and outputs contain independent copied storage. Only the active payload is converted; invalid native tags reject before union reads. Scoped scratch disposal and native output guards release partial conversions on errors. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Func<...> / Action<...>` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Typed synchronous Func/Action delegates borrow the call. Exceptions preserve their original object and stack after cleanup. Async void delegates reject before execution. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `T[]` (input, result, field); `T[] with independently copied contents` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Typed C# arrays preserve empty Lists, order, duplicates and nesting. Returned arrays and mutable payloads own independent storage. Null arrays and invalid payloads reject; native lengths, missing buffers and alignment are checked before output allocation or reads. Scratch and native output cleanup runs on conversion failure. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows and over-budget values reject without retaining partial owners or closure leases. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `System.Text.Rune` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Rune preserves supplementary characters; System.Char alone cannot. System.Text.Rune stores one Unicode scalar, including NUL and supplementary code points. Surrogates are rejected by its constructor. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `ulong` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. ulong for the 64-bit compiled Lean target; all bits are preserved. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `long` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. long for the 64-bit compiled Lean target; signed endpoints are preserved. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named records and sealed constructor cases; typed arrays, Option<T>, Result<T, E> and tuples` (input, result, field); `Named sealed C# records and constructors, typed arrays, synchronous Func/Action delegates and owned LeanClosure values` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated records and cases preserve direct and mutual recursion. Typed arrays remain mutable; calls return independent copied storage. Cycles, null payloads and malformed branches reject. Conversions enforce 128 value levels, 262,144 visited values and separate 16 MiB native-copy and scratch/output budgets. Native outputs and partial input allocations are released on failure. Recursive records, variants and aliases retain typed C# representations and independent copied storage. Callback scopes retain reply buffers until native copying finishes. Exceptions retain their identity after cleanup. Malformed native output retires the runtime. Owned closures defer disposal during active calls, and finalizers release abandoned identities. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
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
