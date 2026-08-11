# Zero-configuration acceptance

## Current result

The committed fixture matrix passes. The product acceptance gate fails on four documented defects.

Eight plain Lean projects cover small and medium pure libraries, generic declarations, effects, identity-bearing values, custom marshaling, incomplete documentation, and an ambiguous callback lifetime. Their Lean source contains zero publishing annotations and zero handwritten host wrappers.

The analyzer produces complete Binding IR for the small, medium, async, and incomplete-documentation projects. `IO` and `Task` results use the Binding IR Promise convention and the async effect. It emits one visible documentation warning for the incomplete project. Four projects receive required adapter questions. The audit accepts two questions as genuine ambiguity: host representation for `Money`, and whether a callback is retained after a call.

The audit rejects these defects:

1. The canonical builder expects bridge-owned flake and container files in the Lean project root.
2. Generic declarations do not reach concrete generated host bindings.
3. Identity-bearing Lean structures do not produce native resource classes.
4. The canonical release keeps PyPI, Cargo, C, and C++ runtime targets ineligible.

The first defect also counts as a mandatory manual edit. A package author would need to copy build infrastructure into the project. The acceptance policy blocks that path.

## Gate behavior

[`acceptance/zero-config-audit.v1.json`](../../acceptance/zero-config-audit.v1.json) inventories annotations, hints, manual edits, host dependencies, registry steps, target exceptions, and defaults. Every entry supplies evidence and a remediation. The evaluator rejects mandatory publishing annotations, mandatory manual edits, target-specific rebuilds, blocking defects, silent defaults, and irreversible defaults.

Docker or Nix remains a visible host prerequisite. Registry credentials remain a visible publication prerequisite. Both are supported policy choices with documented alternatives. Neither changes Lean source or component bytes.

Run the gate with:

```sh
npm run acceptance:zero-config
```

The command exits with status 2 while a blocking exception remains. Its JSON output identifies every violation by stable code. CI tests the fixture expectations, closed audit format, evidence paths, and failure rules.

## First timing record

[`time-to-package-20260811.json`](time-to-package-20260811.json) records the first cold and warm run on an 8-core Intel i7-7700K host with 25,154,297,856 bytes of memory. The hardware exceeds the published minimum.

Cold analysis took 25.097 ms. Warm analysis took 9.687 ms. Each run generated `project-analysis.json` and `binding-ir.json` with zero prompts, hints, manual files, or failures.

Cold build reached `invalid-builder-manifest` after 232.397 ms. Warm build reached the same defect after 63.964 ms. Dry-run and publish did not execute because they consume the authorized build output. The report marks both stages skipped and fails the end-to-end budget.
