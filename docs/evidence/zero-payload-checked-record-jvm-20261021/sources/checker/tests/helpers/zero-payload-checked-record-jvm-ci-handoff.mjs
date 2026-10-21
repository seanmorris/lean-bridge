/**
 * Supplement retained zero-payload JVM records from the authenticated Maven
 * JAR without trusting an extracted package directory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";
import {
	inspectZeroPayloadJvmPackage
} from "./zero-payload-checked-record-jvm-package.mjs";
import {
	zeroPayloadJvmRetainedMembers
} from "./zero-payload-checked-record-jvm-report.mjs";

export const zeroPayloadJvmArchivePath
	= "handoff/archives/zeropayloadcheckedrecords-1.0.0.jar";

/**
 * Authenticate the handoff and return a reader supplemented by JAR members.
 *
 * @param read - Selection-relative original byte reader.
 * @param options - Explicit package floor and route.
 * @param options.floor - Required glibc floor.
 * @param options.route - Exact author/API route.
 */
export const inspectZeroPayloadJvmCiHandoff = async (
	read, { floor, route }
) => {
	const report = JSON.parse(await read("report.json"));
	const receiptBytes = await read("handoff/package-set-receipt.json");
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.deepEqual(receipt, report.receipt);
	assert.equal((await read(
		"handoff/package-set-receipt.json.sha256"
	)).toString(), `${sha256(receiptBytes)}  package-set-receipt.json\n`);
	assert.equal(receipt.packages.length, 1);
	const pkg = receipt.packages[0], path = zeroPayloadJvmArchivePath;
	const bytes = await read(path);
	const model = JSON.parse(await read("build-0/model.json"));
	const compiled = JSON.parse(await read("build-0/native-jvm.json"));
	const inspection = inspectZeroPayloadJvmPackage(bytes, {
		pkg, model, compiled, floor, route
	});
	assert.deepEqual(JSON.parse(await read("installation.json")), inspection);
	const members = readClosedPackageZip(bytes);
	const supplement = new Map(zeroPayloadJvmRetainedMembers(
		inspection.receipt).map(member => ["package/" + member
		, members.get(member)]));
	return {
		archiveSha256: sha256(bytes), archivePath: path
		, read: async member => supplement.has(member)
			? supplement.get(member) : read(member)
	};
};
