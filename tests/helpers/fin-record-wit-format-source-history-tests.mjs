/**
 * Fin record WIT formatting and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinRecordWitFormatSource, finRecordWitFormatChangedPaths, finRecordWitFormatHistoryPath, reverseFinRecordWitFormatUpdate } from "./fin-record-wit-format-source-history.mjs";

test("Fin record WIT formatting authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finRecordWitFormatHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "190970165431b3c25e91c6186e47beef2409e014");
	assert.deepEqual(record.updates.map(update => update.path), finRecordWitFormatChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseFinRecordWitFormatUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinRecordWitFormatSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinRecordWitFormatSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinRecordWitFormatSource(update.path, changed), changed);
		assert.throws(() => reverseFinRecordWitFormatUpdate(changed, update));
		assert.throws(() => reverseFinRecordWitFormatUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
