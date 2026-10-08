/**
 * Reviewed npm snapshot verification and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSubtypeHarnessSource } from "./reviewed-subtype-harness-source-history.mjs";
import { beforeReviewedNpmSnapshotSource, reviewedNpmSnapshotChangedPaths, reviewedNpmSnapshotHistoryPath, reverseReviewedNpmSnapshotUpdate } from "./reviewed-npm-snapshot-source-history.mjs";

test("Reviewed npm snapshot verification authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedNpmSnapshotHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "4ec025a6e5458db69cf75855bcf5d039e416850b");
	assert.deepEqual(record.updates.map(update => update.path), reviewedNpmSnapshotChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedSubtypeHarnessSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedNpmSnapshotUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedNpmSnapshotSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedNpmSnapshotSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedNpmSnapshotSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedNpmSnapshotUpdate(changed, update));
		assert.throws(() => reverseReviewedNpmSnapshotUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
