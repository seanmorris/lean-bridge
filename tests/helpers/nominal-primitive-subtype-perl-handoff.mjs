/**
 * Bind retained Perl records to the complete original CPAN archives, member by member, in memory.
 * Nothing is extracted: the strict ustar reader validates every header and name before any member byte
 * is compared with the retained manifests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { readClosedPackageTarGz } from "./closed-package-tar.mjs";

// Cache only member identities by complete archive digest. Every caller still supplies and
// hashes the complete archive bytes; report metadata alone cannot reuse a result.
const authenticated = new Map();

/**
 * Enumerate original handoff records only after validating the receipt's artifact descriptors.
 *
 * @param receipt - Independently checked package-set receipt.
 */
export const nominalPrimitiveSubtypePerlHandoffRecords = receipt => {
	validatePackageSetReceipt(receipt);
	assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]).sort(), [["cpan", "component"], ["cpan", "runtime"]]);
	const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
	assert.equal(artifacts.length, 2);
	for(const artifact of artifacts)
	{
		assert.deepEqual(Object.keys(artifact).sort(), ["bytes", "path", "sha256"]);
		assert.match(artifact.path, /^archives\/LeanBridge-[A-Za-z0-9]+-[0-9.]+\.tar\.gz$/u);
		assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
		assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.equal(new Set(artifacts.map(artifact => artifact.path)).size, 2);
	return ["package-set-receipt.json", "package-set-receipt.json.sha256", ...artifacts.map(artifact => artifact.path)].map(path => "handoff/" + path);
};

/**
 * Read one complete archive's member digests and its canonical prepared manifest, in memory.
 * Semantically equal but noncanonical manifest bytes are refused before anything is cached.
 *
 * @param bytes - Complete original archive bytes.
 * @param root - Required single top-level distribution directory.
 */
export const nominalPrimitiveSubtypePerlArchiveMembers = (bytes, root) => {
	const key = `${sha256(bytes)}:${root}`;
	if(!authenticated.has(key))
	{
		const files = new Map(), entries = readClosedPackageTarGz(bytes, { root });
		for(const [path, member] of entries) files.set(path, sha256(member));
		const manifestBytes = entries.get("lean-bridge-package.json");
		assert.ok(manifestBytes, "prepared CPAN manifest member");
		const manifest = JSON.parse(manifestBytes.toString("utf8"));
		assert.equal(manifestBytes.toString("utf8"), canonicalJson(manifest), "canonical prepared CPAN manifest member");
		authenticated.set(key, { files, manifest });
	}
	return authenticated.get(key);
};

/**
 * Match the original receipt, sidecar, both archives and every member against the retained manifests.
 *
 * @param read - Reader of selection-relative original bytes.
 * @param options - Independently checked compiler receipt and retained prepared manifests.
 * @param options.receipt - Reproduced package-set receipt.
 * @param options.manifests - Retained runtime and component manifests by role.
 */
export const checkNominalPrimitiveSubtypePerlHandoff = async (read, { receipt, manifests }) => {
	const paths = nominalPrimitiveSubtypePerlHandoffRecords(receipt);
	const receiptBytes = await read(paths[0]);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal((await read(paths[1])).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const archives = {};
	for(const pkg of receipt.packages)
	{
		const artifact = pkg.artifacts[0], manifest = manifests[pkg.role];
		assert.ok(manifest && typeof manifest === "object", pkg.role);
		const bytes = await read("handoff/" + artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		const archive = nominalPrimitiveSubtypePerlArchiveMembers(bytes, `${pkg.name}-${pkg.version}`);
		assert.deepEqual([...archive.files.keys()].sort(), [...Object.keys(manifest.files), "lean-bridge-package.json"].sort(), `${artifact.path} members`);
		for(const [path, digest] of Object.entries(manifest.files)) assert.equal(archive.files.get(path), digest, `${artifact.path}: ${path}`);
		assert.deepEqual(archive.manifest, manifest, `${artifact.path}: prepared manifest`);
		archives[artifact.path] = { role: pkg.role, sha256: artifact.sha256, members: archive.files.size };
	}
	return { archives, records: paths.length };
};
