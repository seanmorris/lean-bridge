# Publication attestation evidence

## Result

An installed registry publisher cannot run until an accepted signer authorizes the exact verified publication closure. Lean Bridge creates the statement after publish-manifest verification and name-only credential preflight. It verifies the returned signature before any registry credential value can be read.

The execution order is fixed:

```text
verify publish manifest, release authorization, and complete artifact inventory
  ↓
check required registry credential names without reading values
  ↓
construct one in-toto publication statement from the verified closure
  ↓
send DSSE preauthentication bytes to an external signer
  ↓
verify the Ed25519 signature against the accepted public policy
  ↓
give the signed envelope and target-scoped credential capability to the publisher
```

Dry run cannot reach a signer. A missing registry publisher also stops before signer or credential-provider access.

## Signed closure

[`src/release/publication-attestation.mjs`](../../src/release/publication-attestation.mjs) emits an [in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) inside a [DSSE](https://github.com/secure-systems-lab/dsse) envelope. DSSE signs the payload type and exact payload bytes through its preauthentication encoding.

The statement subjects contain:

- `release-authorization.json` and its SHA-256 identity;
- `publish-manifest.json` and its SHA-256 identity;
- every selected backend plan; and
- every selected package archive.

The signed predicate also carries one closed archive-subject record per selected archive. Each record contains the ecosystem, package coordinate, operation, archive kind, path, filename, byte length, and SHA-256. The release receipt repeats the same records after publication so a clean consumer can detect archive or coordinate substitution without the repository closure.

The publication predicate records:

- the candidate identity, source revision, source tree, flake lock, canonical manifest, core artifact set, and complete artifact-inventory identity;
- the reproducibility report and reproducibility attestation identities;
- every authorized canonical manifest, lock, proof and assumption record, SBOM, and provenance artifact;
- ordered package coordinates, destinations, operations, archives, and idempotency keys; and
- the signer-policy identity and every accepted public signer identity.

The module confirms that every selected backend plan and archive appears with the same size and hash in the authorized release inventory. A registry adapter cannot substitute another package after reproducibility verification.

## Signer boundary

[`schema/publication-signer-policy.schema.json`](../../schema/publication-signer-policy.schema.json) defines the public trust input. Version 1 supports one required Ed25519 signature and one or more accepted signer identities. Each identity carries a canonical SPKI public key and a key ID derived from that key's DER bytes.

The signer provider exposes `kind`, `keyId`, and `sign(bytes)`. Lean Bridge sends only DSSE preauthentication bytes. The provider does not return or expose its private key. The CLI verifies the signature with the policy's public key and emits an audit containing public identities and hashes. The audit sets `privateMaterialReceived` to false.

[`schema/publication-attestation.schema.json`](../../schema/publication-attestation.schema.json) closes the policy, statement, envelope, and audit. The signed statement includes the policy hash, so another policy cannot be substituted after signing. Verification requires the authorized release closure, reconstructs the expected statement, and rejects a valid signature over different subjects or predicates.

The signer policy is a trusted deployment input. A verifier must receive it through reviewed configuration or another trusted channel. The envelope cannot authorize its own key by carrying a different policy.

Signer implementations remain deployment adapters. A provider may use a hardware token, agent, KMS, or CI identity as long as it returns an Ed25519 signature for the supplied bytes. This POC does not implement Sigstore keyless certificate and transparency-log verification. A keyless backend can be added behind a new policy version without changing the publication statement or registry adapters.

## Failure policy

Publication stops before registry execution when:

- signer policy is absent or malformed;
- the provider key is not accepted by the policy;
- the public key or key ID drifts;
- the provider fails or returns invalid signature bytes;
- signature verification fails;
- a manifest, lock, assurance, SBOM, or provenance artifact is absent;
- a selected package file is outside the authorized inventory; or
- the signed statement differs from the verified release closure.

Provider exception messages do not enter CLI diagnostics. Signing keys and registry credentials remain outside the build, derivation, dry run, generated packages, manifest, result, progress stream, and audit.

## Tests

[`tests/publication-attestation.test.mjs`](../../tests/publication-attestation.test.mjs) verifies public policy identity, closure construction, DSSE preauthentication, valid signatures, exact-envelope verification, unauthorized signers, invalid signatures, provider failure sanitization, artifact drift, and closed schemas.

[`tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) proves that signer authorization happens after name-only credential preflight and before publisher invocation or credential reads. The publisher receives the verified attestation, while the CLI result receives only its public audit.

Run the focused evidence:

```sh
npm run test:publication-attestation
```
