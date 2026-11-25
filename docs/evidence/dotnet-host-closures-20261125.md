# Calling a returned Lean function from C#

The [installed client](../../tests/fixtures/dotnet-host-closures/Program.cs)
gives Lean one C# object to capture, then calls the returned function with
a different object. `ReferenceEquals` checks that the answer is the original
capture. A second function returns the capture through its C# `Identity`
method; the caller sees a property mutation made after the factory returned.
A member that throws
inside either the factory or the invocation returns the original exception
object to C#. A null argument is a separate argument error.

Closing a function inside its own call leaves that call's return value
intact but revokes later calls immediately. The client also re-enters
another function, attempts to invoke and dispose on a different thread,
and closes one binding while a sibling remains live. A new binding cannot
revive an old function.

The collection checks distinguish three lifetimes. An abandoned function
releases its capture while its binding is still open. A live function
cannot keep an abandoned binding alive. Dropping the last external binding
reference *during* an invocation still lets that call return its capture.
The CLR finalizer queues work; the test drains that queue on the process
main thread. In a separate process a member deliberately throws an
`OutOfMemoryException` instance without exhausting memory. The client
receives that same instance, its sibling cannot start another invocation,
and explicit disposal still works. The strong and weak reference tables
must both finish empty.

The worker package also returns the same object through `Task<Box>` and
reads a file through a returned function. The client checks the error for
a missing file, then reads two different contents after editing the file.
The [callback client](../../tests/fixtures/dotnet-host-closures/WorkerChecks.cs)
calls a returned function from a Lean task's C# callback and receives the
original C# exception. It starts two more tasks, one per binding. Closing
the first skips its callback, cancels its task and revokes its function.
The sibling callback runs once and returns the original object.

| Linux .NET 8 installation | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary Lean exports | `6376a39f98ed0088711974d664b8885e5d2174e1c7732b72f289d4d6c7727e91` |
| Reviewed public interface | `5f15779a0fccf00359401007432d909c8b9f445590ee275f1c1de21d5efa13a0` |
| Task callbacks and filesystem grant | `5ea91309fc99b18db14834fd8a39a65f30f8db4e65a9409be26d4cb5c337860d` |

Run `npm run test:dotnet-host-closures` with the Linux native publisher
toolchain and the .NET 8 SDK. The [test](../../tests/helpers/dotnet-host-closures-installed.mjs)
installs the publisher from its offline archive, verifies each package-set
receipt, restores the C# client from the release feed alone, and removes
the feed, client sources and NuGet cache. It executes the relocated client
with publisher tools off its path. A reviewed interface naming the Rust
owner and a file-reading factory without its filesystem grant are refused
before either can produce a release directory.
