#!/usr/bin/env node
/**
 * Verifies one downloaded ecosystem archive against a signed release receipt and trusted signer policy.
 *
 * @file
 */

import {
	createHash,
	createPublicKey,
	verify as verifySignature,
} from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const documentType = "urn:lean-bridge:release-receipt:v1";
const policyPredicate = "urn:lean-bridge:policy:publication-signer:v1";
const publicationPredicate = "urn:lean-bridge:attestation:publication-authorization:v1";
const receiptPredicate = "urn:lean-bridge:attestation:release-receipt:v1";
const statementType = "https://in-toto.io/Statement/v1";
const payloadType = "application/vnd.in-toto+json";
const sha256Pattern = /^[0-9a-f]{64}$/;
const sha256 = value => createHash("sha256").update(value).digest("hex");

const canonicalValue = value => {
	if(Array.isArray(value)) return value.map(canonicalValue);
	if(value !== null && typeof value === "object")
	{
		return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
	}
	return value;
};

const canonicalJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;

/**
 * Reports standalone release archive verification failures with stable machine-readable codes.
 */
export class ReleaseArchiveVerificationError extends Error
{
	/**
	 * Creates a release archive verification error.
	 *
	 * @param code - Stable failure category.
	 * @param message - Human-readable failure explanation.
	 */
	constructor(code, message)
	{
		super(message);
		this.name = "ReleaseArchiveVerificationError";
		this.code = code;
	}
}

const fail = (code, message) => {
	throw new ReleaseArchiveVerificationError(code, message);
};

const exactKeys = (value, keys, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-release-verification-input", `${label} must be an object`);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected)) fail("invalid-release-verification-input", `${label} fields must be closed`);
};

const string = (value, label) => {
	if(typeof value !== "string" || value === "") fail("invalid-release-verification-input", `${label} must be a non-empty string`);
};

const digest = (value, label) => {
	if(typeof value !== "string" || !sha256Pattern.test(value)) fail("invalid-release-verification-input", `${label} must be a SHA-256 identity`);
};

const portablePath = (value, label) => {
	string(value, label);
	if(value.startsWith("/") || value.includes("\\") || value.split("/").includes(".."))
	{
		fail("invalid-release-verification-input", `${label} must be a relative portable path`);
	}
};

const canonicalBase64 = (value, label) => {
	string(value, label);
	const bytes = Buffer.from(value, "base64");
	if(bytes.toString("base64") !== value) fail("invalid-release-verification-input", `${label} must use canonical base64`);
	return bytes;
};

const readCanonicalJson = async (path, label) => {
	const source = await readFile(path, "utf8");
	let value;
	try
	{
		value = JSON.parse(source);
	} catch
	{
		fail("invalid-release-verification-json", `${label} is not valid JSON`);
	}
	if(source !== canonicalJson(value)) fail("noncanonical-release-verification-input", `${label} is not canonical JSON`);
	return { source, value };
};

const policyRecord = policy => {
	exactKeys(policy, [
		"schemaVersion"
		, "predicateType"
		, "threshold"
		, "envelope"
		, "payloadType"
		, "statementType"
		, "publicationPredicateType"
		, "signers"
	], "signer policy");
	if(
		policy.schemaVersion !== 1 || policy.predicateType !== policyPredicate || policy.threshold !== 1
		|| policy.envelope !== "dsse-v1" || policy.payloadType !== payloadType
		|| policy.statementType !== statementType || policy.publicationPredicateType !== publicationPredicate
	) fail("invalid-release-signer-policy", "Signer policy version or format is unsupported");
	if(!Array.isArray(policy.signers) || policy.signers.length === 0) fail("invalid-release-signer-policy", "Signer policy has no accepted signer");
	const keys = new Map();
	let previous = null;
	for(const signer of policy.signers)
	{
		exactKeys(signer, ["identity", "keyId", "algorithm", "publicKey"], "signer");
		string(signer.identity, "signer identity");
		digest(signer.keyId, "signer keyId");
		if(signer.algorithm !== "ed25519") fail("invalid-release-signer-policy", "Signer algorithm must be Ed25519");
		exactKeys(signer.publicKey, ["format", "sha256", "value"], "signer public key");
		if(signer.publicKey.format !== "spki-pem") fail("invalid-release-signer-policy", "Signer public key must use SPKI PEM");
		digest(signer.publicKey.sha256, "signer public key identity");
		let key;
		try
		{
			key = createPublicKey(signer.publicKey.value);
		} catch
		{
			fail("invalid-release-signer-policy", "Signer public key is invalid");
		}
		if(key.asymmetricKeyType !== "ed25519") fail("invalid-release-signer-policy", "Signer public key must use Ed25519");
		const canonicalPem = key.export({ type: "spki", format: "pem" }).toString();
		const keyId = sha256(key.export({ type: "spki", format: "der" }));
		if(
			signer.publicKey.value !== canonicalPem || signer.publicKey.sha256 !== keyId || signer.keyId !== keyId
		) fail("release-signer-policy-key-drift", "Signer identity differs from its canonical public key");
		if(previous !== null && signer.keyId.localeCompare(previous) <= 0) fail("invalid-release-signer-policy", "Signers must use unique canonical key order");
		previous = signer.keyId;
		keys.set(signer.keyId, key);
	}
	return keys;
};

