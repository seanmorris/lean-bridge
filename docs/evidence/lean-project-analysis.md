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
lean-bridge analyze --check --output build/analysis
```

The report inventories relevant Lean and build inputs by SHA-256, records imports and lockfiles, lists declarations, explains every export decision, and includes the proposed Binding IR plus its semantic hash. Paths remain relative to the project, so two copies of the same source produce the same report content.

When Lake interface metadata exists under `.lake/build/lib/lean`, the analyzer reads each `*.ilean` file, records its module, direct imports, declarations, and hash, then correlates compiled declaration names with source candidates. The report does not treat interface presence as proof that the metadata matches the current source. The independent build gate must reject stale metadata.

The analyzer treats one existing `*.binding-ir.json` file as an explicit component boundary. It validates that document and suppresses questions about unrelated declarations. Multiple Binding IR documents require a component selection.

## Explicit output

Analysis performs no writes by default. `--output <directory>` authorizes one new directory and produces canonical JSON:

| File | Condition | Contents |
|---|---|---|
| `project-analysis.json` | always | Complete input hashes, candidate decisions, diagnostics, adapter hints, and nested Binding IR when available |
| `binding-ir.json` | Binding IR available | Direct generator input with rich primitive types, ownership, documentation, and assurance metadata |
| `policy-report.json` | `--check` or `--policy` | Policy identity, analysis identity, measured values, and ordered violations |

The writer uses a sibling staging directory and one final rename. It refuses an existing destination and removes staging state after failure or cancellation. A blocked analysis can therefore preserve its evidence without overwriting source or pretending that a usable Binding IR exists.

## Check mode

The built-in policy requires a Binding IR, one or more proposed exports, zero required adapter hints, and zero error diagnostics. A versioned policy file may add warning, documentation, compiled-interface, Binding IR origin, and package-version requirements. Policy violations use exit code 1. Missing adapter decisions and unavailable Binding IR retain exit code 2 because a human or adapter author must resolve them. Invalid policy files are invocation errors with exit code 64.

Each policy has a canonical SHA-256 identity. [`schema/analysis-policy.schema.json`](../../schema/analysis-policy.schema.json) closes the input. [`schema/analysis-policy-report.schema.json`](../../schema/analysis-policy-report.schema.json) closes the result. The report hashes the complete analysis document, which prevents a policy result from being attached to another source inventory.

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
- CLI success and `needs-input` exit behavior;
- atomic deterministic output and existing-destination refusal;
- conditional Binding IR and policy report files;
- built-in and custom policy thresholds with stable exit codes; and
- cancellation without output or staging residue.

[`schema/project-analysis.schema.json`](../../schema/project-analysis.schema.json) closes the version 1 report, candidate, hint, diagnostic, and Binding IR reference shapes.

Run the focused gate:

```sh
node --test tests/lean-project-analyzer.test.mjs tests/cli-contract.test.mjs
```
