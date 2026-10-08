/**
 * Subtype XS archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeSubtypeXsArchiveSource, subtypeXsArchiveChangedPaths, subtypeXsArchiveHistoryPath, reverseSubtypeXsArchiveUpdate } from "./subtype-xs-archive-source-history.mjs";

test("Subtype XS archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(subtypeXsArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "18ad14bb574c1e434fd6d2e2810885ead34007e6");
	assert.deepEqual(record.updates.map(update => update.path), subtypeXsArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseSubtypeXsArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeSubtypeXsArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeSubtypeXsArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeSubtypeXsArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseSubtypeXsArchiveUpdate(changed, update));
		assert.throws(() => reverseSubtypeXsArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
