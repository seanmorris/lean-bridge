# .NET, JVM, and Ruby consumers

The managed package profile targets x86-64 Linux with glibc 2.38 or newer. It carries one process-wide Lean runtime and independently compiled Alpha and Beta components in each registry archive. Alpha supplies the generated consumer API. Beta is retained as a private cross-component conformance probe. Package installation runs no compiler, linker, native extension build, or lifecycle script.

The current generated surface covers copied `Bool`, `UInt32`, UTF-8 `String`, `ByteArray`, and `Array UInt32` values, identity-bearing resources, synchronous callbacks, returned Lean callables, declared failures, and deterministic close. Asynchronous results, iterators, additional operating systems, and additional architectures remain outside this profile.

## .NET 8 and NuGet

Create an ordinary .NET 8 application and restore the deterministic package from its directory:

```sh
dotnet new console --framework net8.0
dotnet add package LeanBridge.Alpha --version 0.0.0 --source <nuget-package-directory>
```

```csharp
using LeanBridge.Alpha;

using var box = new Box(42);
Console.WriteLine(box.Read());

var value = Alpha.RoundTrip(new Payload(
    true, 41, "Lean", new byte[] { 0, 255 }, new uint[] { 1, 5, 13 }));
Console.WriteLine(value.Count);
Console.WriteLine(Alpha.WithCallback(40, current => current + 2));

using var addTwo = Alpha.MakeAdder(2);
Console.WriteLine(addTwo.Invoke(40));
```

`Box` and `OwnedTransform` implement `IDisposable`. Repeated `Dispose()` is harmless, and using a disposed value raises `DisposedResourceException`. The private transport uses source-generated `LibraryImport`; no public pointer type appears in the API.

## JDK 22, Kotlin, and Maven

Add the generated repository as an ordinary Maven repository, then depend on the package:

```xml
<dependency>
  <groupId>org.leanbridge</groupId>
  <artifactId>lean-alpha</artifactId>
  <version>0.0.0</version>
</dependency>
```

Run with native access enabled for the unnamed module:

```sh
java --enable-native-access=ALL-UNNAMED -cp <application-and-dependencies> Main
```

```java
import org.leanbridge.alpha.*;

try (Box box = new Box(42)) {
    System.out.println(box.read());
    System.out.println(Alpha.withCallback(40, current -> current + 2));
    try (OwnedTransform addTwo = Alpha.makeAdder(2)) {
        System.out.println(addTwo.apply(40));
    }
}
```

`Box` and `OwnedTransform` implement `AutoCloseable`. The private transport uses the finalized JDK 22 Foreign Function and Memory API. It does not use JNI and exposes no `MemorySegment` in the public API.

The same JAR is directly consumable from Kotlin. The clean acceptance run compiles and executes a Kotlin source file against the resolved Maven artifact, then loads the public Java API through two isolated class loaders to verify that both resolve the same process-wide runtime broker.

## MRI Ruby 3.3 and RubyGems

Install the generated gem locally without a native extension build:

```sh
gem install ./lean_bridge_alpha-0.0.0.gem --local --no-document
```

```ruby
require "lean_bridge/alpha"

box = LeanBridge::Alpha::Box.new(42)
puts box.read
puts LeanBridge::Alpha.with_callback(40) { |current| current + 2 }

add_two = LeanBridge::Alpha.make_adder(2)
puts add_two.call(40)
add_two.close
box.close
```

Explicit `close` is authoritative and repeated close is harmless. The private transport uses Ruby `Fiddle`; the gem has no compiled Ruby extension and exposes no `Fiddle` pointer in its public RBS surface.

## Verification

`npm run test:consumer:managed` builds the pinned packages, restores or installs each archive into a clean project, verifies its canonical package receipt, and exercises copied values, identity, callbacks, returned callables, repeated close, stale use, and two-component runtime composition against real Lean. It also compiles Kotlin, checks isolated JVM class loaders, verifies callback thread affinity, compacts Ruby's GC, and records installed-API performance. A distributed NuGet, Maven, or RubyGems archive uses the signed archive handoff in the [consumer guide](consumers.md#authenticate-a-release-archive) to authenticate the exact downloaded bytes and coordinate. See [managed consumer acceptance](evidence/managed-consumer-acceptance.md).
