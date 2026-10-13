/**
 * Derive retained package records from the original closed Maven JAR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";
import { inspectNominalSubtypeJvmPackage } from "./nominal-subtype-jvm-package.mjs";
import { nominalSubtypeJvmRetainedMembers } from "./nominal-subtype-jvm-package-records.mjs";

/**
 * Authenticate original native and managed bytes before supplementing the reader.
 *
 * @param read - Selection-relative original handoff and record reader.
 * @param options - Explicit platform floor and package mode.
 * @param options.floor - Required native glibc floor.
 * @param options.mode - Full or result-only API.
 */
export const inspectNominalSubtypeJvmCiHandoff = async (read, { floor, mode }) => {
	const report = JSON.parse(await read("report.json"));
	const receiptBytes = await read("handoff/package-set-receipt.json"), receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(receipt, report.receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	assert.equal(receipt.packages.length, 1);
	const pkg = receipt.packages[0], path = "handoff/archives/nominalsubtypes-1.0.0.jar";
	const bytes = await read(path);
	const model = JSON.parse(await read("build-0/model.json"));
	const compiled = JSON.parse(await read("build-0/native-jvm.json"));
	const inspection = inspectNominalSubtypeJvmPackage(bytes, { pkg, model, compiled, floor, mode });
	assert.deepEqual(JSON.parse(await read("installation.json")), inspection);
	const members = readClosedPackageZip(bytes);
	const supplement = new Map(nominalSubtypeJvmRetainedMembers(inspection.receipt)
		.map(path => ["package/" + path, members.get(path)]));
	return { archiveSha256: sha256(bytes), archivePath: path
		, read: async path => supplement.has(path) ? supplement.get(path) : read(path) };
};
