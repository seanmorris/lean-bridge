# Release receipt and consumer verification evidence

## Result

Lean Bridge emits `release-receipt.json` only after `registry-transaction.json` reaches `complete`. The receipt maps each published coordinate, registry reference, package archive hash, backend plan hash, install command, and retained local archive to one authorized release candidate. It names the exact flake lock and component graph lock from that candidate.

`release-receipt.sha256` addresses the complete receipt bytes. A DSSE envelope inside the receipt signs an in-toto statement over the release authorization, publish manifest, original publication authorization, completed registry transaction, and package archives. The original pre-publication DSSE envelope also travels inside the receipt. A consumer can verify both decisions against one separately trusted public signer policy.

## Two signed decisions

Publication requires two different decisions because the registry result does not exist during preflight:

1. The publication authorization signs the exact artifacts, destinations, and idempotency keys before a credential value reaches an adapter.
2. The release receipt signs the registry references and terminal results after every selected target completes.

The second signature cannot authorize a different package. Receipt construction reconstructs the first statement from the verified publish manifest and release authorization, then checks its signature. It also verifies that the completed transaction names the same candidate, manifest, publication envelope, target order, coordinates, operations, idempotency keys, and archive hashes.

A partial, blocked, ambiguous, or failed transaction cannot produce a receipt. A retry after completion verifies and returns the existing receipt without calling the signer again. An adjacent exclusive lock prevents two publishers from writing the receipt together. A receipt without its hash record, or a hash record without its receipt, blocks replacement.

## Consumer commands

The receipt derives commands from canonical package names and versions:

| Target | Receipt command |
|---|---|
| npm | `npm install <name>@<version>` |
| Cargo | `cargo add <name>@<version>` |
| PyPI | `python -m pip install <name>==<version>` |
| Retained C or C++ archive | `tar -xf <authorized-archive>` |

Each target record also contains its registry reference, terminal state, idempotency key, backend plan, and complete archive inventory. Local C and C++ targets remain marked as retained archives. The receipt does not describe them as registry publications.

## Independent verification

A human, agent, or CI job supplies the receipt and a trusted public signer policy:

```sh
npm run verify:release-receipt -- \
  --receipt build/reproducibility-gate/release-receipt.json \
  --policy trusted-publication-signer-policy.json
```

The verifier performs these checks before printing a machine-readable result:

- compare `release-receipt.json` with `release-receipt.sha256`;
- verify the receipt JSON and both DSSE envelopes use canonical bytes;
- verify both signatures against the supplied Ed25519 policy;
- verify `publish-manifest.json`, its hash record, the release authorization, and the complete authorized artifact inventory;
- reconstruct the original publication statement;
- verify the durable transaction journal and its content hash;
- require one successful terminal result for every authorized target;
- compare every reported package hash with its manifest archive; and
- reconstruct the signed receipt statement and reject any difference.

The result reports the candidate identity, transaction identity, registry coordinates, registry references, archive hashes, install commands, receipt hash, and signature count. It contains no credential value or private key material.

## Public contract

[`src/release/release-receipt.mjs`](../../src/release/release-receipt.mjs) implements generation, signing, idempotent writing, and verification. [`schema/release-receipt.schema.json`](../../schema/release-receipt.schema.json) closes the receipt, statements, target records, envelopes, and signer audit. [`scripts/verify-release-receipt.mjs`](../../scripts/verify-release-receipt.mjs) provides the consumer command.

Run the focused gate:

```sh
npm run test:release-receipt
```

[`tests/release-receipt.test.mjs`](../../tests/release-receipt.test.mjs) covers lock identities, registry references, ordinary install commands, content hashes, both signature checks, idempotent reuse, concurrent writer rejection, incomplete output rejection, partial-state rejection, transaction artifact drift, untrusted policies, and closed schemas. [`tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) confirms that receipt generation runs after durable publication and appears in the closed JSON command result.

The repository still has no live registry adapters. The tests use injected registry outcomes and an ephemeral Ed25519 key. Production deployments must provide reviewed adapters, a separately distributed public policy, and an external signer implementation.
