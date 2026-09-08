# Review a production release

The installed publisher defaults to production mode and checks the versioned deployment profile before reading registry credentials. The checked-in profile currently has candidate status and no approvals, so production publication is blocked.

## Inspect the approval state

Run this from the Lean Bridge checkout:

```sh
npm run deployment:check
```

Exit code `2` means the profile is not eligible. The output identifies missing approval roles and the evidence categories required for review. The current profile requires the release owner, runtime owner, and security owner, with evidence for:

- Green full CI.
- External reconstruction of the candidate.
- A human clean-room consumer run.
- An actual npm sandbox publication.
- Security and assurance review.

The [profile file](../../config/production-deployment-profile.v1.json) owns the supported platform and version requirements. The evaluator checks the profile state and approval records. Reviewers must inspect the referenced evidence; the evaluator does not perform those external reviews for them.

Editing `status` or inserting names is not a substitute for approval. The responsible reviewers must authorize the specific profile revision and record their decisions through the project's review process.

## Freeze the candidate and authority

Start with the complete candidate from the [sandbox tutorial](sandbox-release.md), including its authorization, manifest, archives, comparison evidence, and sandbox result. Verify the candidate again before any external write:

```sh
npm run verify:release-authorization -- \
  --authorization build/reproducibility-gate \
  --candidate build/reproducibility-gate/release
```

Check the exact source revision, package coordinates, target order, archive hashes, and installation evidence. Rebuilds or target changes produce a new candidate and require renewed review. Preserve the signed input when recovering an interrupted transaction.

The release integration must already supply the accepted signer policy and signer provider described in the [sandbox tutorial](sandbox-release.md#configure-the-publisher-integration). The installed CLI does not expose those inputs through flags or its configuration file.

The npm adapter also requires the exact production opt-in value `LEAN_BRIDGE_NPM_PRODUCTION_OPT_IN=publish-to-production` before it writes. That value expresses the operator's intent; it does not replace the deployment approvals, candidate verification, signer policy, or registry permissions. Keep production tokens in the approved credential provider, not in a committed configuration or command transcript.

Execution consumes one universal `--manifest`. It rejects separate `--output`, `--bundle`, and `--authorization` inputs. Optional target arguments must match the authorized plan. The installed CLI provides only the npm registry adapter; another registry target requires an additional reviewed adapter.

## Retain the transaction records

The publisher verifies the pre-publication signature before accessing target-scoped credentials. It preflights every target, records progress durably, and signs a completion receipt only after the whole transaction completes.

Retain these records with the approved release:

| Record | Purpose |
|---|---|
| Universal authorization, manifest, and their hashes | Identify the reproduced candidate and requested publication. |
| Public signer policy and its independently distributed identity | Tell verifiers which signer to trust. |
| Publication attestation | Bind the accepted signature to the exact candidate and plan. |
| `registry-transaction.json` | Preserve each target's observed state, attempts, and completion. |
| `release-receipt.json` and `release-receipt.sha256` | Bind the completed transaction to package coordinates and archive hashes. |

## Verify the completed release

With the complete gate directory still present, verify its signed receipt against a policy obtained through your trusted release channel:

```sh
npm run verify:release-receipt -- \
  --receipt build/reproducibility-gate/release-receipt.json \
  --policy trusted-publication-signer-policy.json
```

Each published archive also receives a copied Node-only verifier, the signed receipt, and the public signer policy. Consumers can verify one archive without Lean or the full gate directory. Give them the policy's SHA-256 through an independent trusted channel. The [release receipt guide](../evidence/release-receipt.md) gives the exact per-archive command and subject selection.

An adjacent unsigned policy cannot authenticate itself. The archive verifier checks that the supplied policy matches the trusted policy hash before accepting the receipt's signer.

## Recover an interrupted release

A multi-target transaction cannot roll back every registry atomically. If a process stops after one target accepts an upload, keep the same manifest, attestation, and transaction record. Re-preflight determines whether the registry contains the expected bytes, has no publication, or has a collision.

Do not delete an existing transaction lock automatically. Confirm which process owns it and follow the team's recovery procedure. Do not edit archive hashes, clear partial results, or create a replacement manifest to conceal an uncertain write.

If the package itself needs correction, the release owner chooses an approved corrective release and any registry-specific recovery action. The [transactional release record](../evidence/transactional-registry-release.md) documents the supported recovery classifications.

The repository's [reproducible-release workflow](../../.github/workflows/reproducible-release.yml) builds and verifies candidate artifacts. Its `release-ready` job does not publish a registry package. The [Pages workflow](github-pages.md) deploys website files under separate authority.
