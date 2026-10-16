/**
 * Bind retained Python records to the complete original wheel without extracting files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";

// Cache only derived member identities. Every caller must still supply and hash
// the complete archive; matching report metadata alone cannot reuse this result.
let authenticated;

/**
 * Enumerate original handoff records only after validating the archive descriptor.
 *
 * @param wheel - Independently checked wheel inventory.
 */
export const nestedCheckedRecordPythonHandoffRecords = wheel => {
	const artifact = wheel.archive;
	assert.deepEqual(Object.keys(artifact).sort(), ["bytes", "path", "sha256"]);
	assert.match(artifact.path, /^archives\/nestedcheckedrecords-1\.0\.0-py3-none-manylinux_2_[0-9]+_x86_64\.whl$/u);
	assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
	assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	return ["package-set-receipt.json", "package-set-receipt.json.sha256", artifact.path].map(path => "handoff/" + path);
};

/**
 * Match the original receipt, sidecar, archive and every native or text member.
 *
 * @param read - Reader of selection-relative original bytes.
 * @param options - Independently checked compiler receipt and wheel inventory.
 * @param options.receipt - Reproduced package-set receipt.
 * @param options.wheel - Original wheel inspection record.
 */
export const checkNestedCheckedRecordPythonHandoff = async (read, { receipt, wheel }) => {
	validatePackageSetReceipt(receipt);
	const paths = nestedCheckedRecordPythonHandoffRecords(wheel);
	assert.equal(receipt.packages.length, 1);
	assert.equal(receipt.packages[0].target, "pypi");
	assert.deepEqual(receipt.packages[0].artifacts, [wheel.archive]);
	const receiptBytes = await read(paths[0]);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal((await read(paths[1])).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	const archive = await read(paths[2]);
	const archiveSha256 = sha256(archive);
	assert.equal(archive.length, wheel.archive.bytes); assert.equal(archiveSha256, wheel.archive.sha256);
	if(authenticated?.sha256 !== archiveSha256)
	{
		const members = readClosedPackageZip(archive);
		authenticated = { sha256: archiveSha256, files: new Map([...members].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])) };
	}
	const members = authenticated.files;
	assert.deepEqual([...members.keys()].sort(), Object.keys(wheel.files).sort());
	assert.equal(new Set(wheel.retained).size, wheel.retained.length);
	for(const [path, identity] of members)
		assert.deepEqual(wheel.files[path], identity, path);
	for(const path of wheel.retained)
	{
		assert.ok(members.has(path), path);
		const bytes = await read("package/" + path);
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, members.get(path), path);
	}
	return { archivePath: paths[2], archiveSha256, members: members.size };
};
