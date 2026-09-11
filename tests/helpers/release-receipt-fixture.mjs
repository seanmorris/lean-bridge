/**
 * Share production-generated signed handoffs between receipt and CLI tests.
 *
 * @file
 */

import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	authorizePublication, createPublicationSignerPolicy, publicationSignerPolicySha256
} from "../../src/release/publication-attestation.mjs";
import { writeReleaseReceipt } from "../../src/release/release-receipt.mjs";

/**
 * Hash the exact bytes used by a receipt fixture.
 *
 * @param value - String or buffer to hash.
 */
const sha256 = value => createHash("sha256").update(value).digest("hex");
/**
 * Make a deterministic placeholder identity for unrelated fixture artifacts.
 *
 * @param character - One hexadecimal character.
 */
const hash = character => character.repeat(64);
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const policy = createPublicationSignerPolicy({
	identity: "https://example.test/release-functionary"
	, publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString()
});
const signer = Object.freeze({
	kind: "test-ed25519"
	, keyId: policy.signers[0].keyId
	, sign: bytes => sign(null, bytes, privateKey)
});

const archiveFixtures = Object.freeze({
	c: Object.freeze({
		path: "release/packages/c/alpha.tar.gz"
		, bytes: Buffer.from("deterministic C archive\n")
	})
	, npm: Object.freeze({
		path: "release/packages/npm/alpha.tgz"
		, bytes: Buffer.from("deterministic npm archive\n")
	})
});

const artifact = (path, bytes, digest) => ({
	path
	, mediaType: path.endsWith(".json") ? "application/json" : "application/octet-stream"
	, target: "release"
	, profile: "browser"
	, bytes
	, mode: 0o644
	, sha256: digest
});

const makeVerified = manifestPath => {
	const candidate = {
		id: hash("1")
		, sourceRevision: "release-revision"
		, sourceTree: "source-tree"
		, flakeLockSha256: hash("2")
		, component: "lean-bridge-alpha"
		, version: "1.2.3"
		, canonicalManifestSha256: hash("3")
		, coreArtifactSetSha256: hash("4")
		, artifactInventorySha256: hash("5")
	};
	const authorizationDocument = {
		schemaVersion: 1
		, predicateType: "urn:lean-bridge:attestation:release-authorization:v1"
		, status: "authorized"
		, candidate
		, evidence: {
			reportPath: "evidence/reproducibility.json"
			, reportSha256: hash("6")
			, humanReportPath: "evidence/reproducibility.md"
			, humanReportSha256: hash("7")
			, attestationPath: "evidence/reproducibility.intoto.json"
			, attestationSha256: hash("8")
		}
		, authorizedArtifacts: [
			artifact("bundle/canonical-package.json", 98, hash("3"))
			, artifact("bundle/locks/flake.lock", 99, hash("2"))
			, artifact("bundle/locks/graph-lock.json", 100, hash("9"))
			, artifact("bundle/metadata/assurance.json", 101, hash("a"))
			, artifact("bundle/metadata/provenance.intoto.json", 102, hash("b"))
			, artifact("bundle/metadata/sbom.spdx.json", 103, hash("c"))
			, artifact("packages/c/alpha.tar.gz", archiveFixtures.c.bytes.length, sha256(archiveFixtures.c.bytes))
			, artifact("packages/c/c-projection.json", 105, hash("e"))
			, artifact("packages/npm/alpha.tgz", archiveFixtures.npm.bytes.length, sha256(archiveFixtures.npm.bytes))
			, artifact("packages/npm/npm-projection.json", 107, hash("0"))
			, artifact("packages/publication-index.intoto.json", 108, hash("6"))
		]
		, publication: {
			externalRegistryWritesPerformed: false
			, packagesPath: "release/packages/publication-index.json"
			, packagesSha256: hash("7")
		}
	};
	const authorizationSha256 = sha256(canonicalJson(authorizationDocument));
	const manifest = {
		authorization: {
			path: "release-authorization.json"
			, sha256: authorizationSha256
			, candidateId: candidate.id
		}
		, selection: { plannedEcosystems: ["c", "npm"] }
		, targets: [
			{
				order: 1
				, candidateId: candidate.id
				, ecosystem: "c"
				, name: "lean-bridge-alpha"
				, version: "1.2.3"
				, target: "c-source"
				, coordinate: "lean-bridge-alpha@1.2.3"
				, operation: "retain"
				, destination: { kind: "archive", endpoint: null }
				, idempotencyKey: hash("a")
				, backendPlan: { path: "release/packages/c/c-projection.json", bytes: 105, sha256: hash("e") }
				, archives: [{ kind: "source", path: archiveFixtures.c.path, bytes: archiveFixtures.c.bytes.length, sha256: sha256(archiveFixtures.c.bytes) }]
			}
			, {
				order: 2
				, candidateId: candidate.id
				, ecosystem: "npm"
				, name: "@lean-bridge/alpha"
				, version: "1.2.3"
				, target: "node-esm"
				, coordinate: "@lean-bridge/alpha@1.2.3"
				, operation: "publish"
				, destination: { kind: "npm", endpoint: "https://registry.npmjs.org/" }
				, idempotencyKey: hash("b")
				, backendPlan: { path: "release/packages/npm/npm-projection.json", bytes: 107, sha256: hash("0") }
				, archives: [{ kind: "package", path: archiveFixtures.npm.path, bytes: archiveFixtures.npm.bytes.length, sha256: sha256(archiveFixtures.npm.bytes) }]
			}
		]
	};
	return {
		manifest
		, manifestPath
		, manifestSha256: sha256(canonicalJson(manifest))
		, authorizationDocument
		, authorization: {
			status: "authorized"
			, candidate
			, authorizationSha256
			, artifactCount: authorizationDocument.authorizedArtifacts.length
		}
	};
};

