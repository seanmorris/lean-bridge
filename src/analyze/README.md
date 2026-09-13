# Lean project analysis

This directory contains the compiler-backed CLI analyzer and the metadata extractor shared with npm and native CPAN builds. Neither requires bridge annotations in Lean source.

## Inputs

The analyzer captures the selected project root, Lean sources, Lake configuration, pinned toolchain, locked dependencies, shared export configuration, and optional policy. Nix or Docker runs the pinned engine against those captured inputs. A new dependency-free Lake project needs no lockfile; dependency and generator resolution require a reviewed lock.

Fresh Lean interfaces supply names, types, documentation, source positions, effects, and theorem references. Cached `.ilean` files and source-scanned signatures supply no semantic evidence. An explicit reviewed Binding IR bypasses compilation and is labeled `existing-validated`.

## Output

An analysis result contains:

- discovered modules and documented public declarations;
- a proposed Binding IR document when all required mappings are known;
- compiler-owned theorem references without new assurance claims;
- supported primitive projections and unsupported shapes;
- adapter questions for ambiguous ownership, effects, names, or source types;
- diagnostics, progress, next actions, and exit status; and
- source, policy, and analysis identities.

Analysis leaves the author checkout unchanged. Compilation and configured generators run in temporary workspaces outside it. `--output` atomically writes the requested report, available Binding IR and optional policy report. Analysis does not compile consumer adapters, link a component, or choose a publication destination.

## Modules

| Module | Responsibility |
|---|---|
| [`compiler-analysis.mjs`](compiler-analysis.mjs) | Captures sources, invokes the pinned engine, verifies output identities and source stability, and cleans temporary workspaces. |
| [`project-analysis.mjs`](project-analysis.mjs) | Builds and validates the version-2 public report from compiler metadata or reviewed Binding IR. |
| [`lean-project.mjs`](lean-project.mjs) | Inventories project files and validates explicit reviewed Binding IR. The older source scanner remains in internal fixture tooling; ordinary CLI builds use fresh compiler metadata. |
| [`NativeExports.lean`](NativeExports.lean) | Reads fresh Lean interfaces, checks selected implementations, and emits the shared report with scalar or native projections. |
| [`elaborated-metadata.mjs`](elaborated-metadata.mjs) | Hashes complete interfaces and validates the shared report against engine-owned invocation identities. |
| [`native-types.mjs`](native-types.mjs) | Validates native structural types, compiler representations and copied-value restrictions. |
| [`native-metadata.mjs`](native-metadata.mjs) | Binds the shared native report to retained compiler/source evidence and projects the selected API for CPAN. |
| [`project-elaborated.mjs`](project-elaborated.mjs) | Copies structural compiler types into Binding IR, retaining documentation and theorem references without adding assurance claims. |
| [`policy.mjs`](policy.mjs) | Validates built-in or supplied policy, normalizes it, computes identity, and evaluates a result. |
| [`output.mjs`](output.mjs) | Writes machine-readable files to an explicitly selected output directory. |

## Analysis sequence

```text
read-only source capture
      |
      v
pinned engine: fresh interfaces and metadata
      |
      v
host verification and policy evaluation
      |
      v
Binding IR proposal or actionable diagnostics
```

Public analysis, ordinary npm builds and native CPAN use the [shared compiler report](../../docs/architecture/elaborated-export-metadata.md), including dependency-free projects without a Lake lockfile. Missing backends block analysis. Unsupported meaning returns diagnostics; extractor faults and stale metadata fail without a scanned-signature fallback. CPAN retains its native ABI and richer type projection. Public analysis currently projects pure primitive signatures.

The accepted Binding IR moves to [`../binding-ir`](../binding-ir/README.md). Component compilation begins under [`../build`](../build/README.md).

## Extending analysis

A new Lean shape needs a compiler fixture, a structural Binding IR mapping or explicit unsupported diagnostic, collision handling, deterministic output, and downstream execution tests. Do not derive types by parsing rendered expressions.

Use `npm run test:analyze` for the focused contract suite. With the pinned Lean compiler, run `LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 node --test tests/compiler-analysis.test.mjs` for real compiler checks through an injected engine transport. CI also exercises the pinned backend. The fixture matrix is under [`../../tests/fixtures/onboarding`](../../tests/fixtures/onboarding/).
