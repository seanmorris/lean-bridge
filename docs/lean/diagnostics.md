# Troubleshooting

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
| 64 | CLI syntax or CLI configuration was invalid. |
| 130 | The command was cancelled. |

A first interrupt cancels the active process and returns 130.

## Match the diagnostic

| Diagnostic | Cause | Next action |
| --- | --- | --- |
| `invalid-export-configuration` | Shared configuration has an invalid version, field, selection, or package setting. | Check `lean-bridge.exports.json` against [the author configuration](existing-package.md#configure-exports). |
| `unknown-export-module` or `unknown-export-declaration` | A configured name is missing or outside the selected modules. | Use exact module names and fully qualified declarations; review the module selection. |
| `unsupported-export-configuration` | The selected backend does not implement a configured choice. | Check the target guide. Do not discard required ownership or type constraints to bypass the error. |
| `export-configuration-reviewed-ir` | Shared source selectors are combined with reviewed Binding IR decisions. | Keep the reviewed document's decisions together until the shared elaborated pipeline supports this combination. |
| `export-configuration-drift` | Configuration changed during analysis. | Keep the selected input revision stable and rerun analysis. |
| `component-adapter-hints-required` | The public boundary needs a decision. | Read the JSON analysis and [resolve its adapter questions](export-decisions.md#resolve-required-decisions). |
| `analysis-output-exists` or `build-output-exists` | The chosen output path already exists. | Choose an absent path. The CLI never merges an existing output. |
| `build-tools-unavailable`, `nix-unavailable`, or `docker-unavailable` | Compiler-backed analysis or building has no usable pinned backend. | Complete [backend setup](setup.md#select-the-build-backend). Analysis does not fall back to scanned signatures. |
| `invalid-compiler-analysis` | Engine output, invocation identity, or source inputs changed. | Keep inputs stable and rerun. Preserve the diagnostic if it repeats. |
| `analysis-configuration-unsupported` | Public analysis cannot project configured resources or closure arities yet. | Use the native target's build path or an explicit reviewed Binding IR for those APIs. |
| `invalid-specialization` | Lean could not resolve a configured type application or its instance dictionaries, or found an admitted or unreviewed implementation. | Read the compiler message. Check the leading type arguments and instances in [the specialization configuration](existing-package.md#export-concrete-specializations). |
| `export-contract-mismatch` | A declared parameter count, ownership, lifetime, refinement policy or effect set differs from the implemented adapter. | Check [export contracts](existing-package.md#declare-export-contracts) against the compiled signature and selected profile. Required unsupported behavior needs an adapter implementation. |
| `unused-export-contract` | A contract names no selected declaration or specialization. | Correct the exact export name or module/export selection. |
| `contracts-require-elaboration` | Internal source-scanning tooling received contracts it cannot check. | Use compiler-backed `lean-bridge analyze` or the target's build command. |
| `source-not-git` | The dry-run project is outside Git. | Initialize Git and commit the project inputs. |
| `source-tree-dirty` | A project input differs from the candidate revision. | Run `git status --short`, review the changes, and commit the intended inputs. |
| `lean-toolchain-drift` | The source requests a different Lean version from the builder. | Compare `lean-toolchain` with the pinned builder and runtime. |
| `lean-compiler-drift` | Compiler and runtime Git identities differ. | Rebuild using the matching pinned toolchain and runtime. |
| `lean-metadata-extractor-failed` | The compiler metadata process failed or returned malformed JSON. | Read the retained compiler error. Keep the source and pinned toolchain stable; report extractor faults with the failing command. |
| `invalid-elaborated-metadata` | The compiler report has an invalid shape or differs from its measured invocation. | Rebuild from the intended source with a matching engine. Do not supply edited metadata as a replacement. |
| `lean-entry-elaboration-drift` | Fresh target compilation differs from the metadata used to generate adapters. | Check for changed source, toolchain, extractor or interface files, then build in fresh staging. |
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
