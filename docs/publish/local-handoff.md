# Hand off a local package

Give the recipient both npm archives, the component receipt, and its verifier. The component archive depends on the shared-runtime archive; handing over only the component leaves the installation incomplete.

## Prepare the Lean project

Complete the [Lean author guide](../lean-author-guide.md) first. You need the installed checkout CLI, a working Nix or Docker build backend, the matching shared runtime, and an ordinary Lake project with supported exports.

Run these commands from your Lean project's root. Each output directory must be new. Choose another name when repeating a run; keep previous evidence until you no longer need it.

```sh
lean-bridge analyze --project . --check --output build/analysis
lean-bridge build --project . --target npm --output build/lean-bridge-release
```

The build writes the canonical component bundle under `build/lean-bridge-release/bundle`. Check the analysis diagnostics and build result before continuing. The ordinary component's assurance metadata records source relationships and retains its `unverified` state after compilation. Run the [strict theorem check](../lean/proofs-and-assurance.md#check-the-theorem) for your proof before producing the handoff.

## Reproduce the package

Commit the source changes you intend to hand off. The gate requires a clean committed project, including Git-visible untracked files. Generated output should already be excluded by the project's ignore rules. Do not delete unrelated work to satisfy this check.

```sh
git status --short
lean-bridge publish --project . --target npm --dry-run \
  --output build/lean-bridge-dry-run
```

The dry run builds the selected source twice and compares the resulting inventories. It writes local files, and the builders may download pinned dependencies. It does not read registry credentials or publish a package.

For an ordinary component, the successful result lists the runtime and component archive paths under `packages`. Use those paths rather than guessing package versions or tarball names.

The output also contains:

| Path below `build/lean-bridge-dry-run/` | Keep it for |
|---|---|
| `evidence/reproducibility.json` | The source revision and two-build comparison |
| `publish-manifest.json` and `publish-manifest.sha256` | The local component package plan and its hash |
| `release/packages/npm/component-package-receipt.json` | The two archive identities and their relationship |
| `release/packages/npm/verify-component-package-receipt.mjs` | Recipient-side verification without the Lean compiler |

This `publish-manifest.json` has `kind: lean-bridge-component-publish-plan`. It is not the universal manifest accepted by the registry executor. Do not pass it to `publish --manifest` as a shortcut to registry publication.

## Verify before sending

Keep the receipt, verifier, and archives together with their generated names and relative paths. Run a verifier only from the author or release channel you trust. Verify that package directory before copying it:

```sh
node build/lean-bridge-dry-run/release/packages/npm/verify-component-package-receipt.mjs \
  --receipt build/lean-bridge-dry-run/release/packages/npm/component-package-receipt.json
```

The verifier reports `verified: true` with the component identity and runtime version. Send the complete `release/packages/npm/` directory through your team's approved artifact channel. Include the source revision and reproducibility report when the recipient needs to audit the build.

The recipient runs the copied verifier again after transfer, then installs both archives using the [JavaScript and TypeScript guide](../javascript-typescript.md). They need Node and the supported target environment, but do not need Lean to verify the receipt or call the installed package.

The unsigned component receipt detects a changed archive relative to the supplied receipt. Agree on the sender and transfer channel separately. For an independently trusted publisher identity, use the [signed release workflow](production-release.md#verify-the-completed-release).

## Resolve failures without replacing evidence

If the two builds differ, inspect `evidence/reproducibility.json`. The gate has not authorized a registry write. Fix the source or build cause, commit that change, and use a fresh output directory.

If recipient verification fails, compare the transferred directory with the original output. Do not edit the receipt to match a damaged archive. Transfer the original files again, or produce a new candidate with a new record.

The [component-neutral bundle evidence](../evidence/component-neutral-release-bundle.md) describes the bundle format. The [author guide](../lean-author-guide.md) owns the compiler prerequisites and supported export examples.
