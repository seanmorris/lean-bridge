/**
 * Subtype fixture link repair and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeInheritedRecordsSource } from "./inherited-records-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeSubtypeFixtureLinkSource, subtypeFixtureLinkChangedPaths, subtypeFixtureLinkHistoryPath, reverseSubtypeFixtureLinkUpdate } from "./subtype-fixture-link-source-history.mjs";

test("Subtype fixture link repair authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(subtypeFixtureLinkHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "4249bde5421e82bd7ad1beb24d11a51dad65b4a2");
	assert.deepEqual(record.updates.map(update => update.path), subtypeFixtureLinkChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeInheritedRecordsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseSubtypeFixtureLinkUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeSubtypeFixtureLinkSource(update.path, source)), update.previousSha256);
		assert.equal(beforeSubtypeFixtureLinkSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeSubtypeFixtureLinkSource(update.path, changed), changed);
		assert.throws(() => reverseSubtypeFixtureLinkUpdate(changed, update));
		assert.throws(() => reverseSubtypeFixtureLinkUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
