# Hand off a local package

Give the recipient the package-set receipt, its hash sidecar, and every archive it names. Ordinary-source builds generate this receipt for npm, native targets, PHP-Wasm, and combinations of those profiles. Recipients verify it with Node and install the packages using their language tools.

## Hand off an ordinary package set

Build with your [target-language guide](../publishing.md#choose-the-package-ecosystem). Each successful build adds `package-set-receipt.json` and `package-set-receipt.json.sha256` without changing its installable archives or existing receipts:

| Selected targets | Receipt directory below your build output |
| --- | --- |
| npm alone | `packages/npm/` |
| Native targets: CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo, native PHP | The output root |
| PHP-Wasm alone | The output root |
| Multiple ABI profiles | The output root covers all selected profiles; each profile also retains its own receipt |

Set the receipt path from that table and verify before transfer:

```sh
lean-bridge verify --receipt ./release/package-set-receipt.json
```

Copy that receipt, its sidecar, and its named archives, preserving every relative path. You do not need to distribute compiler staging or unpacked package directories. The recipient runs the same command after transfer, then follows [their language's installation guide](../consume.md). [Package-set verification](../consume/receive-package.md#verify-a-local-package-set) explains separate archive roots and the checks performed.

The builder records each package's own name and version, its ABI profile and runtime identity, and exact in-set dependencies. npm and CPAN include separate runtime packages. PHP-Wasm includes npm runtime and component packages plus a Composer API companion. Other native projections embed their runtime libraries. Conflicting package names within one ecosystem fail the combined build, including JavaScript/PHP-Wasm npm collisions and native/PHP-Wasm Composer collisions. Assign distinct names in `lean-bridge.exports.json` before rebuilding.

The receipt and sidecar are unsigned consistency records. Use an authenticated transfer channel or the [signed publication flow](npm.md#publish-an-ordinary-component) for publisher identity. Package-manager upload instructions and [signed Nix cache publication](nix.md) remain separate distribution steps.

The npm workflow below also reproduces the package twice and retains its original npm-specific receipt and portable verifier. Send both runtime and component archives; the component alone leaves a local installation incomplete.

## Prepare the Lean project

Complete the [Lean author guide](../lean-author-guide.md) first. Use the prepared CLI, a working Nix or Docker build backend, and an ordinary Lake project with supported npm exports. The prepared CLI supplies its shared runtime automatically; manual runtime setup belongs to the [checkout workflow](../contributing/author-toolchain.md).

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
| `release/packages/npm/package-set-receipt.json` and `package-set-receipt.json.sha256` | Ecosystem-neutral package identities, runtime dependencies, and archive hashes |
| `release/packages/npm/verify-component-package-receipt.mjs` | Portable Node verifier for recipients without the CLI |

This version-two `publish-manifest.json` has `kind: lean-bridge-component-publish-plan`. The registry executor accepts it when its publication settings match your CLI configuration. For registry publication, configure the destination and public signing policy before the dry run using the [npm publishing guide](npm.md#publish-an-ordinary-component). The local archive handoff itself needs no registry credentials.

## Verify before sending

Keep the receipt, verifier, and archives together with their generated names and relative paths. Verify that package directory with the installed CLI before copying it:

```sh
lean-bridge verify \
  --receipt build/lean-bridge-dry-run/release/packages/npm/component-package-receipt.json
```

The verifier reports `verified: true` with the component identity and runtime version. Send the complete `release/packages/npm/` directory through your team's approved artifact channel. Include the source revision and reproducibility report when the recipient needs to audit the build.

The recipient runs `lean-bridge verify` again after transfer, then installs both archives using the [JavaScript and TypeScript guide](../javascript-typescript.md). [Verify a local receipt](../consume/receive-package.md#verify-the-local-npm-receipt) includes the copied-script fallback for recipients without a CLI. Verification needs only Node and the handoff files; calling the installed package also needs the supported target environment.

The unsigned component receipt detects a changed archive relative to the supplied receipt. Agree on the sender and transfer channel separately. For an independently trusted publisher identity, use the [ordinary npm publication](npm.md#publish-an-ordinary-component).

## Resolve failures without replacing evidence

If the two builds differ, inspect `evidence/reproducibility.json`. The gate has not authorized a registry write. Fix the source or build cause, commit that change, and use a fresh output directory.

If recipient verification fails, compare the transferred directory with the original output. Do not edit the receipt to match a damaged archive. Transfer the original files again, or produce a new candidate with a new record.

The [component-neutral bundle evidence](../evidence/component-neutral-release-bundle.md) describes the bundle format. The [author guide](../lean-author-guide.md) owns the compiler prerequisites and supported export examples.
