# Publish packages

Build the package for its destination, check it in a clean consumer, and upload the approved artifact. The ecosystem guides below cover package ownership, credentials, upload commands, download verification, and recovery.

[Site deployment](contributing/github-pages.md) and [release-pipeline internals](../src/release/README.md) belong to Contributing.

## Choose the package ecosystem

| Consumer | Publishing guide | Current package and delivery flow |
| --- | --- | --- |
| JavaScript, TypeScript, browser, React, workers | [npm](publish/npm.md) | Runtime and component `.tgz` archives; npm is the installed registry transaction adapter. |
| Python | [PyPI](publish/pypi.md) | Wheel and source distribution; operator-run Twine upload. |
| Rust | [Cargo](publish/cargo.md) | Crate projection; review Cargo's final packaged bytes before publication. |
| C# / .NET | [NuGet](publish/nuget.md) | `.nupkg`; operator-run feed upload with registry-signature handling. |
| Java and Kotlin | [Maven repositories](publish/maven.md) | JAR and POM; private repository deployment, plus the additional requirements for Maven Central. |
| Ruby | [RubyGems](publish/rubygems.md) | `.gem`; operator-run gem upload. |
| Perl | [CPAN](publish/cpan.md) | Native runtime and component `.tar.gz` distributions; operator-run PAUSE upload. |
| Native PHP | [Composer](publish/composer.md) | Composer sources and the matching native extension/runtime distribution. |
| PHP-Wasm | [npm, PHP-Wasm profile](publish/npm.md#publish-the-php-wasm-profile) | Separately built npm archive for one loading profile. |
| C, C++, WIT / WASI | [Archive distribution](publish/archives.md) | Original `.tar.gz` files on an approved artifact host or release page. |
| Nix users | [Signed Nix packages](publish/nix.md) | Signed store closures distributed through a binary cache, with consumer key trust and substitution checks. |

The Alpha package coordinates are test fixtures. A public release needs a namespace you own and a version you can publish. Set those identities in the producer, regenerate every affected package and record, then review the result. Editing an approved archive invalidates its recorded hash.

## Build and approve the same artifacts

The [shared maintainer recipe](contributing/testing.md#build-the-example-artifacts-as-a-maintainer) produces the universal Alpha bundle. Each ecosystem guide gives its package builder. Those builders arrange existing compiled assets; PHP's separate builders also require their compiler and package-manifest inputs.

For a universal reproducibility gate, run from a clean committed checkout with a new output directory. This example selects Python; replace `pypi` with a target from the table below:

```sh
node scripts/lean-bridge.mjs publish --project . --target pypi --dry-run \
  --output build/pypi-release-gate
npm run verify:release-authorization -- \
  --authorization build/pypi-release-gate \
  --candidate build/pypi-release-gate/release
```

| Universal target IDs | Recorded operation |
| --- | --- |
| `npm`, `pypi`, `cargo`, `nuget`, `maven`, `rubygems` | Plan a registry publication. Only npm has an installed adapter. |
| `c`, `cpp`, `wit-wasi` | Retain archives. No registry endpoint or upload credentials are configured. |

There is no universal `php-native`, `php-wasm`, `composer`, or `nix` target. PHP uses separate package builders. Nix builds named flake outputs and distributes their signed store closures. These flows retain their own reviewed distribution records.

Before an external write, review the exact coordinate, target endpoint, archive hashes, platform requirements, and clean-install results. Follow [production approval](publish/production-release.md) for project releases. A command in a guide does not supply approval or registry ownership.

The guides distinguish two upload flows:

- A configured Lean Bridge transaction validates authorization and signatures, runs registry adapters, and signs its completion receipt. Missing adapters and signer integration must be supplied before execution.
- An approved operator workflow invokes the ecosystem's normal publishing tools. Preserve its approved artifact inventory, registry response, downloaded package checks, and consumer results. It does not produce Lean Bridge's signed transaction or completion receipt.

Use the first flow when the release requires a Lean Bridge signed handoff. Use the second only when the release owner has approved that distribution workflow. Neither flow permits replacing approved bytes or concealing a partial upload.

## Choose the delivery path

| Your task | Tutorial | Result |
|---|---|---|
| Give another developer a package they can install | [Local package handoff](publish/local-handoff.md) | Two npm archives, a component receipt, and a verifier |
| Exercise a registry integration without writing to production | [Sandbox release](publish/sandbox-release.md) | A reviewed candidate and a sandbox transaction record |
| Review and authorize an external package release | [Production release](publish/production-release.md) | Approval records, a signed publication attestation, and a signed completion receipt |

Start with the local handoff if you are publishing your own Lean component. The [Lean author guide](lean-author-guide.md) covers the compiler setup and export declarations; the [consumer guides](consume.md) cover installing and calling the resulting packages.

## Know which record you have

The component dry run and the universal release gate both write a file named `publish-manifest.json`. They use different formats.

| Record | What it establishes |
|---|---|
| `component-package-receipt.json` | The local component and shared-runtime archives match their recorded identities and hashes. The receipt is unsigned. |
| Component `publish-manifest.json` | The version-two plan binds a reproduced component, its runtime dependency, registry settings, and public signer policy. The registry executor accepts this format. |
| Universal `release-authorization.json` and `publish-manifest.json` | The universal gate reproduced an exact candidate and recorded its ordered publication targets. External publication still needs credentials and a verified signature. |
| `registry-transaction.json` | The publisher recorded each target's preflight and write result, including partial progress. |
| `release-receipt.json` | An accepted signer signed the completed transaction, its package coordinates, and its archive identities. |
| Site `build-identity.json` | The Pages artifact records its source revision, route map, and file hashes. This unsigned file is not a registry release receipt. |

## Current publication prerequisites

The installed CLI registers the npm adapter. Production mode also checks the versioned deployment profile. That profile currently has candidate status and no reviewer approvals.

The registry executor requires an accepted public signer policy and an Ed25519 signer. Ordinary component authors configure both through `lean-bridge.cli.json` and a private-key-file environment reference; see [npm publishing](publish/npm.md#publish-an-ordinary-component). Universal project releases retain the reviewed release integration and project approval policy.

The [sandbox tutorial](publish/sandbox-release.md) identifies these inputs. The [production tutorial](publish/production-release.md) lists the review and recovery records and requires the [project release approval policy](../src/release/README.md#project-release-approval-policy). Contributing covers the [release pipeline](../src/release/README.md), with executed evidence under [release rehearsal](evidence/release-rehearsal.md), [reproducibility](evidence/reproducibility-release-gate.md), and [signed release receipts](evidence/release-receipt.md).