/**
 * Model recorded registry results without contacting a registry.
 *
 * @param verified - Fixture publication plan and authorization.
 * @param publicationAttestation - Signed publication decision.
 * @param status - Transaction state for success or rejection checks.
 */
const transactionFor = (verified, publicationAttestation, status = "complete") => ({
	schemaVersion: 1
	, predicateType: "urn:lean-bridge:registry-transaction:v1"
	, transactionId: hash("8")
	, candidateId: verified.authorization.candidate.id
	, manifest: { path: "publish-manifest.json", sha256: verified.manifestSha256 }
	, attestation: {
		statementSha256: publicationAttestation.statementSha256
		, envelopeSha256: publicationAttestation.envelopeSha256
	}
	, status
	, atomicity: "independent-registry-commits"
	, attemptCount: 1
	, createdAt: "2026-08-10T00:00:00.000Z"
	, updatedAt: "2026-08-10T00:01:00.000Z"
	, externalRegistryWrites: true
	, targets: verified.manifest.targets.map(target => {
    const retained = target.operation === "retain";
    const targetStatus = retained ? "retained" : "published";
    return {
      order: target.order
      , ecosystem: target.ecosystem
      , coordinate: target.coordinate
      , operation: target.operation
      , idempotencyKey: target.idempotencyKey
      , status: targetStatus
      , attempts: retained ? 0 : 1
      , preflight: {
        permission: retained ? "not-required" : "granted"
        , coordinateState: retained ? "local" : "available"
        , immutable: true
        , registryReference: null
        , artifacts: retained ? target.archives.map(item => ({ sha256: item.sha256 })) : []
        , dependencies: []
      }
      , result: {
        status: targetStatus
        , registryReference: retained ? null : `https://registry.npmjs.org/${encodeURIComponent(target.name)}/-/${target.version}`
        , artifacts: target.archives.map(item => ({ sha256: item.sha256 }))
        , externalWrite: !retained
      }
      , failure: null
      , recovery: {
        strategy: retained ? "replace-retained-archive-before-distribution" : "deprecate-or-publish-corrective-version"
        , command: retained ? null : "npm deprecate <name>@<version> \"<reason and replacement>\""
        , effect: "Record a registry-specific corrective action."
        , source: "https://example.test/recovery"
      }
    };
	})
});

/** Create local archive bytes and publication records; the caller owns cleanup. */
const fixture = async () => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-release-receipt-"));
	for(const archive of Object.values(archiveFixtures))
	{
		await mkdir(join(root, archive.path, ".."), { recursive: true });
		await writeFile(join(root, archive.path), archive.bytes);
	}
	const manifestPath = join(root, "publish-manifest.json");
	await writeFile(manifestPath, "{}", "utf8");
	const verified = makeVerified(manifestPath);
	const publicationAttestation = await authorizePublication({ verified, policy, signer });
	const transaction = transactionFor(verified, publicationAttestation);
	const transactionPath = join(root, "registry-transaction.json");
	const transactionSource = canonicalJson(transaction);
	await writeFile(transactionPath, transactionSource);
	return {
		root
		, verified
		, publicationAttestation
		, transaction
		, transactionPath
		, transactionSha256: sha256(transactionSource)
	};
};

export { archiveFixtures, fixture, hash, policy, sha256, signer, transactionFor };

/**
 * Produce a signed archive with real publication and receipt signatures.
 *
 * @param context - Node test context owning the fixture's temporary files.
 */
export const createSignedHandoff = async context => {
	const value = await fixture();
	context.after(() => rm(value.root, { recursive: true, force: true }));
	await writeReleaseReceipt({
		verified: value.verified
		, transactionResult: { transaction: {
			path: value.transactionPath
			, sha256: value.transactionSha256
			, id: value.transaction.transactionId, status: "complete"
		} }
		, publicationAttestation: value.publicationAttestation
		, policy, signer
	});
	const directory = join(value.root, "release/packages/npm");
	const receiptPath = join(directory, "release-receipt.json");
	const policyPath = join(directory, "publication-signer-policy.json");
	const archivePath = join(value.root, archiveFixtures.npm.path);
	const args = [
		"--receipt", receiptPath, "--archive", archivePath
		, "--policy", policyPath
		, "--policy-sha256", publicationSignerPolicySha256(policy)
		, "--subject", archiveFixtures.npm.path
		, "--coordinate", "@lean-bridge/alpha@1.2.3"
	];
	return { ...value, directory, receiptPath, policyPath, archivePath, args };
};
