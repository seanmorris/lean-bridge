/**
 * Reviewed Subtype admission and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCallbackCodeCiRepairSource } from "./callback-code-ci-repair-source-history.mjs";
import { beforeReviewedSubtypeAdmissionSource, reviewedSubtypeAdmissionChangedPaths, reviewedSubtypeAdmissionHistoryPath, reverseReviewedSubtypeAdmissionUpdate } from "./reviewed-subtype-admission-source-history.mjs";

test("Reviewed Subtype admission authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSubtypeAdmissionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "0ffae00416df0a81a714571ad34acff898a4b5f9");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSubtypeAdmissionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCallbackCodeCiRepairSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedSubtypeAdmissionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSubtypeAdmissionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSubtypeAdmissionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSubtypeAdmissionSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSubtypeAdmissionUpdate(changed, update));
		assert.throws(() => reverseReviewedSubtypeAdmissionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
