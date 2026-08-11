# Zero-configuration acceptance

## Current result

The committed fixture matrix passes. The product acceptance gate fails on five documented defects.

Eight plain Lean projects cover small and medium pure libraries, generic declarations, effects, identity-bearing values, custom marshaling, incomplete documentation, and an ambiguous callback lifetime. Their Lean source contains zero publishing annotations and zero handwritten host wrappers.

The analyzer produces complete Binding IR for the small, medium, and incomplete-documentation projects. It emits one visible documentation warning for the incomplete project. Five projects receive required adapter questions. The audit accepts two questions as genuine ambiguity: host representation for `Money`, and whether a callback is retained after a call.

The audit rejects these defects:

1. The canonical builder expects bridge-owned flake and container files in the Lean project root.
2. Generic declarations do not reach concrete generated host bindings.
3. `IO` and `Task` declarations do not reach the existing async projection.
4. Identity-bearing Lean structures do not produce native resource classes.
5. The canonical release keeps PyPI, Cargo, C, and C++ runtime targets ineligible.

The first defect also counts as a mandatory manual edit. A package author would need to copy build infrastructure into the project. The acceptance policy blocks that path.

## Gate behavior

[`acceptance/zero-config-audit.v1.json`](../../acceptance/zero-config-audit.v1.json) inventories annotations, hints, manual edits, host dependencies, registry steps, target exceptions, and defaults. Every entry supplies evidence and a remediation. The evaluator rejects mandatory publishing annotations, mandatory manual edits, target-specific rebuilds, blocking defects, silent defaults, and irreversible defaults.

Docker or Nix remains a visible host prerequisite. Registry credentials remain a visible publication prerequisite. Both are supported policy choices with documented alternatives. Neither changes Lean source or component bytes.

Run the gate with:

```sh
npm run acceptance:zero-config
```

The command exits with status 2 while a blocking exception remains. Its JSON output identifies every violation by stable code. CI tests the fixture expectations, closed audit format, evidence paths, and failure rules.
