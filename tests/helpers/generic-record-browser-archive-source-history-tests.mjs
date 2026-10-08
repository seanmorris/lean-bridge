/**
 * Browser generic-record archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeGenericRecordBrowserArchiveSource, genericRecordBrowserArchiveChangedPaths, genericRecordBrowserArchiveHistoryPath, reverseGenericRecordBrowserArchiveUpdate } from "./generic-record-browser-archive-source-history.mjs";

test("Browser generic-record archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(genericRecordBrowserArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "9baf9e6e3cd74bf8af7cecfd9687f13930a1aa20");
	assert.deepEqual(record.updates.map(update => update.path), genericRecordBrowserArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseGenericRecordBrowserArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeGenericRecordBrowserArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeGenericRecordBrowserArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeGenericRecordBrowserArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseGenericRecordBrowserArchiveUpdate(changed, update));
		assert.throws(() => reverseGenericRecordBrowserArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