const preauthenticated = payload => {
	const type = Buffer.from(payloadType, "utf8");
	return Buffer.concat([
		Buffer.from(`DSSEv1 ${type.length} `, "utf8")
		, type
		, Buffer.from(` ${payload.length} `, "utf8")
		, payload
	]);
};

const verifyEnvelope = ({ envelope, keys, threshold, predicateType, label }) => {
	exactKeys(envelope, ["payloadType", "payload", "signatures"], label);
	if(envelope.payloadType !== payloadType) fail("invalid-release-envelope", `${label} payload type is invalid`);
	const payload = canonicalBase64(envelope.payload, `${label} payload`);
	if(!Array.isArray(envelope.signatures) || envelope.signatures.length === 0) fail("invalid-release-envelope", `${label} has no signature`);
	let validSignatures = 0;
	const seen = new Set();
	for(const signature of envelope.signatures)
	{
		exactKeys(signature, ["keyid", "sig"], `${label} signature`);
		digest(signature.keyid, `${label} signature keyId`);
		if(seen.has(signature.keyid)) fail("invalid-release-envelope", `${label} repeats one signer`);
		seen.add(signature.keyid);
		const key = keys.get(signature.keyid);
		if(key !== undefined && verifySignature(null, preauthenticated(payload), key, canonicalBase64(signature.sig, `${label} signature`)))
		{
			validSignatures += 1;
		}
	}
	if(validSignatures < threshold) fail("release-signature-threshold", `${label} does not satisfy the trusted signer policy`);
	let statement;
	try
	{
		statement = JSON.parse(payload.toString("utf8"));
	} catch
	{
		fail("invalid-release-envelope", `${label} payload is not valid JSON`);
	}
	if(payload.toString("utf8") !== canonicalJson(statement)) fail("invalid-release-envelope", `${label} statement is not canonical JSON`);
	exactKeys(statement, ["_type", "subject", "predicateType", "predicate"], `${label} statement`);
	if(statement._type !== statementType || statement.predicateType !== predicateType) fail("invalid-release-envelope", `${label} statement type is invalid`);
	return { statement, statementSha256: sha256(payload), envelopeSha256: sha256(canonicalJson(envelope)), validSignatures };
};

const subjectMap = (statement, label) => {
	if(!Array.isArray(statement.subject) || statement.subject.length === 0) fail("invalid-release-envelope", `${label} has no subjects`);
	const subjects = new Map();
	for(const subject of statement.subject)
	{
		exactKeys(subject, ["name", "digest"], `${label} subject`);
		string(subject.name, `${label} subject name`);
		exactKeys(subject.digest, ["sha256"], `${label} subject digest`);
		digest(subject.digest.sha256, `${label} subject sha256`);
		if(subjects.has(subject.name)) fail("invalid-release-envelope", `${label} repeats subject ${subject.name}`);
		subjects.set(subject.name, subject.digest.sha256);
	}
	return subjects;
};

