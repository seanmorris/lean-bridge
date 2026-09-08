# Publish packages and the demo site

Lean Bridge can produce local package archives, verify a reproducible release candidate, and execute a signed registry transaction through a configured publisher. GitHub Pages has a separate workflow for publishing the documentation and browser demos.

## Choose the delivery path

| Your task | Tutorial | Result |
|---|---|---|
| Give another developer a package they can install | [Local package handoff](publish/local-handoff.md) | Two npm archives, a component receipt, and a verifier |
| Exercise a registry integration without writing to production | [Sandbox release](publish/sandbox-release.md) | A reviewed candidate and a sandbox transaction record |
| Review and authorize an external package release | [Production release](publish/production-release.md) | Approval records, a signed publication attestation, and a signed completion receipt |
| Publish these guides and the algorithm workbenches | [GitHub Pages](publish/github-pages.md) | A tested static artifact and a Pages deployment |

Start with the local handoff if you are publishing your own Lean component. The [Lean author guide](lean-author-guide.md) covers the compiler setup and export declarations; the [consumer guides](consume.md) cover installing and calling the resulting packages.

## Know which record you have

The component dry run and the universal release gate both write a file named `publish-manifest.json`. They use different formats.

| Record | What it establishes |
|---|---|
| `component-package-receipt.json` | The local component and shared-runtime archives match their recorded identities and hashes. The receipt is unsigned. |
| Component `publish-manifest.json` | The component dry run produced a local package plan with `kind: lean-bridge-component-publish-plan`. The registry executor does not accept this format. |
| Universal `release-authorization.json` and `publish-manifest.json` | The universal gate reproduced an exact candidate and recorded its ordered publication targets. External publication still needs credentials and a verified signature. |
| `registry-transaction.json` | The publisher recorded each target's preflight and write result, including partial progress. |
| `release-receipt.json` | An accepted signer signed the completed transaction, its package coordinates, and its archive identities. |
| Site `build-identity.json` | The Pages artifact records its source revision, route map, and file hashes. This unsigned file is not a registry release receipt. |

## Current publication prerequisites

The installed CLI registers the npm adapter. Production mode also checks the versioned deployment profile. That profile currently has candidate status and no reviewer approvals.

The registry executor requires an accepted signer policy and a signer provider. The installed CLI does not currently expose flags or configuration fields that supply them. A release integration must provide them through the handler factory before it can execute a registry publication. Setting registry environment variables alone does not complete that integration.

The [sandbox tutorial](publish/sandbox-release.md) identifies these inputs. The [production tutorial](publish/production-release.md) lists the review and recovery records. Implementation details remain in the [release pipeline](../src/release/README.md), with executed evidence under [release rehearsal](evidence/release-rehearsal.md), [reproducibility](evidence/reproducibility-release-gate.md), and [signed release receipts](evidence/release-receipt.md).
