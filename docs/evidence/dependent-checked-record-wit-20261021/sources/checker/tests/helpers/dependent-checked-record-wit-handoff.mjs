/**
 * Authenticate every member of the complete original dependent checked-record checked-record WIT archive in memory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";
import { dependentCheckedRecordWitComponent, dependentCheckedRecordWitDirectory } from "./dependent-checked-record-wit-package.mjs";

export const dependentCheckedRecordWitComponentRecord = `package/${dependentCheckedRecordWitComponent}`;

/**
 * Return the original component supplement only after complete archive authentication.
 *
 * @param read - Selection-relative original handoff and record reader.
 */
export const inspectDependentCheckedRecordWitHandoff = async read => {
	const bytes = await read("handoff/package-set-receipt.json"), receipt = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), `${sha256(bytes)}  package-set-receipt.json\n`);
	assert.equal(receipt.packages.length, 1);
	const pkg = receipt.packages[0]; assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.role, "component");
	assert.equal(pkg.artifacts.length, 1); const artifact = pkg.artifacts[0];
	assert.equal(artifact.path, `archives/${dependentCheckedRecordWitDirectory}.tar.gz`);
	const archivePath = "handoff/" + artifact.path, archive = await read(archivePath);
	assert.equal(archive.length, artifact.bytes); assert.equal(sha256(archive), artifact.sha256);
	const members = readOwnedPerlCallbackVariantTar(archive, dependentCheckedRecordWitDirectory), packaged = JSON.parse(await read("package.json"));
	assert.deepEqual(Object.fromEntries([...members].map(([path, value]) => [path, { bytes: value.length, sha256: sha256(value) }])), packaged.files);
	for(const path of packaged.retained) assert.equal(sha256(await read("package/" + path)), sha256(members.get(path)), path);
	return { archiveSha256: artifact.sha256, archivePath
		, supplements: new Map([[dependentCheckedRecordWitComponentRecord, Buffer.from(members.get(dependentCheckedRecordWitComponent))]]) };
};
