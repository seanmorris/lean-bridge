/**
 * Reviewed generic instantiation and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeBrowserCallbackArchiveSource } from "./browser-callback-archive-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedInstantiationSource, reviewedInstantiationChangedPaths, reviewedInstantiationHistoryPath, reverseReviewedInstantiationUpdate } from "./reviewed-instantiation-source-history.mjs";

test("Reviewed generic instantiation authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedInstantiationHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "377f1646edb70f59066feeccbfad443a700358b5");
	assert.deepEqual(record.updates.map(update => update.path), reviewedInstantiationChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeBrowserCallbackArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedInstantiationUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedInstantiationSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedInstantiationSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedInstantiationSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedInstantiationUpdate(changed, update));
		assert.throws(() => reverseReviewedInstantiationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
