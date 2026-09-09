# Choose an export shape

Lean Bridge proposes host functions from public `def`, `opaque`, and `abbrev` declarations with explicit supported parameter and result types. Lean theorems remain assurance references.

## Start with the runnable npm shapes

Ordinary npm components support pure functions with any number of primitive arguments, including zero:

| Lean type | JavaScript / TypeScript value |
| --- | --- |
| `Unit`, `Bool` | `undefined`, `boolean` |
| `UInt8`, `UInt16`, `UInt32`, `Int8`, `Int16`, `Int32` | Range-checked integer `number` |
| `UInt64`, `Int64` | Range-checked `bigint` |
| `Nat`, `Int` | Arbitrary-precision `bigint`; `Nat` must be nonnegative |
| `Float32`, `Float` | `number`, including NaN, infinities, and negative zero |
| `String` | Unicode `string`, including embedded NUL; unpaired UTF-16 surrogates are rejected |
| `ByteArray` | Copied `Uint8Array` |

Calls use a binary scalar frame. Integers cross as 32-bit limbs without narrowing. Each copied value has a 16 MiB transport budget; `Float32` rounds to IEEE single precision.

The [first-component tutorial](first-component.md) executes `add` and `isEmpty` from generated archives. Its source needs no publishing annotation or handwritten host wrapper.

Analysis, compilation, packaging, and loading check the same ordinary-component capability contract.

## Types understood by source analysis

The source-only analyzer recognizes:

- `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, and `UInt64`;
- `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, and `Int`;
- `Float32`, `Float`, `String`, and `ByteArray`;
- nested `Array T`, `Option T`, and `Except E T` with supported arguments.

Ordinary components reject `IO`, `Task`, collection types, records, callbacks, and resources before compilation. Recognizing a source type does not authorize publishing it. Richer reviewed Binding IR and universal-package backends remain separate from this pure primitive path.

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
