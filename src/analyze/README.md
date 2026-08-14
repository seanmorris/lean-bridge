# Lean project analysis

This directory inspects ordinary Lean and Lake projects and proposes a canonical Binding IR document.

## Modules

- [`lean-project.mjs`](lean-project.mjs) reads project metadata, documented declarations, and supported source shapes.
- [`policy.mjs`](policy.mjs) applies the selected analysis policy and records adapter questions.
- [`output.mjs`](output.mjs) formats human and machine-readable results.

Analysis does not compile a component or modify Lean source. Compilation starts in [`../build`](../build/README.md) after the caller accepts an analysis result.

See the [Lean author guide](../../docs/lean-author-guide.md) and [analysis evidence](../../docs/evidence/lean-project-analysis.md).
