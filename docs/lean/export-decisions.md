# Choose an export shape

Lean Bridge proposes host functions from public `def`, `opaque`, and `abbrev` declarations with explicit supported parameter and result types. Lean theorems remain assurance references.

## Start with the runnable npm shapes

The ordinary-project npm runtime currently implements these call shapes:

| Lean declaration shape | Public example |
| --- | --- |
| `Nat → Nat → Nat` | `add(100n, 23n)` |
| `String → Bool` | `isEmpty("")` |

For the current `Nat` adapter, use nonnegative `bigint` inputs whose sum is at most `2147483647n` (`2^31 - 1`). The installed-package acceptance found that larger natural numbers fail. This is a runtime limit; Lean's `Nat` type has no such bound.

The [first-component tutorial](first-component.md) executes both shapes from generated archives. Its source needs no publishing annotation or handwritten host wrapper.

The source analyzer understands more types than this runtime can execute. A generated type declaration establishes a binding shape; execution requires the target runtime's implementation of that shape.

## Types understood by source analysis

The source-only analyzer recognizes:

- `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, and `UInt64`;
- `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, and `Int`;
- `Float32`, `Float`, `String`, and `ByteArray`;
- nested `Array T`, `Option T`, and `Except E T` with supported arguments.

`IO T` and `Task T` receive Promise delivery for a supported result type. `EIO`, function arguments or results, implicit or instance parameters, unsupported structures, and ambiguous foreign declarations require an adapter decision.

Reviewed Binding IR can describe richer APIs than source-only inference. The [consumer support contract](../consumer-support.v1.json) records tested runtime profiles; it does not imply that every inferred declaration runs through the ordinary-project npm path.

## Declarations the analyzer skips

The default public proposal excludes `private`, `protected`, `unsafe`, and `partial` definitions. An existing foreign declaration requires a reviewed boundary contract or exclusion. Duplicate unqualified host names require a naming decision.

Doc comments become generated API descriptions. Missing documentation produces a warning; it does not supply a proof or change a function's implementation.

## Resolve required decisions

Run analysis with machine-readable output:

```sh
lean-bridge analyze --project . --json --progress none
```

Required questions identify the declaration, reason, and closed choices. Current decisions cover:

| Reported boundary | Available direction |
| --- | --- |
| Existing foreign declaration | Exclude it or provide a reviewed foreign contract. |
| Unsupported value, effect, or callable shape | Exclude it or provide an adapter. |
| Duplicate public names | Qualify, rename, or exclude the conflicting names. |
| Several Binding IR documents | Select the intended component. |

Analysis stays noninteractive unless `--interactive` is supplied. The CLI does not rewrite Lean source or generate a guessed adapter. Resolve required questions before `build`.

The [analyzer contract](../../src/analyze/README.md) and [Binding IR contract](../../src/binding-ir/README.md) define those boundaries. For a blocked command, use the [diagnostic table](diagnostics.md#match-the-diagnostic).
