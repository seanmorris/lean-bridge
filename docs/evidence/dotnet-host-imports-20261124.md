# Checking CLR-owned members against Lean source

Lean 4.32.2 checked an application that imports `LeanBridge.Host.Dotnet`. Its
`Box` contract declares a constructor, a read method, a mutable property,
and a method returning the receiver. The application's public functions
select those members as dependencies; an `EIO String` version maps the
failure of the read method.

Run `npm run test:dotnet-host-imports` with `LEAN_BRIDGE_LEAN_PREFIX` set to
the Lean installation. The [compiler test](../../tests/helpers/native-host-import-check.mjs)
captures the Lake graph, generates the target-specific import module, and
compiles both that module and the application. It builds again with a reviewed
public binding IR. Both routes produced the same public IR SHA-256
(`390ec160341bbf0aacc880dd579eb7daa4b085592e48801051969aca315b5762`) and
generated import-module C SHA-256
(`782426ece57e05bcb0ea4ffed3636440c5c71fecb3baac3a5ac74c972c6c08ae`).

The public interface distinguishes an escaping `DotNetHostException` from a
Lean `IO.Error` and from the mapped, declaration-specific `EIO` error.
The compiler checks the exact imported member names and native symbols.
The negative cases reject a foreign host module or external symbol, a
mismatched callback scheduler, a stale reviewed member, and application
source shadowing the generated module.

The JVM and Ruby source checks were rerun against the same compiler change.
Each reproduced its previously recorded public IR and generated host C digests:
[JVM](jvm-host-imports-20261124.md) and [Ruby](ruby-host-imports-20261124.md).

## Synchronous CLR calls through compiled Lean

With .NET SDK 8 and a C compiler installed, run
`npm run test:dotnet-host-members`. Set `LEAN_BRIDGE_DOTNET` to the SDK's
`dotnet` executable if it is not on PATH. The test compiles a Lean caller,
links its real extern to a C shared library, builds a C# application with an
empty NuGet source list, and launches it without publisher tools on PATH.

The generated CLR binder resolves the public constructor, mutable property,
instance method and exact unsigned overload of an overloaded static method
before the application calls them. The compiled Lean call uses a private
reverse-call frame on the main thread. A C# method can reenter Lean; two
exceptions with identical messages stay distinct when Lean catches both and
rethrows the first. The consumer gets the same exception object even when it
is itself a `TargetInvocationException`. Mapping the failure in Lean,
replacing it with an identically worded IO error, or catching it completely
does not resurrect the original exception. A worker-thread call is refused.
An injected `OutOfMemoryException` is not allowed to unwind through native
code: the caller receives it after returning to managed code, even when Lean
tries to swallow it, and the retired fixture runtime refuses further calls.

The integration test now generates all 20 imported extern definitions from
the checked contract: the throwing observation method and one method per
primitive type. The generated prototypes compile alongside both Lean C units.
C# verifies each input independently, changes its value, and Lean checks the
result. Cases include signed minima, unsigned maxima, 160-bit integers, NaNs
and signed subnormals, Unicode scalars, embedded NUL, and a mutated byte-array
copy. A negative CLR result for `Nat` and an unpaired surrogate in a returned
string produce boundary validation errors. Copied buffers have a 16 MiB budget;
exact integers use the existing native word-magnitude conversion.

## Nominal identity across CLR assemblies

Run `npm run test:dotnet-host-domain` with the same SDKs. The test builds
two separate C# assemblies and two Lean native components. Each build produces
the same reference-domain library. The client loads the assemblies into
separate collectible contexts, in both orders in fresh processes, after their
source and build directories have been removed.

One component calls the application’s identity method and retains the returned
Lean value. The other compares its own wrapper with that value using Lean’s
`ptrEq`. The same C# object shares a wrapper across components; objects that
compare equal in C# and two distinct nominal kinds do not. The test also
constructs a C# object from Lean, changes its property, and returns the object
after the native call releases its temporary wrapper.

