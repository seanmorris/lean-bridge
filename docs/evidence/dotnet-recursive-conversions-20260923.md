# Recursive C# native conversions

The C# graph converters call compiled Lean through the finite native copied-value
ABI. Public records, named variant cases, arrays, nested tuples, Options and
Results remain separate from the private unmanaged structs. C# uses a byte for
native Bool and Unit storage, `BigInteger` for arbitrary-precision integers, and
`Rune` for Unicode scalar values. Native layouts require a little-endian 64-bit
process.

Every call validates all arguments before allocating native scratch or
initializing Lean. Validation rejects cycles, null payloads, negative Nat,
unpaired UTF-16 surrogates, default Results and uninhabited types. Shared acyclic
subtrees are copied normally. Inactive Option and Result payloads are not read.

Input and output conversion share a scope with a depth limit of 128 and a total
budget of 262,144 visited values. Separate 16 MiB budgets bound native-layout
storage and scratch/output storage. Exceeding a budget raises an
`ArgumentException`; allocation failure raises `OutOfMemoryException`. A
preflight source budget also rejects repeated large CLR signatures before
constructing oversized converter source.

The scope owns every temporary native allocation. Output arrays, bytes, text and
records are independent managed copies. The call releases the native output
arena in `finally`, including when conversion fails. Release follows the arena's
allocation ledger, not potentially malformed child pointers or variant tags.
Invalid native values retire the runtime and raise `LeanBridgeException` with
status 4. A runtime retired during conversion cannot publish a successful result.
Previously owned native output remains releasable after retirement.

Readers check tags, flags, Unicode, canonical integer magnitudes, span arithmetic,
alignment and cycles. The authenticated native adapter must supply readable
process memory; these checks cannot make an arbitrary foreign pointer safe.

## Executed checks

```sh
LEAN_BRIDGE_DOTNET_GRAPH_CONVERSION_TEST=1 \
LEAN_BRIDGE_DOTNET_GRAPH_NATIVE_TEST=1 \
  node --test tests/dotnet-copied-graph-conversions.test.mjs
```

The isolated test compiles an independent C probe and a generated .NET 8 caller.
It compares 478 sizes, alignments and field offsets, including wide variant
payloads and recursive records through Option and Result. It injects failures
before and after scratch allocation and during output copying. Invalid native
tags, flags, text, spans and status codes exercise cleanup and retirement. A
separate compiled program verifies public names that overlap with CLR or private
adapter names. It includes a public type named `V`, which reproduced a C# name
lookup collision with the initial converter alias. The private alias now starts
with an underscore, which generated public type names cannot use.

The native test builds fresh Lean components from ordinary source and from an
independently authored reviewed contract. All 18 exports execute through the
generated C# call methods. Lean independently checks every primitive field.
Other checks cover mutual recursion, nested absence/error states, empty values,
input mutation, a 512-tree forest, deep narrow and wide recursion, and rejection
before initialization when the second argument is invalid.

Each source path runs four isolated processes for malformed Lean carriers,
malformed native tags, native cycles, and retirement during managed result
construction. Each process also fails every observed native output allocation,
C# scratch allocation and explicit conversion checkpoint, checks cleanup, and confirms that
recoverable failures leave the runtime usable.

CI requires both tests and retains `build/recursive/dotnet-conversions.json` and
`build/recursive/dotnet-native.json`. The recorded source hashes and observations
are in [the conversion receipt](dotnet-recursive-conversions-20260923.json).
These checks do not enable recursive NuGet builds or claim installed-package
support. Authenticated package loading, original offline NuGet installation,
package composition and exact consumer documentation execution remain the next
C# acceptance stage in VO 1219.
