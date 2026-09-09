# Diagnose an author command

Keep the command, diagnostic code, and build log when a workflow fails. Fix the named input or tool before retrying with a fresh output directory.

## Get a structured result

```sh
lean-bridge analyze --project . --json --progress none
```

This emits one machine-readable result. Use `--json --progress json` when retaining progress events from a long build.

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | The command succeeded. |
| 1 | The command ran and failed. |
| 2 | A capability or required decision blocked the command. |
| 64 | Syntax or configuration was invalid. |
| 130 | The command was cancelled. |

A first interrupt cancels the active process and returns 130.

## Match the diagnostic

| Diagnostic | Cause | Next action |
| --- | --- | --- |
| `component-adapter-hints-required` | The public boundary needs a decision. | Read the JSON analysis and [resolve its adapter questions](export-decisions.md#resolve-required-decisions). |
| `analysis-output-exists` or `build-output-exists` | The chosen output path already exists. | Choose an absent path. The CLI never merges an existing output. |
| `source-not-git` | The dry-run project is outside Git. | Initialize Git and commit the project inputs. |
| `source-tree-dirty` | A project input differs from the candidate revision. | Run `git status --short`, review the changes, and commit the intended inputs. |
| `lean-toolchain-drift` | The source requests a different Lean version from the builder. | Compare `lean-toolchain` with the pinned builder and runtime. |
| `lean-compiler-drift` | Compiler and runtime Git identities differ. | Rebuild using the matching pinned toolchain and runtime. |
| `docker-unavailable` or `nix-unavailable` | The selected isolated builder is unavailable. | Start Docker or install Nix, then repeat [setup](setup.md). |
| `shared-runtime-package-unavailable` | The package step cannot find `main.mjs` and `main.wasm`. | Reinstall a [prepared CLI with its bundled runtime](setup.md#install-a-prepared-cli). Checkout users must complete the manual runtime build and set `LEAN_BRIDGE_RUNTIME_ROOT` to its `lazy` directory. |
| `package-dependency-download-failed` | The isolated builder could not fetch a pinned input. | Check access to the named source and retry the same locked build. |
| `package-build-failed` | The isolated build failed after analysis. | Retain the JSON diagnostic and build log; inspect the compiler error before changing the source. |
| `package-ineligible` | The requested projection lacks a required artifact or adapter. | Check [export shapes](export-decisions.md) and the [consumer support contract](../consumer-support.v1.json). |

## A proof command failed

Run `lean -DwarningAsError=true OnboardingSmall.lean` again after fixing the theorem or restoring its implementation. `sorry` is an error in this command. The [proof lesson](proofs-and-assurance.md) gives the accepted output and explains the package's assurance state.

## Docker reports repository ownership

Nix can reject a mounted Git checkout when its owner differs from the builder's effective user. Use a task-owned copy of the committed engine source instead of changing ownership of the original checkout or trusting every Git directory.

Contributors reproducing this failure with the tutorial runner can select that copy using the [author acceptance instructions](../contributing/testing.md#author-acceptance).

## A receipt does not verify

Keep the receipt, verifier, and both archives from the same completed dry run in one directory. Verify that directory before installation. Do not edit a receipt to match a changed archive; rebuild the candidate from the intended committed source.

Return to [your first component](first-component.md#create-and-verify-local-archives) to create another local candidate. Follow [ordinary component publishing](../publish/npm.md#publish-an-ordinary-component) for signed publication and recovery.
