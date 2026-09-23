# Recursive C# value declarations

The C# graph generator emits sealed record classes for copied Lean records and
named variant cases. Direct and mutual recursion retain nominal references.
Arrays and Lists use typed arrays; binary products use nested value tuples.
Nat and Int use `BigInteger`, Char uses `Rune`, and platform words use the
native 64-bit profile's `ulong` and `long`.

Options retain `None`, `Some(Unit)` and nested `Some(None)` as distinct values.
Results expose `Ok` and `Err`; a default result has no active branch. Accessing
an inactive payload throws. Record properties are init-only; their array
contents remain mutable. Construction does not validate every Lean input
invariant. Native conversion must reject null payloads and negative Nat values.

Generated `Equals` methods and hash codes compare nested payloads by value.
The explicit traversal stack allows shared acyclic subtrees, rejects cycles,
and bounds traversal to depth 128 and 262,144 node visits. An unequal prefix
does not hide an invalid later branch. Covariant input arrays compare equally
with arrays of the declared element type. Floating equality follows .NET,
including NaNs and signed zero. Do not mutate arrays while their containing
value is a dictionary key or hash-set member.

`ToString` uses the same bounded traversal and emits at most 4,096 characters
plus a truncation marker. It does not recursively call record formatting or
expand an arbitrarily large integer into decimal text.

C# requires a protected record copy constructor on an abstract record. The
generated constructor checks the actual case type so another assembly cannot
use that constructor to instantiate an undeclared variant case. Valid `with`
copies still work. Later native conversion must also check exact case types.

Aliases retain their Lean names and original targets in metadata and comments,
without adding CLR wrapper classes. A chain of 700 transparent aliases remains
finite. Structural CLR type expressions are limited to 32 container levels
and 65,536 characters. The generator rejects exponential alias expansion
before emitting that type. A named record or variant can separate structural
levels without changing the runtime recursion limit. Total generated
declarations are limited to 4 MiB.

## Executed checks

```sh
LEAN_BRIDGE_DOTNET_GRAPH_TEST=1 \
  node --test tests/dotnet-copied-graph-values.test.mjs
```

The test compiles the generated types into a .NET 8 library, then compiles a
separate consumer assembly with warnings treated as errors. Execution covers
every primitive field, direct and mutual recursion, linked records, a 32-level
array field, a 256-field constructor, nested compounds, pattern matching,
structural equality and hashes, mutation, shared subtrees, cycles, and limits.
Nine invalid consumer programs must fail with their expected C# diagnostics.
An additional execution check rejects the protected-copy-constructor escape.

The downstream CI job requires this test and retains
`build/recursive/dotnet-values.json`. It contains generated-source hashes,
the consumer hash, execution observations and expected rejection diagnostics.
These are public declaration tests. They do not invoke Lean, enable recursive
NuGet builds, or promote installed-support coverage. Bounded native converters
and original offline-installed NuGet acceptance are the next C# steps in
VO 1219.
