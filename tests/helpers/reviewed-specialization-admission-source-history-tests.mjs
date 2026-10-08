/**
 * Reviewed finite-specialization admission and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePhpWasmFinArchiveSource } from "./php-wasm-fin-archive-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSpecializationAdmissionSource, reviewedSpecializationAdmissionChangedPaths, reviewedSpecializationAdmissionHistoryPath, reverseReviewedSpecializationAdmissionUpdate } from "./reviewed-specialization-admission-source-history.mjs";

test("Reviewed finite-specialization admission authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSpecializationAdmissionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "a412a5a035c7569dd8e581364ba4deedd5a70c3d");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSpecializationAdmissionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePhpWasmFinArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedSpecializationAdmissionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSpecializationAdmissionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSpecializationAdmissionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSpecializationAdmissionSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSpecializationAdmissionUpdate(changed, update));
		assert.throws(() => reverseReviewedSpecializationAdmissionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