A borrowed child keeps its parent alive until Lean releases the child. A
partially incompatible binding and a rejected second argument leave no pins.
Closing a binding inside its own call is refused. Closing the last binding
invalidates even a still-retained Lean wrapper, and a collected binder is
swept on the next owner operation. At exit the client observes zero native
rows, zero managed handles, and both assembly contexts unloading.

The two native tests use fixture entry points to observe internal invariants.
Use the package test below to check the public API and delivery path.

## Installed NuGet consumer

Run `npm run test:dotnet-host-packages` with the same Lean and .NET SDKs.
The test installs the publisher CLI with npm offline, builds Workshop and a
separate peer, verifies the package-set receipts, and deletes the producer
directories. It repeats with each package’s public binding IR as review
input. `LEAN_BRIDGE_DOTNET_HOST_HANDOFF_TMP` can put the compressed handoffs
on a different filesystem from the NuGet restore cache.

The [C# client](../../tests/fixtures/dotnet-host-meter/Installed.cs) has two
ordinary `PackageReference` entries. It runs from relocated build output
after the project and restore cache have been removed, with publisher tools
off `PATH`. It checks both package load orders. A separate process tries to
open a binding after the installed domain library is modified.

| Observation | What the client checks |
| --- | --- |
| Object owned by C# | Construct it from Lean, change its property through the peer, and get back the original C# object. Closing the last binding invalidates a saved Lean wrapper. |
| Returned `Except` versus thrown `EIO` | Inspect nested success/error branches as data; catch `DeclaredError<T>` with the exact declaration and typed payload. A C# object in either path retains its identity. |
| Host, IO, and fatal failures | A nested call rethrows the original `TargetInvocationException`; Lean can replace it with an IO error. If a setter swallows a peer’s fatal exception, Lean cannot call the following getter. |
| Copied public calls | The [scalar client](../../tests/fixtures/dotnet-host-meter/InstalledScalars.cs) checks all 19 carriers, including integer extremes, floating-point bits, wide integers and copy isolation. Invalid UTF-16, negative `Nat` and over-budget input are rejected before another valid call. |

This evidence covers synchronous host imports on .NET 8/Linux x86-64. It
does not establish arbitrary dynamic member lookup or asynchronous host
imports.

Two checks need the installed public API. First, passing `sbyte.MinValue`
from C# to Lean exercises a different encoder from returning an `sbyte` from
a C# member called by Lean. The public encoder must send eight bits, not a
sign-extended 64-bit word; the same rule applies to `short` and `int`.
Second, each component has a separate native call stack. A callee can retire
the shared runtime even when its caller catches the original exception. The
setter/getter case checks for a second application effect, not just the
exception reported when the outer call returns.

On 2026-11-24 both relocated consumers passed in **both load orders** on
each source route. A fresh process on each route rejected the modified
host-domain library. These are local package-set receipt and archive hashes;
no public registry or hosted runner was used.

| Source | Package | Receipt SHA-256 | NuGet SHA-256 |
| --- | --- | --- | --- |
| ordinary | workshop | `2903c45ffc127e51d66d82d13e4aa816b8e43fab2fdf4665923d7a5042a5bdaf` | `f2eab687b569401f726124d356179f17a625c5a8a25d30fb04282f9d8101ba5e` |
| ordinary | workshop-peer | `774153132b1db3e8da04a1ffa0f0d139cc6b311242a33e14cd4cf5340b5ada1f` | `d81aea66f2f28e1a7cd0b77266cf1570715bb76813c266c91ebf631997d66ef3` |
| reviewed | workshop | `857716b83edc283e2e2f4dc0aff4b9e1ba17eccebf7ab60154be4b2807bf8c31` | `0574a19ee2f59277f46aae72c29b2c32177d37a798d7e3db1e91564ed0572772` |
| reviewed | workshop-peer | `aa0c180282adbf355b6761bbfec809d7d7916a7aa7cc1cd778fa5731223c6358` | `3109d83e2f913f9ecc34dc68e54f444b03b7c6afbda9aeae7af798d78046f6ad` |
