/**
 * Reviewed callback harness and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSpecializationArchiveSource } from "./reviewed-specialization-archive-source-history.mjs";
import { beforeReviewedCallbackHarnessSource, reviewedCallbackHarnessChangedPaths, reviewedCallbackHarnessHistoryPath, reverseReviewedCallbackHarnessUpdate } from "./reviewed-callback-harness-source-history.mjs";

test("Reviewed callback harness authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedCallbackHarnessHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "44f38ab9458aaff322f6925c221a8ef2fc4e4969");
	assert.deepEqual(record.updates.map(update => update.path), reviewedCallbackHarnessChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedSpecializationArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedCallbackHarnessUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedCallbackHarnessSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedCallbackHarnessSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedCallbackHarnessSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedCallbackHarnessUpdate(changed, update));
		assert.throws(() => reverseReviewedCallbackHarnessUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
