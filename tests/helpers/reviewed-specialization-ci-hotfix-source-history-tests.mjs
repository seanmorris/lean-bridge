/**
 * Reviewed-specialization CI hotfix and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNativeFinCallbackAdmissionSource } from "./native-fin-callback-admission-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSpecializationCiHotfixSource, reviewedSpecializationCiHotfixChangedPaths, reviewedSpecializationCiHotfixHistoryPath, reverseReviewedSpecializationCiHotfixUpdate } from "./reviewed-specialization-ci-hotfix-source-history.mjs";

test("Reviewed-specialization CI hotfix authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSpecializationCiHotfixHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "7021df4bfa6f7d6c99f5c8eb5a7a39099f5d69a7");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSpecializationCiHotfixChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinCallbackAdmissionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedSpecializationCiHotfixUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSpecializationCiHotfixSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSpecializationCiHotfixSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSpecializationCiHotfixSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSpecializationCiHotfixUpdate(changed, update));
		assert.throws(() => reverseReviewedSpecializationCiHotfixUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
