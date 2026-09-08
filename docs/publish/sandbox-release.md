# Rehearse a registry release

Run the local release checks before connecting a publisher to a registry. A real sandbox transaction still writes to an external service. The release owner must choose an operator-controlled endpoint and credentials that cannot publish to production.

## Check the release machinery locally

From the Lean Bridge checkout, run the focused tests:

```sh
npm run test:release-rehearsal
npm run test:release-authorization
npm run test:publication-attestation
npm run test:registry-transaction
node --test tests/npm-registry-adapter.test.mjs
npm run test:release-receipt
```

These tests use fixtures, temporary directories, and injected registry clients. They exercise rejection, retries, signatures, and exact archive checks without uploading packages. A passing test run does not establish that an actual sandbox accepted a release.

If you already have a universal bundle, inspect its package projections without connecting to a registry:

```sh
npm run release:rehearse -- \
  --bundle build/universal-release-bundle \
  --output build/release-rehearsal
```

The bundle must already exist, and the output directory must be new. The rehearsal emits deterministic package archives and a `publication-index.json` that lists included targets and reasons for omissions. Its `no-publish` mode performs no registry writes. See the [release rehearsal record](../evidence/release-rehearsal.md) for the bundle variants.

## Produce the universal candidate

Use a clean committed Lean Bridge checkout with the repository's Nix prerequisites. Invoke that checkout's CLI from its root so it selects the universal gate. This command builds from two separate checkouts, then creates a manifest selecting npm. The builders may fetch dependencies:

```sh
node scripts/lean-bridge.mjs publish --project . --target npm --dry-run \
  --output build/reproducibility-gate
npm run verify:release-authorization -- \
  --authorization build/reproducibility-gate \
  --candidate build/reproducibility-gate/release
```

Keep the entire gate directory. A passing gate contains `release/bundle/`, `release/packages/`, the comparison evidence, `release-authorization.json`, and the universal `publish-manifest.json`, with their hash records. The second command reports `status: authorized` when the authorization still matches the candidate; it does not publish it.

The lower-level `npm run release:reproducibility` script used by CI stops after candidate authorization. The CLI dry-run handler adds the publication manifest. Do not assume that a downloaded authorization artifact already contains one.

This universal gate differs from the ordinary-component dry run in the [local handoff tutorial](local-handoff.md). The component plan cannot be substituted for the universal manifest.

## Configure the publisher integration

The installed CLI includes the npm registry adapter, but does not currently wire a signer policy or provider. There is no supported `--signer` flag or signer field in the CLI configuration file. A maintainer must supply the accepted policy and provider through [`createCliHandlers`](../../src/cli/commands.mjs) in a reviewed release integration.

That integration needs:

| Input | Required behavior |
|---|---|
| The exact universal manifest | Preserve the candidate hashes and ordered target selection. |
| A sandbox npm adapter | Use the approved endpoint; never reuse production credentials. |
| A credential provider | Make `NPM_TOKEN` available only to the npm target. Keep its value out of logs and source files. |
| An accepted signer policy | Identify the allowed public keys and signer identities through a trusted review process. |
| A signer provider | Supply `kind`, `keyId`, and `sign(bytes)`; return a signature without exposing its private key to the release records. |

The installed adapter recognizes `LEAN_BRIDGE_NPM_REGISTRY_MODE=sandbox` and `LEAN_BRIDGE_NPM_REGISTRY_URL`. Sandbox mode defaults to `http://127.0.0.1:4873/` and rejects the public npm production endpoint. A custom URL can point elsewhere, so the release owner must inspect it. Registry settings alone do not supply the missing signer integration.

The handler verifies the manifest, checks required credential names, and verifies the publication signature before invoking the transaction publisher. The transaction preflights every target before its first write. The npm adapter checks the archive hash, publishes with lifecycle scripts disabled, and compares the registry's tarball hash with the authorized bytes.

The installed adapter covers npm. A plan containing another registry ecosystem needs its corresponding reviewed adapter. Package generation for an ecosystem does not install its publisher automatically.

## Record and repeat the sandbox run

An authorized operator runs the reviewed integration against the chosen sandbox. Record the source revision, candidate and manifest hashes, endpoint, public signer-policy identity, transaction result, archive hashes, and consumer installation result. Exclude tokens and private keys.

Keep `registry-transaction.json` after success or failure. Repeating the same authorized transaction inspects the registry again: identical bytes count as an existing publication, an available coordinate can proceed, and a coordinate containing different bytes blocks the release. Do not erase the transaction to force another upload.

The [transaction evidence](../evidence/transactional-registry-release.md) describes interrupted writes and locking. Advance to [production review](production-release.md) only with an actual sandbox record and the required approvals.
