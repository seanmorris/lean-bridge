# Compiled C# arrays and records

VO1219 adds installed collection evidence for ordinary-source and independently
reviewed NuGet packages. The 35-export contract covers all nineteen primitives,
seven record types and 24 fixed Array nesting levels.

## Installed validation

Use the pinned .NET 8 SDK and author toolchain:

```sh
LEAN_BRIDGE_DOTNET_COLLECTION_TEST=1 node --test tests/dotnet-collections.test.mjs
node --test tests/dotnet-collection-contract.test.mjs tests/dotnet-collection-evidence.test.mjs
```

Both source paths pass 660,970 assertions across 3,364 public calls and 57
runtime rejections per execution. Sixteen invalid public callers fail with their
expected compiler diagnostics. The [machine-readable record](dotnet-collections-20260922.json)
retains source signatures, original archives, installed files, compiler identities,
public caller hashes and independent build logs.

The suite removes the author project before offline installation into an empty
NuGet cache. It verifies the installed assembly and generated sources against the
original package, then checks all 32 installed files remain unchanged across
public executions and separate failure probes. Four native libraries retain their
recorded identities. The consumer uses only the public C# API.

After relocation, the suite removes the package cache, handoff, projects and
generated sources. A separate runtime-only directory reports no installed SDKs.
The public caller runs twice more; the consumer documentation example also runs
there and prints its independently checked output. An independent rebuild
reproduces original archives, package contents and public observations. Ordinary
and reviewed archives have distinct source receipts but identical native libraries.

Cases cover 5,121-bit integers, fixed-width limits, both floating-point widths,
subnormals, infinities, NaNs, signed zero, Unicode, embedded NUL and byte arrays.
Lean independently checks every primitive element and record field. Empty and
single-field records, changed field order, nested arrays, repeated values and
independent mutable copies retain their meanings. Oversized copies reject and
the next valid call succeeds. Four threads repeat 512 public calls.

## Value equality

Generated records, named variant cases, `Option` and `Result` now compare nested
payloads structurally and produce matching hashes for equal values. Different
record types, variant constructors and option/result branches remain distinct.
Records retain init-only properties, deconstruction and `with` expressions.
Arrays inside these values remain mutable; changing a key after insertion can
invalidate dictionary or hash-set lookups. NaNs and signed zeros follow .NET
value equality. Conversion tests separately check preserved floating-point bits.

Direct C# arrays and tuples retain their language equality behavior. Consumers
can use `StructuralComparisons.StructuralEqualityComparer` for their contents.
A host-only compiled test passes 3,246 equality and hash checks across collections,
compounds, Lists, aliases and variants. It does not load Lean or claim additional
installed package executions. Installed collection callers separately check
record equality and matching hashes after copying through Lean.

## Failure cleanup and validation

Separate copies of the generated runtime inject managed allocation failures at
391 host-conversion and 551 real-native-call checkpoints per source path. Each
probe checks 64 partial invalid inputs, zero tracked live scratch allocations,
and one native output-clear call for each started aggregate call. A later public
call succeeds after every injected failure. Original package files never change.

The host-only conversion test passes 21,709 assertions and 97 rejections. It
checks bounded and aligned native buffers, canonical Unit/Bool markers and
integer limbs, malformed Unicode, null payloads, budgets and deep copies. Its
report distinguishes compiled public/fault callers from executed host checks.

## Coverage

The inventory advances 22 reviewed-path cells: six Array/record positions and
sixteen primitive record fields. Earlier ordinary-source, character, platform-word
and callable evidence retains its scope. Existing compound, List, alias, variant,
primitive-callable and original NuGet regressions run with the updated converters.

Copies remain acyclic, with a 32-level schema limit and separate 16 MiB managed
input and shared native input/output accounting budgets. These do not bound all
managed allocations or Lean working memory. Recursive copied values, compound
callable payloads and explicitly owned aggregates remain unfinished work.
