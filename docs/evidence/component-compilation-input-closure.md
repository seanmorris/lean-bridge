# Component compilation input closure

## Result

A plain Lean project now becomes an immutable, content-addressed compilation closure before the compiler runs. The closure is independent of its checkout path and leaves the author-owned project unchanged.

[`src/build/component-compilation-plan.mjs`](../../src/build/component-compilation-plan.mjs) performs five checks before staging:

- Every source file still matches the byte length and SHA-256 identity recorded by analysis.
- Local Lean imports form an acyclic graph with a deterministic compile order.
- Every module imported by generated adapters belongs to the component source closure.
- Direct private symbols and `initialize_LeanBridgeGenerated` are bound to the compiler adapter plan.
- The target forbids a private runtime, memory, table, and public generic dispatch.

The staging function copies the verified project inputs into `source/`, generated adapters into `generated/`, and both canonical plans into the closure root. Staged input files are read-only. Compiler outputs will use separate directories in the next gate.

The medium onboarding fixture proves the required order:

```text
OnboardingMedium.Collections
OnboardingMedium
LeanBridgeGenerated
```

The same fixture produces an identical plan after it moves to another checkout root.

## Remaining gate

The next step must invoke the pinned Lean compiler against this closure. It must write target C and olean files outside `source/`, then pass those exact target C files to one Emscripten side-module link.
