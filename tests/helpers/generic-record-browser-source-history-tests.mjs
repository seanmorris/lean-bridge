/**
 * Browser generic-record acceptance and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeReviewedSpecializationAdmissionSource } from "./reviewed-specialization-admission-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeGenericRecordBrowserSource, genericRecordBrowserChangedPaths, genericRecordBrowserHistoryPath, reverseGenericRecordBrowserUpdate } from "./generic-record-browser-source-history.mjs";

test("Browser generic-record acceptance authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(genericRecordBrowserHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "176d33655074558a34e203890917e145a2e1ada9");
	assert.deepEqual(record.updates.map(update => update.path), genericRecordBrowserChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedSpecializationAdmissionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseGenericRecordBrowserUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeGenericRecordBrowserSource(update.path, source)), update.previousSha256);
		assert.equal(beforeGenericRecordBrowserSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeGenericRecordBrowserSource(update.path, changed), changed);
		assert.throws(() => reverseGenericRecordBrowserUpdate(changed, update));
		assert.throws(() => reverseGenericRecordBrowserUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
