/**
 * Supply the pinned upstream dependency to offline Composer test consumers.
 *
 * @file
 */
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { brickMathSources, bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Stage authentic dependency files as a local registry distribution.
 *
 * @param root - Test-owned dependency feed directory.
 */
export const brickMathRepository = async root => {
	const files = brickMathSources(), directory = join(root, "brick-math");
	for(const [path, bytes] of Object.entries(files)) await saveLakeFile(directory, path, bytes);
	const bytes = await createDeterministicZip({ directory, sourceDateEpoch: 315532800 });
	const archive = "brick-math-1.0.0.zip";
	await saveLakeFile(root, archive, bytes);
	return { type: "package"
		, package: { ...JSON.parse(files["composer.json"]), version: "1.0.0"
			, dist: { type: "zip", url: pathToFileURL(join(root, archive)).href, shasum: createHash("sha1").update(bytes).digest("hex") } } };
};

/** Mount the exact upstream dependency in isolated, unpackaged Zend tests. */
export const brickMathMountSource = () => `{
const directories = new Set();
for (const [path, bytes] of Object.entries(${JSON.stringify(bundledBrickMath())})) {
  const parts = path.split('/'); parts.pop(); let current = '';
  for (const part of parts) { current += '/' + part; if (!directories.has(current)) { await php.mkdir(current); directories.add(current); } }
  await php.writeFile('/' + path, bytes);
}
if (await php.run("<?php require '/dependencies/brick-math/autoload.php';") !== 0) throw new Error('Brick Math bootstrap failed');
}`;

/**
 * Bind both lock records and deployed files to the pinned dependency sources.
 *
 * @param composer - Captured Composer manifest, lock and installed metadata.
 * @param deployment - Hash inventory of the relocated consumer deployment.
 */
export const validateBrickMathInstall = (composer, deployment) => {
	const files = brickMathSources(), repository = composer.manifest.repositories[1];
	assert.equal(repository.type, "package");
	const { dist, ...metadata } = repository.package;
	assert.deepEqual(metadata, { ...JSON.parse(files["composer.json"]), version: "1.0.0" });
	assert.equal(dist.type, "zip"); assert.match(dist.url, /^file:\/\/\/.+\/feed\/brick-math-1\.0\.0\.zip$/);
	assert.match(dist.shasum, /^[a-f0-9]{40}$/);
	for(const list of [composer.lock.packages, composer.installed.packages])
	{
		assert.equal(list.filter(pkg => pkg.name === "brick/math").length, 1);
		const pkg = list.find(pkg => pkg.name === "brick/math");
		assert.equal(pkg.version, "1.0.0"); assert.deepEqual(pkg.dist, dist);
		assert.deepEqual(pkg.require, { php: "^8.2" }); assert.deepEqual(pkg.autoload, metadata.autoload);
	}
	const prefix = "vendor/brick/math/";
	assert.deepEqual(Object.keys(deployment).filter(path => path.startsWith(prefix)).sort(), Object.keys(files).map(path => prefix + path).sort());
	for(const [path, source] of Object.entries(files))
		assert.deepEqual(deployment[prefix + path], { bytes: Buffer.byteLength(source), sha256: sha256(source) });
};

/** Synthetic lock data for report-validator tests, never installed evidence. */
export const brickMathValidationFixture = () => {
	const files = brickMathSources();
	return { selected: { ...JSON.parse(files["composer.json"]), version: "1.0.0"
		, dist: { type: "zip", url: "file:///validator/project/feed/brick-math-1.0.0.zip", shasum: "a".repeat(40) } }
	, deployment: Object.fromEntries(Object.entries(files).map(([path, source]) => ["vendor/brick/math/" + path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])) };
};
