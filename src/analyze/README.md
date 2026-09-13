# Lean project analysis

This directory contains the source-only CLI analyzer and the compiler-owned metadata extractor used by locked npm builds. Neither requires bridge annotations in Lean source. The CLI analyzer remains provisional until its engine-backed cutover.

## Inputs

The analyzer reads the selected project root, Lean files, `lakefile` metadata, `lean-toolchain`, `lake-manifest.json`, available `.ilean` metadata, and an optional analysis policy. It records file and policy identities so a later build can identify the reviewed input.

## Output

An analysis result contains:

- discovered modules and documented public declarations;
- a proposed Binding IR document when all required mappings are known;
- theorem references as assurance candidates;
- target eligibility and unsupported shapes;
- adapter questions for ambiguous ownership, effects, names, or source types;
- diagnostics, progress, next actions, and exit status; and
- source, policy, and analysis identities.

Analysis reads the project by default. It writes only when the caller selects an output directory. It does not edit Lean source, add annotations, compile a component, or choose a publication destination.

## Modules

| Module | Responsibility |
|---|---|
| [`lean-project.mjs`](lean-project.mjs) | Discovers project files, parses supported declaration shapes, assembles diagnostics, and proposes Binding IR. |
| [`NativeExports.lean`](NativeExports.lean) | Reads fresh Lean interfaces, checks selected implementations, and emits native metadata or the shared rich report. |
| [`elaborated-metadata.mjs`](elaborated-metadata.mjs) | Hashes complete interfaces and validates the shared report against engine-owned invocation identities. |
| [`project-elaborated.mjs`](project-elaborated.mjs) | Copies structural compiler types into Binding IR, retaining documentation and theorem references without adding assurance claims. |
| [`policy.mjs`](policy.mjs) | Validates built-in or supplied policy, normalizes it, computes identity, and evaluates a result. |
| [`output.mjs`](output.mjs) | Writes the human summary and machine-readable files to an explicitly selected output directory. |

## Analysis sequence

```text
project discovery
      |
      v
declaration and metadata inspection
      |
      v
policy evaluation and adapter questions
      |
      v
Binding IR proposal or actionable diagnostics
```

This sequence describes the source-only CLI. Locked npm builds instead derive their Binding IR inside the engine from the [shared compiler report](../../docs/architecture/elaborated-export-metadata.md). Extraction failure cannot fall back to scanned signatures. Native CPAN retains its existing compiler metadata profile.

The accepted Binding IR moves to [`../binding-ir`](../binding-ir/README.md). Component compilation begins under [`../build`](../build/README.md).

## Extending analysis

A new Lean shape needs a source fixture, an explicit Binding IR mapping or adapter question, collision handling, deterministic output, and tests for incomplete documentation. Do not infer ownership or effects when the source and policy do not supply enough evidence.

Use `npm run test:analyze` for the focused suite. The fixture matrix is under [`../../tests/fixtures/onboarding`](../../tests/fixtures/onboarding/), and executable results are recorded in the [analysis evidence](../../docs/evidence/lean-project-analysis.md).
