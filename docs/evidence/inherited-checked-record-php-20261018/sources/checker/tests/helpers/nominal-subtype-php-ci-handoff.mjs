/**
 * Authenticate the complete original Composer ZIP and all retained member bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inspectFinContainerEdgePhpArchive } from "./fin-container-edge-php-closure.mjs";

/**
 * Compare every archived native and non-native member with the installed record.
 *
 * @param read - Selection-relative original handoff and record reader.
 */
export const inspectNominalSubtypePhpCiHandoff = async read => {
	const receiptBytes = await read("handoff/package-set-receipt.json"), receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	assert.equal(receipt.packages.length, 1);
	const pkg = receipt.packages[0]; assert.equal(pkg.target, "php-native"); assert.equal(pkg.role, "component");
	assert.equal(pkg.artifacts.length, 1);
	const artifact = pkg.artifacts[0];
	assert.match(artifact.path, /^archives\/[A-Za-z0-9_.-]+\.zip$/u);
	const archivePath = "handoff/" + artifact.path, bytes = await read(archivePath);
	assert.equal(bytes.length, artifact.bytes);
	const { members } = inspectFinContainerEdgePhpArchive(bytes, artifact.sha256);
	const packaged = JSON.parse(await read("package.json"));
	assert.deepEqual(Object.fromEntries([...members].map(([path, value]) => [path, { bytes: value.length, sha256: sha256(value) }])), packaged.files);
	for(const path of packaged.retained) assert.deepEqual(await read("package/" + path), members.get(path), path);
	return { archiveSha256: sha256(bytes), archivePath };
};
