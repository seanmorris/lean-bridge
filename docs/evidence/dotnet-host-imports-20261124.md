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

This is a native integration test, not an installed NuGet consumer. The fixture
currently supplies the outer component entry and tests a static scalar call
through native code. Canonical identity for managed instances across
independently installed assemblies is a separate requirement.
