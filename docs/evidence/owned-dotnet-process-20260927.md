# C# process-origin hardening

Task 1219. This change extends the [installed NuGet milestone](owned-dotnet-packages-20260927.md).

The common native loader publishes its original process ID before loading Lean.
Another package's loader reads that origin even when first initialized after
`fork`. Its process check rejects the call before entering Lean Bridge's shared
registry lock. Previously, a cold loader could adopt the child's ID and wait on
a lock whose owning thread existed only in the parent.

## Installed checks

The peer test installs two ownership-aware packages, a copied recursive package
and an ordinary package. It checks 18 combinations of loading order, retirement
and already-initialized fork probes. It then runs six cold-loader processes:
three with the fixed guard and three with a deliberately broken guard.

Each cold probe initializes Lean through an installed public API. The test
observes that the parent loader published its ID; it does not write that ID on
the loader's behalf. Another thread holds the registry lock across the fork.
The child first initializes the exact emitted common loader, with an explicit
type initializer added to make its unused parent state observable. The fixed
loader rejects the call. The counterfactual adopts the child's ID and its
process check incorrectly permits the call.

The probe prepares its reverse P/Invoke and exception paths before forking. A
native parent waits for the child and exits without returning to the CLR.
Default CLR protections remain enabled. These checks test Lean Bridge's guard;
they do not establish general support for executing arbitrary CLR code after
`fork`.

Fresh ordinary-source and reviewed-IR NuGet checks cover composition and scalar
packages, safe public APIs, compiler rejections, the documentation example and
SDK-free execution after removal and relocation. Primitive, structured and
recursive callback suites cover the existing copied APIs with the new loader.
The target-admission check accepts NuGet for ordinary and reviewed owned APIs,
while rejecting unsupported targets and mixed target sets before compilation.

## Receipt history

The [process receipt](owned-dotnet-process-20260927.json) binds these executions,
native evidence, probe sources and reversible whole-file source transitions.
It preserves the original foundation, callback, loading and installed-package
receipts. Earlier generated C# files are reconstructed through recorded edits
and must match their original complete hashes.

This milestone promotes no type-surface cells. Transferred inputs, anchored
results, retained asynchronous callbacks and Wasm ownership remain separate
parts of task 1219.
