# Clean-room usability protocol

## Purpose

The gate measures whether an ordinary package author, downstream consumer, or coding agent can use Lean Bridge without bridge-specific knowledge. Unit tests cannot satisfy a participant session. Each passing record requires commands and evidence from a clean checkout at one exact Git revision.

## Required participants

The release candidate needs four passing sessions:

1. A Lean author starts from a plain project, runs analyze, build, and publish dry-run, then examines the generated API and assurance metadata.
2. A JavaScript developer installs the generated npm package in a new project, imports native functions or classes, calls them, and verifies the release receipt.
3. A Python developer installs the generated PyPI package in a new virtual environment, imports native functions or classes, calls them, and verifies the release receipt.
4. An automated coding agent receives only the project goal and CLI help. It performs the same author and consumer workflow without source annotations, handwritten wrappers, or undocumented repair steps.

The human sessions require real participants. An agent must not synthesize their results.

## Environment

Every session records a 40-character Git revision. The checkout must be clean before the first command and after generated output is removed. Build output, consumer projects, package-manager caches, virtual environments, and temporary registry state live outside the checkout.

Cold author runs use a clean build cache. Warm author runs repeat against the supported cache. Consumer runs install only published or locally rehearsed registry artifacts. They must not import files from the bridge repository.

## Passing conditions

A session passes when all of these statements are supported by attached evidence:

- The baseline required zero publishing annotations and zero handwritten wrappers.
- The baseline required zero interactive prompts.
- CLI diagnostics named a concrete action using ordinary package and language terms.
- JavaScript used an ordinary package install and native import. Python used an ordinary package install and native import.
- The participant did not need Lean ABI, Wasm linking, flake, builder-image, handle, pointer, generic dispatch, or calling-convention knowledge.
- The participant verified the release receipt and exact artifact identities.
- The clean checkout remained unchanged.

Any failure remains in the session record. A later passing rerun adds a new record instead of rewriting the failed evidence.

The gate requires at least one passing session for each role. Once a role passes, its earlier attempts remain visible as history but no longer block that role. Every passing record must independently satisfy all conditions above.

## Gate

[`acceptance/clean-room-sessions.v1.json`](../../acceptance/clean-room-sessions.v1.json) is the machine-readable session index. Pending records reserve each required role without claiming evidence.

Run:

```sh
npm run acceptance:clean-room
```

The command exits with status 2 until every required role has a passing session. It also fails on a dirty checkout, annotations, wrappers, prompts, exposed implementation concepts, unfamiliar installation, non-actionable diagnostics, or missing reproducibility verification.

## First agent attempt

[`clean-room-agent-79e8a1e.json`](clean-room-agent-79e8a1e.json) records a detached clean-checkout run. Analysis generated two files with zero prompts and left the checkout clean. Build stopped at `invalid-builder-manifest`. The session is blocked because it exposed `flake` and `builder-image`, provided no ordinary package installation, and produced no release receipt to verify.

## Current agent result

[`clean-room-agent-cd531bf-working-directory-failure.json`](clean-room-agent-cd531bf-working-directory-failure.json) preserves a later failed attempt. Analyze, build, publish dry-run, receipt verification, and npm installation passed. The native import ran outside the generated consumer directory and failed with Node's `ERR_MODULE_NOT_FOUND` diagnostic.

[`clean-room-agent-cd531bf-passed.json`](clean-room-agent-cd531bf-passed.json) records the fresh rerun at the same revision. The agent used the documented CLI commands, produced two byte-identical package builds, verified the receipt, installed the runtime and component with npm scripts disabled, and called `add` and `isEmpty` through native imports. The source checkout remained clean. The three human sessions remain pending.
