/**
 * Preserve installed receipts across explicit test and provenance-file changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Check unchanged sources or the explicit lineage for an administrative update.
 *
 * @param name - Historical receipt name, without the extension.
 * @param path - Source path recorded in that receipt.
 * @param previousSha256 - Original immutable source hash.
 */
export const assertRecursiveSourceHistory = async (name, path, previousSha256) => {
	const currentSha256 = sha256(await readFile(path));
	if(currentSha256 === previousSha256) return;
	const evidence = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
	const record = evidence.historicalReceipts[name];
	assert.ok(record, `Missing historical receipt lineage: ${name}`);
	const bytes = await readFile(`docs/evidence/${name}.json`);
	assert.equal(sha256(bytes), record.receiptSha256, `Historical receipt changed: ${name}`);
	const original = JSON.parse(bytes);
	assert.equal(original.sourceHashes[path] ?? original.generatorSourceHashes?.[path], previousSha256);
	assert.deepEqual(record.sources[path], { previousSha256, currentSha256 }, path);
	if(["src/release/native-maven.mjs", "src/release/native-wasi.mjs"].includes(path))
		assert.equal(sha256((await readFile(path, "utf8")).replace('"allocation-guard.h", ', "")), previousSha256, "Only the extra provenance header may differ from this historical packager");
};