const archiveSubjects = ({ statement, targetPath, label }) => {
	const values = statement.predicate?.archiveSubjects;
	if(!Array.isArray(values) || values.length === 0) fail("release-archive-subject-missing", `${label} has no archive subjects`);
	const targets = targetPath(statement);
	if(!Array.isArray(targets) || targets.length === 0) fail("release-archive-target-missing", `${label} has no package targets`);
	const expected = [];
	for(const target of targets)
	{
		if(target === null || typeof target !== "object" || !Array.isArray(target.archives)) fail("invalid-release-envelope", `${label} target is incomplete`);
		for(const archive of target.archives)
		{
			expected.push({
				ecosystem: target.ecosystem
				, coordinate: target.coordinate
				, operation: target.operation
				, kind: archive.kind
				, path: archive.path
				, filename: basename(archive.path)
				, bytes: archive.bytes
				, sha256: archive.sha256
			});
		}
	}
	expected.sort((left, right) => left.path.localeCompare(right.path));
	const statementSubjects = subjectMap(statement, label);
	let previous = null;
	for(const subject of values)
	{
		exactKeys(subject, ["ecosystem", "coordinate", "operation", "kind", "path", "filename", "bytes", "sha256"], `${label} archive subject`);
		for(const field of ["ecosystem", "coordinate", "operation", "kind", "filename"])
		{
			string(subject[field], `${label} archive subject ${field}`);
		}
		portablePath(subject.path, `${label} archive subject path`);
		if(subject.filename !== basename(subject.path)) fail("release-archive-subject-drift", `${label} archive filename differs from its subject path`);
		if(!Number.isSafeInteger(subject.bytes) || subject.bytes < 0) fail("release-archive-subject-drift", `${label} archive byte length is invalid`);
		digest(subject.sha256, `${label} archive subject sha256`);
		if(previous !== null && subject.path.localeCompare(previous) <= 0) fail("release-archive-subject-drift", `${label} archive subjects are not uniquely sorted`);
		if(statementSubjects.get(subject.path) !== subject.sha256) fail("release-archive-subject-drift", `${label} archive subject differs from its in-toto subject`);
		previous = subject.path;
	}
	if(canonicalJson(values) !== canonicalJson(expected)) fail("release-archive-subject-drift", `${label} archive subjects differ from package targets`);
	return values;
};

const receiptHashPath = path => join(dirname(path), `${basename(path, ".json")}.sha256`);

/**
 * Verifies one local archive against both signed release decisions and a separately trusted signer-policy identity.
 *
 * @param root0 - Paths and expected identities supplied by a clean consumer.
 * @param root0.archivePath - Downloaded archive whose exact bytes are checked.
 * @param root0.receiptPath - Adjacent signed release receipt.
 * @param root0.policyPath - Public signer policy received with the release handoff.
 * @param root0.trustedPolicySha256 - Policy identity obtained through a separate trusted channel.
 * @param root0.subjectPath - Exact signed release-relative archive path.
 * @param root0.coordinate - Expected ecosystem package coordinate.
 */
