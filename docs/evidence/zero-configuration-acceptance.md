# Zero-configuration acceptance

## Current result

The committed fixture matrix passes. The product acceptance gate fails on three documented defects.

Eight plain Lean projects cover small and medium pure libraries, generic declarations, effects, identity-bearing values, custom marshaling, incomplete documentation, and an ambiguous callback lifetime. Their Lean source contains zero publishing annotations and zero handwritten host wrappers.

The analyzer produces complete Binding IR for the small, medium, async, and incomplete-documentation projects. `IO` and `Task` results use the Binding IR Promise convention and the async effect. It emits one visible documentation warning for the incomplete project. Four projects receive required adapter questions. The audit accepts two questions as genuine ambiguity: host representation for `Money`, and whether a callback is retained after a call.

The audit rejects these defects:

1. Generic declarations do not reach concrete generated host bindings.
2. Identity-bearing Lean structures do not produce native resource classes.
3. The canonical release keeps PyPI, Cargo, C, and C++ runtime targets ineligible.

The CLI compiles the small plain Lean project into a shared-runtime side module without changing the project. It generates deterministic npm archives and exposes the Lean declarations as native JavaScript callables.

## Gate behavior

[`acceptance/zero-config-audit.v1.json`](../../acceptance/zero-config-audit.v1.json) inventories annotations, hints, manual edits, host dependencies, registry steps, target exceptions, and defaults. Every entry supplies evidence and a remediation. The evaluator rejects mandatory publishing annotations, mandatory manual edits, target-specific rebuilds, blocking defects, silent defaults, and irreversible defaults.

Docker or Nix remains a visible host prerequisite. Registry credentials remain a visible publication prerequisite. Both are supported policy choices with documented alternatives. Neither changes Lean source or component bytes.

Run the gate with:

```sh
npm run acceptance:zero-config
```

The command exits with status 2 while a blocking exception remains. Its JSON output identifies every violation by stable code. CI tests the fixture expectations, closed audit format, evidence paths, and failure rules.

## Time-to-package record

[`time-to-package-20260811.json`](time-to-package-20260811.json) records a passing cold and warm run on an 8-core Intel i7-7700K host with 25,154,297,856 bytes of memory. The hardware exceeds the published minimum.

Cold mode starts with clean analysis, build, package, publication, and consumer directories. It refreshes pinned Nix inputs while retaining immutable dependency objects in the Nix store. Warm mode starts with the same clean project outputs and permits the Nix evaluator to use its cache. The benchmark does not include toolchain installation or network publication.

The cold pipeline took 6,048.549 ms. The warm pipeline took 4,044.687 ms. Each profile ran four developer commands and required zero prompts, adapter hints, manual files, unfamiliar concepts, or failed stages.

The dry run rebuilt the Lean component in a separate clean output, generated both npm package closures, and compared every generated file and mode. The publication stage copied the receipt-bound archives into a local sandbox registry, verified the component receipt, installed both archives with npm scripts disabled, imported the generated native callables, and checked `add` and `isEmpty`. It did not write to an external registry.

[`time-to-package-plan-20260811.json`](time-to-package-plan-20260811.json) preserves the earlier architecture-boundary run. That historical record stopped at `plain-component-compiler-pending` before the component engine and package projection existed.
