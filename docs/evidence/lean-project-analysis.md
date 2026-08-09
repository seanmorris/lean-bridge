# Lean project analysis evidence

## Result

`lean-bridge analyze` now reads an ordinary Lean project and returns a deterministic, read-only export plan. A project with copied primitive types can produce a valid Binding IR version 3 document without bridge annotations.

```lean
/-- Cap a natural number at a limit. -/
def cap (limit value : Nat) : Nat := Nat.min limit value

theorem cap_le_limit (limit value : Nat) : cap limit value ≤ limit := by
  simp [cap]
```

```sh
lean-bridge analyze --format json
```

The report inventories relevant Lean and build inputs by SHA-256, records imports and lockfiles, lists declarations, explains every export decision, and includes the proposed Binding IR plus its semantic hash. Paths remain relative to the project, so two copies of the same source produce the same report content.

When Lake interface metadata exists under `.lake/build/lib/lean`, the analyzer reads each `*.ilean` file, records its module, direct imports, declarations, and hash, then correlates compiled declaration names with source candidates. The report does not treat interface presence as proof that the metadata matches the current source. The independent build gate must reject stale metadata.

The analyzer treats one existing `*.binding-ir.json` file as an explicit component boundary. It validates that document and suppresses questions about unrelated declarations. Multiple Binding IR documents require a component selection.

## Conservative type inference

The initial inference table covers copied values whose ownership does not depend on object identity:

| Lean type | Binding IR representation | Ownership |
|---|---|---|
| `Unit`, `Bool` | unit or boolean | copy |
| fixed-width integers | matching signed or unsigned integer | copy |
| `Nat`, `Int` | arbitrary-precision integer | copy |
| `Float32`, `Float` | 32-bit or 64-bit float | copy |
| `String` | string | copy |
| `ByteArray` | bytes | copy |
| `Array α` | typed array of `α` | copy when `α` is copied |
| `Option α` | typed optional `α` | copy when `α` is copied |
| `Except ε α` | typed result | copy when both arguments are copied |

The generated contract preserves these types across the boundary. It does not describe them as serialized JSON or collapse them into an opaque byte string.

Public pure functions that use only those types become proposed exports. Private, protected, unsafe, partial, effectful, callable, implicit, instance-driven, unknown, and foreign declarations remain blocked until a later analyzer proves a safe projection or the package supplies a narrow adapter decision.

The analyzer never guesses ownership for an opaque or foreign value. Its question offers exclusion or a reviewed contract. An IO result offers exclusion or an effect adapter. The report stores these questions outside Lean source, which keeps bridge annotations optional.

## Assurance boundary

Source scanning can identify a theorem that names an exported declaration. It cannot establish that theorem's meaning, successful elaboration, or relationship to the release artifact. Inferred assurance therefore remains `unverified` and carries this assumption explicitly:

```text
Static source analysis does not replace Lean elaboration or proof checking.
```

The build pipeline must elaborate the project, validate generated ABI code, and connect checked theorem metadata to the resulting artifact hash before publication can promote an assurance state. This prevents a theorem-shaped source declaration from becoming a false verified claim.

## Read-only and deterministic gate

[`tests/lean-project-analyzer.test.mjs`](../../tests/lean-project-analyzer.test.mjs) verifies:

- byte-for-byte identical project contents before and after analysis;
- identical reports across repeated runs;
- valid inferred Binding IR for pure functions;
- typed strings, bytes, optional values, arrays, and arbitrary-precision naturals;
- theorem discovery without proof laundering;
- namespace preservation and compiled interface correlation;
- explicit blockers for foreign declarations, IO, and unknown identity-bearing types;
- existing Binding IR validation and component selection; and
- CLI success and `needs-input` exit behavior.

[`schema/project-analysis.schema.json`](../../schema/project-analysis.schema.json) closes the version 1 report, candidate, hint, diagnostic, and Binding IR reference shapes.

Run the focused gate:

```sh
node --test tests/lean-project-analyzer.test.mjs tests/cli-contract.test.mjs
```
