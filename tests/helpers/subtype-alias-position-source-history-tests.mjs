/**
 * Subtype alias position and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeSubtypeAliasPositionSource, subtypeAliasPositionChangedPaths, subtypeAliasPositionHistoryPath, reverseSubtypeAliasPositionUpdate } from "./subtype-alias-position-source-history.mjs";

test("Subtype alias position authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(subtypeAliasPositionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "511472c67a2aad48d23de79879aa01fa808c5f40");
	assert.deepEqual(record.updates.map(update => update.path), subtypeAliasPositionChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseSubtypeAliasPositionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeSubtypeAliasPositionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeSubtypeAliasPositionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeSubtypeAliasPositionSource(update.path, changed), changed);
		assert.throws(() => reverseSubtypeAliasPositionUpdate(changed, update));
		assert.throws(() => reverseSubtypeAliasPositionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
