# Release receipt and consumer verification evidence

## Result

Lean Bridge emits `release-receipt.json` only after `registry-transaction.json` reaches `complete`. The receipt maps each published coordinate, registry reference, package archive, backend plan, install command, and retained local archive to one authorized release candidate. It names the exact flake lock and component graph lock from that candidate.

Each signed archive subject records its ecosystem, coordinate, operation, archive kind, release-relative path, filename, byte length, and SHA-256. The same archive-subject array appears in the pre-publication authorization and post-publication receipt. Verification rejects any difference between those arrays, their package targets, or their in-toto subjects.

`release-receipt.sha256` addresses the complete receipt bytes. A DSSE envelope inside the receipt signs an in-toto statement over the release authorization, publish manifest, original publication authorization, completed registry transaction, and package archives. The original pre-publication DSSE envelope also travels inside the receipt. A consumer verifies both decisions against one public signer policy whose SHA-256 identity arrived through a separate trusted channel.

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
| NuGet | `dotnet add package <name> --version <version>` |
| Maven | `mvn dependency:get -Dartifact=<group>:<artifact>:<version>` |
| RubyGems | `gem install <name> --version <version>` |
| Retained C, C++, or WIT/WASI archive | `tar -xf <authorized-archive>` |

Each target record also contains its registry reference, terminal state, idempotency key, backend plan, and complete archive inventory. Local C, C++, and WIT/WASI targets remain marked as retained archives. The receipt does not describe them as registry publications.

## Archive handoff

After signing, the writer checks every local archive against the authorized byte length and SHA-256. It places these files beside every selected archive:

- `release-receipt.json` and `release-receipt.sha256`;
- `publication-signer-policy.json` and its hash record; and
- `verify-release-archive.mjs`.

The verifier imports only Node built-ins. It does not use a Lean Bridge checkout, publish manifest, transaction journal, registry client, or package-manager plugin.

The adjacent policy is a convenience copy. It cannot authenticate itself. A consumer obtains the expected policy SHA-256 from reviewed deployment configuration, a pinned application lock, or another trusted distribution channel.

Verify one downloaded archive from any working directory:

```sh
node verify-release-archive.mjs \
  --archive ./lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl \
  --receipt ./release-receipt.json \
  --policy ./publication-signer-policy.json \
  --policy-sha256 <trusted-policy-sha256> \
  --subject release/packages/pypi/lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl \
  --coordinate lean-bridge-alpha==0.0.0
```

The verifier performs these checks before printing a machine-readable result:

- compare `release-receipt.json` with `release-receipt.sha256`;
- compare the adjacent policy with the separately trusted policy identity;
- verify the receipt, policy, and both DSSE envelopes use canonical bytes;
- verify both signatures against the supplied Ed25519 policy;
- require the two signed decisions to identify the same policy and each other;
- compare every archive subject with its signed package target and in-toto subject;
- require the requested subject path and coordinate to identify one archive; and
- compare the downloaded filename, byte length, and SHA-256 with that archive subject.

The result reports the ecosystem, coordinate, operation, subject path, filename, byte length, archive SHA-256, receipt SHA-256, policy SHA-256, and valid signature counts. It contains no credential value or private key material.

## Full publication closure verification

Publishers and release auditors with the complete handoff can also reconstruct the authorization, manifest, artifact inventory, and transaction:

```sh
npm run verify:release-receipt -- \
  --receipt build/reproducibility-gate/release-receipt.json \
  --policy trusted-publication-signer-policy.json
```

## Public contract

[`src/release/release-receipt.mjs`](../../src/release/release-receipt.mjs) implements generation, signing, idempotent writing, and handoff publication. [`src/release/archive-subjects.mjs`](../../src/release/archive-subjects.mjs) defines the exact archive-subject contract. [`src/release/release-archive-verifier.mjs`](../../src/release/release-archive-verifier.mjs) is the self-contained consumer verifier. [`schema/release-receipt.schema.json`](../../schema/release-receipt.schema.json) closes the receipt, archive subjects, target records, envelopes, and signer audit. [`scripts/verify-release-receipt.mjs`](../../scripts/verify-release-receipt.mjs) retains the full-closure audit command.

Run the focused gate:

```sh
npm run test:release-receipt
```

[`tests/release-receipt.test.mjs`](../../tests/release-receipt.test.mjs) executes the copied verifier from an unrelated directory, accepts the exact archive, and rejects altered bytes and a substituted adjacent policy. [`tests/archive-subjects.test.mjs`](../../tests/archive-subjects.test.mjs) maps all thirteen supported consumers to npm, native, managed, PHP, and WIT/WASI archive subjects. The remaining receipt tests cover idempotent reuse, concurrent writer rejection, partial-state rejection, transaction drift, signer policy drift, and closed schemas. [`tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) confirms that receipt generation runs after durable publication and appears in the closed JSON command result.

The repository still has no live registry adapters. The tests use injected registry outcomes and an ephemeral Ed25519 key. Production deployments must provide reviewed adapters, a separately distributed public policy, and an external signer implementation.
