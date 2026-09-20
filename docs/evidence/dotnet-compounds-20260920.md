# Compiled C# options, results and products

VO1219 adds `Option`, `Except` and nested binary products to prepared NuGet
packages. Ordinary-source and independently reviewed-IR builds compile the
same 64-export Lean fixture. Payloads can use all nineteen primitives, arrays,
acyclic copied records and these constructors within the 32-level type limit.

| Lean | C# |
| --- | --- |
| `Option T` | `Option<T>.None` or `Option<T>.Some(value)` |
| `Except E T` | `Result<T, E>.Ok(value)` or `Result<T, E>.Err(error)` |
| `A × B` | `(A, B)` |

Generated readonly record structs preserve presence and branch identity.
`default(Option<T>)` is `None`; `Some(None)` and `Some(Some(Unit))` retain their
distinct states. `default(Result<T, E>)` has no branch and the adapter rejects
it. Accessing an inactive payload throws. Lean errors return `Err`; bridge
failures throw exceptions. Native C# tuples retain binary nesting.

Inputs are copied across the boundary and returned arrays own independent
storage. Active null reference payloads reject. The wrappers use C# value
equality for their fields; array payloads retain C# reference equality.
The adapter reuses the typed Lean constructors and projection helpers from the
[native compound implementation](native-compounds-20260920.md). Native flags,
pointers and runtime loading stay out of the public API.

## Installed validation

```sh
LEAN_BRIDGE_DOTNET_COMPOUND_TEST=1 node --test tests/dotnet-compounds.test.mjs
node --test tests/dotnet-compound-contract.test.mjs
```

The [machine-readable record](dotnet-compounds-20260920.json) retains archive,
receipt, source, compiler, assembly and deployed-file hashes. Each source path
passes 41,534 installed consumer assertions with .NET SDK 8.0.424 and runtime
8.0.30. The test removes the producer workspace before offline installation
from a relocated NuGet feed. The consumer references only the prepared package.

The consumer checks exact 5,121-bit integers, fixed-width limits, floating-point
edge cases, Unicode and embedded NUL, every byte value, nested Unit options,
both error branches, arrays and record fields. It independently constructs
24-level nested option types, checks each absent level, verifies independent
output storage and calls copied functions from four threads. Invalid values,
partial inputs and oversized input/output copies reject; later calls succeed.
Twelve compiler rejection cases check wrong payloads, nullable or bare values,
product arity, overflow and attempts to mutate branch flags.

The test verifies the installed assembly and native assets against the package
receipt. It then removes consumer sources, build directories, NuGet caches,
the feed and probe sources. Only the relocated deployment and a copied .NET
runtime remain. With no SDK and `PATH=/unavailable`, the same consumer passes
41,534 assertions twice; deployed-file hashes remain unchanged.

## Cleanup probes

A separate instrumented copy of the verified generated C# adapter checks
cleanup. It uses the same compiled native libraries, but does not modify the
installed release assembly. Across 94 injected conversion and scratch-allocation
failures, the probe checks zero live scratch buffers, exactly one output clear
per native call and a successful next call. Sixteen partial-input failures test
cleanup before invoking Lean. Nine malformed-output checks reject flags other
than zero or one and ignore poisoned inactive payloads. The record retains both
original source hashes and the instrumented source hash. Native allocator fault
coverage remains in the C/C++ compound suite.

Managed input copying has a 16 MiB accounting budget. Native copying shares a
separate 16 MiB budget across inputs and outputs. These budgets do not bound
every managed allocation or Lean working memory. Local acceptance uses Linux
x86-64 with glibc floor 2.36; CI builds the
supported 2.38-floor packages. No other operating system is claimed here.

This milestone promotes 18 C# profile/path/type/position cells: options, results
and products in inputs, results and fields through both source paths. Compound
callables, lists, aliases with distinct runtime identity, tagged variants,
recursive copied types and resource-containing copies remain separate work.
