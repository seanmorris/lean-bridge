/**
 * Reviewed callback Fin admission and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedCallbackFinAdmissionSource, reviewedCallbackFinAdmissionChangedPaths, reviewedCallbackFinAdmissionHistoryPath, reverseReviewedCallbackFinAdmissionUpdate } from "./reviewed-callback-fin-admission-source-history.mjs";

test("Reviewed callback Fin admission authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedCallbackFinAdmissionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "68eb49af0bdb0841f0795799d63df813908a0a8d");
	assert.deepEqual(record.updates.map(update => update.path), reviewedCallbackFinAdmissionChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedCallbackFinAdmissionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedCallbackFinAdmissionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedCallbackFinAdmissionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedCallbackFinAdmissionSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedCallbackFinAdmissionUpdate(changed, update));
		assert.throws(() => reverseReviewedCallbackFinAdmissionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