export const verifyReleaseArchive = async ({
	archivePath
	, receiptPath
	, policyPath
	, trustedPolicySha256
	, subjectPath
	, coordinate
}) => {
	digest(trustedPolicySha256, "trusted policy identity");
	portablePath(subjectPath, "archive subject path");
	string(coordinate, "expected coordinate");
	const [policyDocument, receiptDocument] = await Promise.all([
		readCanonicalJson(resolve(policyPath), "signer policy")
		, readCanonicalJson(resolve(receiptPath), "release receipt")
	]);
	const policySha256 = sha256(policyDocument.source);
	if(policySha256 !== trustedPolicySha256) fail("release-signer-policy-untrusted", "Adjacent signer policy differs from the separately trusted policy identity");
	const keys = policyRecord(policyDocument.value);
	const receipt = receiptDocument.value;
	exactKeys(receipt, [
		"schemaVersion"
		, "predicateType"
		, "publicationAuthorization"
		, "statement"
		, "statementSha256"
		, "envelope"
		, "envelopeSha256"
		, "audit"
	], "release receipt");
	if(receipt.schemaVersion !== 1 || receipt.predicateType !== documentType) fail("invalid-release-receipt", "Release receipt version or type is unsupported");
	const receiptIdentity = sha256(receiptDocument.source);
	const hashLine = await readFile(receiptHashPath(resolve(receiptPath)), "utf8");
	if(hashLine !== `${receiptIdentity}  ${basename(receiptPath)}\n`) fail("release-receipt-hash-drift", "Release receipt hash record differs from its exact bytes");
	digest(receipt.statementSha256, "receipt statement identity");
	digest(receipt.envelopeSha256, "receipt envelope identity");
	const signedReceipt = verifyEnvelope({
		envelope: receipt.envelope
		, keys
		, threshold: policyDocument.value.threshold
		, predicateType: receiptPredicate
		, label: "release receipt"
	});
	if(
		signedReceipt.statementSha256 !== receipt.statementSha256
		|| signedReceipt.envelopeSha256 !== receipt.envelopeSha256
		|| canonicalJson(signedReceipt.statement) !== canonicalJson(receipt.statement)
	) fail("release-receipt-envelope-drift", "Release receipt statement differs from its signed envelope");
	exactKeys(receipt.publicationAuthorization, ["statementSha256", "envelopeSha256", "envelope"], "publication authorization");
	const signedPublication = verifyEnvelope({
		envelope: receipt.publicationAuthorization.envelope
		, keys
		, threshold: policyDocument.value.threshold
		, predicateType: publicationPredicate
		, label: "publication authorization"
	});
	if(
		signedPublication.statementSha256 !== receipt.publicationAuthorization.statementSha256
		|| signedPublication.envelopeSha256 !== receipt.publicationAuthorization.envelopeSha256
	) fail("release-publication-envelope-drift", "Publication authorization identity differs from its signed envelope");
	if(
		signedPublication.statement.predicate?.signerPolicy?.sha256 !== policySha256
		|| signedReceipt.statement.predicate?.signerPolicy?.sha256 !== policySha256
		|| signedReceipt.statement.predicate?.publicationAuthorization?.statementSha256 !== signedPublication.statementSha256
		|| signedReceipt.statement.predicate?.publicationAuthorization?.envelopeSha256 !== signedPublication.envelopeSha256
		|| receipt.audit?.policySha256 !== policySha256
	) fail("release-signer-policy-drift", "Signed release decisions do not identify the trusted signer policy and each other");
	const publicationArchives = archiveSubjects({
		statement: signedPublication.statement
		, targetPath: statement => statement.predicate?.publication?.targets
		, label: "publication authorization"
	});
	const receiptArchives = archiveSubjects({
		statement: signedReceipt.statement
		, targetPath: statement => statement.predicate?.registryTransaction?.targets
		, label: "release receipt"
	});
	if(canonicalJson(publicationArchives) !== canonicalJson(receiptArchives)) fail("release-archive-subject-drift", "Pre-publication and post-publication archive subjects differ");
	const matches = receiptArchives.filter(subject => subject.path === subjectPath && subject.coordinate === coordinate);
	if(matches.length !== 1) fail("release-archive-subject-missing", "Receipt does not contain one archive subject for the expected path and coordinate");
	const subject = matches[0];
	const resolvedArchive = resolve(archivePath);
	if(basename(resolvedArchive) !== subject.filename) fail("release-archive-filename-drift", "Downloaded archive filename differs from the signed filename");
	const [archiveBytes, archiveFacts] = await Promise.all([readFile(resolvedArchive), stat(resolvedArchive)]);
	if(!archiveFacts.isFile()) fail("release-archive-not-file", "Downloaded archive is not a regular file");
	const archiveSha256 = sha256(archiveBytes);
	if(archiveBytes.length !== subject.bytes || archiveSha256 !== subject.sha256)
	{
		fail("release-archive-bytes-drift", "Downloaded archive bytes differ from the signed release subject");
	}
	return Object.freeze({
		verified: true
		, ecosystem: subject.ecosystem
		, coordinate: subject.coordinate
		, operation: subject.operation
		, kind: subject.kind
		, subjectPath: subject.path
		, filename: subject.filename
		, bytes: subject.bytes
		, sha256: subject.sha256
		, receiptSha256: receiptIdentity
		, signerPolicySha256: policySha256
		, publicationSignatures: signedPublication.validSignatures
		, receiptSignatures: signedReceipt.validSignatures
	});
};

const parseOptions = argv => {
	const allowed = new Set(["--archive", "--receipt", "--policy", "--policy-sha256", "--subject", "--coordinate"]);
	const options = new Map();
	for(let index = 0; index < argv.length; index += 2)
	{
		const name = argv[index];
		const value = argv[index + 1];
		if(!allowed.has(name) || value === undefined || options.has(name)) fail("invalid-release-verifier-option", `Invalid option ${name ?? ""}`);
		options.set(name, value);
	}
	for(const name of allowed)
	{
		if(!options.has(name)) fail("missing-release-verifier-option", `${name} is required`);
	}
	return options;
};

/**
 * Runs the repository-free release archive verifier command.
 *
 * @param argv - Command-line arguments excluding the Node executable and script path.
 */
export const runReleaseArchiveVerifierCli = async argv => {
	const options = parseOptions(argv);
	return verifyReleaseArchive({
		archivePath: options.get("--archive")
		, receiptPath: options.get("--receipt")
		, policyPath: options.get("--policy")
		, trustedPolicySha256: options.get("--policy-sha256")
		, subjectPath: options.get("--subject")
		, coordinate: options.get("--coordinate")
	});
};

if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
{
	try
	{
		const result = await runReleaseArchiveVerifierCli(process.argv.slice(2));
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} catch(error)
	{
		process.stderr.write(`${JSON.stringify({
			verified: false
			, code: error.code ?? "release-archive-verification-failed"
			, message: error.message
		}, null, 2)}\n`);
		process.exitCode = 1;
	}
}
