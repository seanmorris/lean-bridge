/**
 * Tests the publication attestation behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalJson } from "../src/capsule/node.mjs";
import {
	authorizePublication,
	createPublicationSignerPolicy,
	createPublicationStatement,
	dssePreauthenticationEncoding,
	publicationSignerPolicySha256,
	validatePublicationSignerPolicy,
	verifyPublicationAttestation,
} from "../src/release/publication-attestation.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const hash = character => character.repeat(64);
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const policy = createPublicationSignerPolicy({
	identity: "https://example.test/release-functionary"
	, publicKeyPem
});

const artifact = (path, bytes, digest) => ({
	path
	, mediaType: path.endsWith(".json") ? "application/json" : "application/gzip"
	, target: "npm"
	, profile: "browser"
	, bytes
	, mode: 0o644
	, sha256: digest
});

const verifiedFixture = () => {
	const candidate = {
		id: hash("1")
		, sourceRevision: "release-revision"
		, sourceTree: "source-tree"
		, flakeLockSha256: hash("2")
		, component: "lean-bridge-alpha"
		, version: "0.0.0"
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
			artifact("bundle/canonical-package.json", 98, hash("6"))
			, artifact("bundle/locks/flake.lock", 99, hash("7"))
			, artifact("bundle/metadata/assurance.json", 100, hash("8"))
			, artifact("bundle/metadata/provenance.intoto.json", 101, hash("9"))
			, artifact("bundle/metadata/sbom.spdx.json", 102, hash("a"))
			, artifact("packages/npm/npm-projection.json", 103, hash("b"))
			, artifact("packages/npm/lean-bridge-alpha.tgz", 104, hash("c"))
			, artifact("packages/publication-index.intoto.json", 105, hash("d"))
		]
		, publication: {
			externalRegistryWritesPerformed: false
			, packagesPath: "release/packages/publication-index.json"
			, packagesSha256: hash("e")
		}
	};
	const authorizationSha256 = sha256(canonicalJson(authorizationDocument));
	const manifest = {
		authorization: {
			sha256: authorizationSha256
			, candidateId: candidate.id
		}
		, selection: { plannedEcosystems: ["npm"] }
		, targets: [{
			order: 1
			, ecosystem: "npm"
			, coordinate: "@lean-bridge/alpha@0.0.0"
			, operation: "publish"
			, destination: { kind: "npm", endpoint: "https://registry.npmjs.org/" }
			, idempotencyKey: hash("f")
			, backendPlan: {
				path: "release/packages/npm/npm-projection.json"
				, bytes: 103
				, sha256: hash("b")
			}
			, archives: [{
				kind: "package"
				, path: "release/packages/npm/lean-bridge-alpha.tgz"
				, bytes: 104
				, sha256: hash("c")
			}]
		}]
	};
	return {
		manifest
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

const signer = Object.freeze({
	kind: "test-ed25519"
	, keyId: policy.signers[0].keyId
	, sign: bytes => sign(null, bytes, privateKey)
});

test("signer policy derives one canonical public identity without private material", () => {
  assert.equal(validatePublicationSignerPolicy(policy), true);
  assert.equal(policy.signers[0].keyId, policy.signers[0].publicKey.sha256);
  assert.match(policy.signers[0].keyId, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(policy).includes("PRIVATE KEY"), false);
  assert.equal(publicationSignerPolicySha256(policy), sha256(canonicalJson(policy)));

  const drifted = structuredClone(policy);
  drifted.signers[0].keyId = hash("0");
  assert.throws(
    () => validatePublicationSignerPolicy(drifted),
    error => error.code === "publication-signer-key-drift",
  );
});

test("publication statement binds source, locks, evidence, assurance artifacts, packages, and signer policy", () => {
  const verified = verifiedFixture();
  const statement = createPublicationStatement({ verified, policy });
  assert.equal(statement._type, "https://in-toto.io/Statement/v1");
  assert.equal(statement.predicate.authorization.sha256, verified.authorization.authorizationSha256);
  assert.equal(statement.predicate.authorization.candidate.sourceRevision, "release-revision");
  assert.equal(statement.predicate.authorization.candidate.flakeLockSha256, hash("2"));
  assert.equal(statement.predicate.authorization.candidate.canonicalManifestSha256, hash("3"));
  assert.equal(statement.predicate.authorization.reproducibilityReport.sha256, hash("6"));
  assert.equal(statement.predicate.assuranceArtifacts.manifests[0].path, "bundle/canonical-package.json");
  assert.equal(statement.predicate.assuranceArtifacts.locks[0].path, "bundle/locks/flake.lock");
  assert.equal(statement.predicate.assuranceArtifacts.assurance[0].path, "bundle/metadata/assurance.json");
  assert.deepEqual(statement.predicate.assuranceArtifacts.sbom, [
    { path: "bundle/metadata/sbom.spdx.json", sha256: hash("a") }
  ]);
  assert.equal(statement.predicate.assuranceArtifacts.provenance.length, 2);
  assert.equal(statement.predicate.publication.targets[0].idempotencyKey, hash("f"));
  assert.equal(statement.predicate.signerPolicy.sha256, publicationSignerPolicySha256(policy));
  assert.deepEqual(statement.subject.map(item => item.name), [
    "publish-manifest.json"
    , "release-authorization.json"
    , "release/packages/npm/lean-bridge-alpha.tgz"
    , "release/packages/npm/npm-projection.json"
  ]);
});

test("external signer returns a DSSE envelope that verifies against the exact publication closure", async () => {
  const verified = verifiedFixture();
  const result = await authorizePublication({ verified, policy, signer });
  assert.equal(result.audit.status, "verified");
  assert.equal(result.audit.privateMaterialReceived, false);
  assert.equal(result.audit.signer.identity, "https://example.test/release-functionary");
  assert.equal(result.envelope.payloadType, "application/vnd.in-toto+json");
  assert.equal(result.envelope.signatures[0].keyid, policy.signers[0].keyId);
  assert.equal(result.statementSha256, sha256(canonicalJson(result.statement)));
  assert.equal(result.envelopeSha256, sha256(canonicalJson(result.envelope)));
  const checked = verifyPublicationAttestation({ policy, envelope: result.envelope, verified });
  assert.equal(checked.status, "verified");
  assert.equal(checked.validSignatures, 1);
  assert.equal(checked.statementSha256, result.statementSha256);
  assert.throws(
    () => verifyPublicationAttestation({ policy, envelope: result.envelope }),
    error => error.code === "verified-publication-required",
  );
});

test("DSSE preauthentication binds payload type and exact bytes", () => {
  assert.equal(
    dssePreauthenticationEncoding("text/plain", Buffer.from("hello")).toString("utf8"),
    "DSSEv1 10 text/plain 5 hello",
  );
});

test("publication signing rejects unauthorized, invalid, and failing signer providers", async () => {
  const verified = verifiedFixture();
  await assert.rejects(
    authorizePublication({
      verified
      , policy
      , signer: { kind: "other", keyId: hash("0"), sign: () => Buffer.alloc(64) }
    }),
    error => error.code === "publication-signer-not-authorized",
  );
  await assert.rejects(
    authorizePublication({
      verified
      , policy
      , signer: { ...signer, sign: () => Buffer.alloc(64) }
    }),
    error => error.code === "publication-signature-invalid",
  );
  await assert.rejects(
    authorizePublication({
      verified
      , policy
      , signer: { ...signer, sign: () => { throw new Error("private provider detail"); } }
    }),
    error => error.code === "publication-signer-failed" && !error.message.includes("private provider detail"),
  );
});

test("publication signing rejects target artifacts outside the authorized release", async () => {
  const verified = verifiedFixture();
  verified.manifest.targets[0].archives[0].sha256 = hash("0");
  verified.manifestSha256 = sha256(canonicalJson(verified.manifest));
  let called = false;
  await assert.rejects(
    authorizePublication({
      verified
      , policy
      , signer: { ...signer, sign: bytes => { called = true; return sign(null, bytes, privateKey); } }
    }),
    error => error.code === "publication-attestation-target-drift",
  );
  assert.equal(called, false);
});

test("publication attestation schemas close policy, statement, envelope, and audit fields", async () => {
  const [policySchema, attestationSchema] = await Promise.all([
    readFile("schema/publication-signer-policy.schema.json", "utf8").then(JSON.parse)
    , readFile("schema/publication-attestation.schema.json", "utf8").then(JSON.parse)
  ]);
  assert.equal(policySchema.additionalProperties, false);
  assert.equal(policySchema.properties.signers.items.additionalProperties, false);
  assert.equal(attestationSchema.additionalProperties, false);
  assert.equal(attestationSchema.$defs.statement.additionalProperties, false);
  assert.equal(attestationSchema.$defs.envelope.additionalProperties, false);
  assert.equal(attestationSchema.$defs.audit.additionalProperties, false);
  assert.equal(attestationSchema.$defs.audit.properties.privateMaterialReceived.const, false);
});
