# Transactional multi-registry release evidence

Status: implemented as a durable coordinator with injected registry adapters. The coordinator performs no live registry operation in this repository. A production deployment installs reviewed npm, Cargo, PyPI, NuGet, Maven Central, or RubyGems adapters through the CLI handler contract.

## One authorized transaction

[`createRegistryTransactionPublisher`](../../src/release/registry-transaction.mjs) consumes the publish manifest only after the CLI has verified the reproducibility authorization, completed name-only credential preflight, and verified the signed publication attestation. Its transaction identity covers:

- the release candidate identity;
- the publish manifest SHA-256;
- the signed attestation envelope SHA-256; and
- every ordered target idempotency key.

An existing transaction can resume only when all four identities still match. A changed candidate, signature, manifest, target order, coordinate, operation, or idempotency key fails before an adapter call.

The coordinator follows two separate passes. The first pass checks every target. The second pass performs writes in manifest order. No adapter `publish` method can run until all configured targets have passed preflight.

```text
verify manifest and signed closure
              |
              v
preflight target 1, target 2, ... target n
              |
              v
persist ready state
              |
              v
publish target 1, persist, publish target 2, persist, ...
```

## Adapter preflight

Each adapter receives one target-scoped credential view. It cannot request credentials assigned to another ecosystem. The adapter returns a closed record containing:

- permission status;
- coordinate state as `available`, `matching`, or `collision`;
- an explicit registry immutability assertion;
- the published reference and archive hashes when the coordinate already exists; and
- dependency coordinates classified as available, planned earlier in the same transaction, or unavailable.

A matching coordinate counts as complete only when every reported archive hash equals the authorized archive set. A different or incomplete set is a collision. Denied permission, unverified immutability, a collision, an unavailable dependency, or a dependency ordered after its consumer blocks the entire transaction before the first write.

Local C, C++, and WIT/WASI archives use the `retain` operation. They receive a preflight record but do not access credentials or claim an external registry write.

## Durable partial success

The coordinator writes `registry-transaction.json` beside `publish-manifest.json`. [`registry-transaction.schema.json`](../../schema/registry-transaction.schema.json) closes the record. Each atomic replacement is flushed before the next external operation. The file records:

- the exact candidate, manifest, and attestation identities;
- the non-atomic cross-registry execution model;
- invocation and per-target attempt counts;
- the latest preflight evidence;
- a terminal result or structured failure for every target;
- whether an external write occurred, did not occur, or remains unknown; and
- registry-specific recovery guidance.

The coordinator persists `publishing` before calling an adapter. A thrown error or timeout after that transition records an unknown external-write outcome. The next invocation preflights the coordinate again. An exact match converts the ambiguous target to `published`; an available coordinate retries it; a mismatched coordinate blocks. Targets already recorded as published are never uploaded again.

An exclusive adjacent lock prevents two local processes from mutating one transaction file. The coordinator never silently removes an existing lock because it cannot prove that the other publisher has stopped.

## Registry recovery policy

The record does not claim cross-registry atomicity. Each registry commit stands independently. Recovery guidance states the consequence of each registry operation:

| Ecosystem | Recorded strategy | Effect |
|---|---|---|
| npm | Deprecate the affected version or publish a corrective version | npm coordinates remain immutable even when policy permits unpublishing. Deprecation warns consumers without breaking existing installs. |
| Cargo | Publish a compatible correction, then yank when appropriate | Yanking removes a version from new resolution but keeps downloads and existing lockfiles working. |
| PyPI | Yank affected files or publish a corrective version | Yanked files are skipped by ordinary resolution but remain available to exact pins. |
| NuGet | Unlist or deprecate, then publish a corrective version | The original immutable version remains available to exact restores while ordinary discovery moves to the correction. |
| Maven Central | Publish a corrective version | A released Central component cannot be changed or removed. |
| RubyGems | Yank, then publish a corrective version | Yanking removes the affected gem from installation and discovery before the correction is published. |
| C, C++, and WIT/WASI | Replace the retained archive before distribution | No external registry transaction has occurred yet. |

The policy sources are the [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/), [`cargo yank` documentation](https://doc.rust-lang.org/cargo/commands/cargo-yank.html), [Python file-yanking specification](https://packaging.python.org/en/latest/specifications/file-yanking/), [NuGet publish API](https://learn.microsoft.com/en-us/nuget/api/package-publish-resource), [Maven Central immutability policy](https://central.sonatype.org/faq/can-i-change-a-component/), and [RubyGems yank guide](https://guides.rubygems.org/removing-a-published-gem/).

## CLI result

`createCliHandlers({ registryAdapters })` installs the coordinator. A blocked preflight returns a structured CLI diagnostic plus the durable transaction path, hash, status, target results, credential audit, signer audit, and honest external-write state. A partial release returns the same recovery record with a failed command status. Credential values remain excluded from progress, errors, transaction state, and results.

The repository still leaves `registryAdapters` unset by default. This keeps the standalone POC from performing live registry writes while allowing a deployment to install reviewed adapters without replacing the transaction semantics.

After a transaction reaches `complete`, the CLI passes its durable path and hash to the [`release receipt`](release-receipt.md) writer. The writer signs the post-publication coordinate and artifact map. Partial, blocked, and ambiguous states remain recovery records and cannot become consumer receipts.

## Acceptance coverage

Run:

```sh
npm run test:registry-transaction
```

[`registry-transaction.test.mjs`](../../tests/registry-transaction.test.mjs) proves:

- all preflights precede all writes;
- retain, npm, Cargo, PyPI, NuGet, Maven, and RubyGems targets share the same authorized ordering and recovery contract;
- collisions, denied permission, unavailable dependencies, missing adapters, invalid dependency order, and lock conflicts perform no write;
- already-published exact coordinates are idempotent;
- mismatched archive hashes are collisions;
- partial releases resume without republishing completed coordinates;
- an ambiguous committed write is recovered by the next exact-match preflight;
- transaction state and recovery policies remain closed; and
- CLI output preserves the transaction record without exposing a credential value.
