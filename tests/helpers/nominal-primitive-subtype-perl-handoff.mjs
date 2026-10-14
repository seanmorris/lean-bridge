/**
 * Bind retained Perl records to the complete original CPAN archives, member by member.
 * Archives are extracted with absolute tools into a fresh directory and removed afterwards.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

// Cache only member identities by complete archive digest. Every caller still supplies
// and hashes the complete archive bytes; report metadata alone cannot reuse a result.
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

const members = async (bytes, label) => {
	const digest = sha256(bytes);
	if(authenticated.has(digest)) return authenticated.get(digest);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-perl-handoff-"));
	try
	{
		const archive = join(directory, "archive.tar.gz"), extracted = join(directory, "extracted");
		await writeFile(archive, bytes); await mkdir(extracted);
		execFileSync("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive, "-C", extracted], { env: {}, stdio: "pipe" });
		const roots = await readdir(extracted); assert.equal(roots.length, 1, `${label}: one distribution root`);
		const root = join(extracted, roots[0]), files = new Map();
		for(const path of await nativeArtifactPaths(root)) files.set(path, sha256(await readFile(join(root, path))));
		const manifest = JSON.parse(await readFile(join(root, "lean-bridge-package.json"), "utf8"));
		authenticated.set(digest, { root: roots[0], files, manifest });
		return authenticated.get(digest);
	}
	finally
	{ await rm(directory, { recursive: true, force: true }); }
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
		const archive = await members(bytes, artifact.path);
		assert.equal(archive.root, `${pkg.name}-${pkg.version}`);
		assert.deepEqual([...archive.files.keys()].sort(), [...Object.keys(manifest.files), "lean-bridge-package.json"].sort(), `${artifact.path} members`);
		for(const [path, digest] of Object.entries(manifest.files)) assert.equal(archive.files.get(path), digest, `${artifact.path}: ${path}`);
		assert.deepEqual(archive.manifest, manifest, `${artifact.path}: prepared manifest`);
		archives[artifact.path] = { role: pkg.role, sha256: artifact.sha256, members: archive.files.size };
	}
	return { archives, records: paths.length };
};
