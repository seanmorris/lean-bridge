# Lean-author tutorial acceptance, 8 September 2026

The complete author runner passed against the committed [tutorial fixture](../../tests/fixtures/documentation/lean-author/OnboardingSmall.lean). It checked the theorem, rejected two invalid variants, analyzed the exports, built the component, completed two isolated dry-run builds, verified the receipt, and called the installed npm package.

## Completed command

From the repository root, the invocation used these resolved paths:

```sh
LEAN_BRIDGE_CHECKOUT="$(pwd)"
LEAN_BRIDGE_DOCKER="$LEAN_BRIDGE_CHECKOUT/build/lean-author-tools-IQ02DJ/docker.mjs" \
  node scripts/check-lean-author-tutorial.mjs \
  --backend docker \
  --engine "$LEAN_BRIDGE_CHECKOUT/build/lean-author-engine-NGproe" \
  --output "$LEAN_BRIDGE_CHECKOUT/build/documentation-author-validation"
```

The runner selected the bootstrapped Lean compiler and `build/lean-link-spike/lazy` shared runtime. It created and committed the four fixture inputs in its own temporary Git repository. It removed that temporary workspace after success. It performed no registry writes and installed both local archives with lifecycle scripts disabled.

## Environment and isolation

The engine directory contained a `git archive` of revision `0f4db5298a91b0d418ebb35a363f4ba994d22ce4`, extracted into a task-owned directory. No staged documentation or untracked workspace inputs entered that snapshot.

The host had Node 22.23.2 and Docker 24.0.9, but no native Nix. The builder used Lean 4.32.2, commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`, and Emscripten 6.0.6. The Docker image tag was `lean-bridge-builder:c557918fec8ab3ca`; its checked runtime configuration hash was `f1fafe58e820cc3eb6af3c09a7f86b3280bfb0ec11b8a90c81092a31f17d5257`.

This run used an environment harness, not the unmodified default Docker invocation. Its task-owned Docker wrapper mounted the existing pinned Nix store read-only and selected the builder's existing `LEAN_BRIDGE_ENGINE_PROGRAM` entrypoint. The launcher executed the current committed engine source at `/workspace/engine/scripts/run-component-engine.mjs`. It did not execute an older cached engine implementation.

The canonical builder retained separate read-only component input mounts and isolated output directories. The wrapper changed neither backend source nor component source. The environment record preserves the wrapper and launcher source, their hashes, all 20 engine-source boundary file hashes, and the toolchain definition.

## Results

- Strict Lean checking printed `'OnboardingSmall.add_commutative' does not depend on any axioms`.
- Replacing addition with the left operand failed strict checking with exit code 1.
- Replacing the proof with `by sorry` failed strict checking with exit code 1.
- Analysis exported `add` and `isEmpty`, with no required adapter decisions.
- Both clean Docker builds passed. The reproducibility gate compared 41 artifact paths, including file modes, with zero differences.
- The standalone copied verifier accepted the receipt and both archives.
- A separate npm consumer called `add(100n, 23n)`, `isEmpty("")`, and `isEmpty("browser")`; results were `123n`, `true`, and `false`.
- The package exposed `add`, `isEmpty`, and its generated default export. The theorem did not become a callable export.

The source fixture revision for this passed run was `9d02b2c3352ab64a62b36a8585bb07fea7d2c161`. Both clean builds recorded engine identity `aa4ce394a14dc218a758cf4a3b81e05b4bccb691bf0a4156d9cf53c8a5599607`.

## Artifact identities

| Artifact | SHA-256 |
| --- | --- |
| Tutorial `OnboardingSmall.lean` | `d4f4b4fe9141a24726b11bc665420909f4ab3aa875c661e1371a66d4c2af2816` |
| Component identity | `ca7b1b5d550194ea874c37f19c8c94e64782cbf2ab7e8402f5209c377c5b7d1b` |
| Compiled component WebAssembly | `ec2578344828ea4ab65c965db5a802b1ba0c5e4efe7e297b78a3b59c35042e50` |
| Component package receipt | `63e7a135df3714c203c77fb7fd43b5e2627c9a47072d58c92b34de86022cc660` |
| `onboarding-small-1.0.0.tgz` | `2e493b63a5581c7006704b236612f180ddbc60e2cab60e5e0a97815ef4c83383` |
| `lean-bridge-runtime-0.0.0-abi1.f3b06c705e6c.743765bf566f.tgz` | `364eea29a4471c5f8cf3026e1f3b5e58b733ae932ba9e9e52f0ae4dacad5c6c1` |
| Passed author acceptance report | `e2cf64e00d24a358e17fe8eb0ee1eca32383138101f9e7b8152f678e26eeab37` |

## Retained outputs and earlier attempts

The passed report is `build/documentation-author-validation/author-acceptance.json`. Its directory also contains `evidence/author-commands.json`, `evidence/reproducibility.json`, and `evidence/environment/environment.json`. The environment directory preserves the original successful engine execution report and the harness sources.

The first direct mount of the workspace Git checkout failed Nix's repository ownership check. The task-owned committed engine copy resolved that error. During its uncached Docker build, the host acceptance process exited 143 while the Docker engine continued. The engine produced a complete successful execution report and component artifact. Its retained WebAssembly hash exactly matches the final component above; this interrupted attempt was not reported as a completed author acceptance.

The first cached run completed the dry run and installed calls, then failed a harness assertion that omitted the generated default export. The corrected runner completed every stage again in the fresh validation directory above.

The initial cached run's consumer handoff remains unchanged at `build/documentation-author-acceptance/release/packages/npm`. Its receipt, component archive, runtime archive, and standalone verifier are byte-identical to the passed validation run. Consumer tests use that exact handoff directory.

## Assurance and numeric range

The separate strict Lean command checks the theorem for all natural-number inputs. The analyzer and package assurance records remain `unverified`; source theorem references do not constitute an artifact-bound theorem audit. This task did not promote them to checked proof assurance.

Installed-package testing exposed a current runtime limit: `add(2147483647n, 0n)` works, while an input of `2147483648n` fails. The tutorial therefore uses nonnegative inputs whose sum is at most `2^31 - 1`. VO task 1195 tracks the runtime issue. This report does not claim arbitrary-precision package support or browser acceptance; the consumer acceptance records those results separately.
