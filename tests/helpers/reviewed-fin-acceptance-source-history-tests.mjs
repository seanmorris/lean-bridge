/**
 * Reviewed Fin consumers, bounded CI setup and corrected Perl probes preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinRecordsSource } from "./native-fin-records-source-history.mjs";
import { beforeReviewedFinAcceptanceSource, reviewedFinAcceptanceChangedPaths, reviewedFinAcceptanceHistoryPath, reverseReviewedFinAcceptanceUpdate } from "./reviewed-fin-acceptance-source-history.mjs";

test("Reviewed Fin acceptance authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedFinAcceptanceHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "faac75b2b5ad0df25536c3e776ab1176e8731aed");
	assert.deepEqual(record.updates.map(update => update.path), reviewedFinAcceptanceChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinRecordsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedFinAcceptanceUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedFinAcceptanceSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedFinAcceptanceSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedFinAcceptanceSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedFinAcceptanceUpdate(changed, update));
		assert.throws(() => reverseReviewedFinAcceptanceUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Reviewed Fin acceptance changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeNativeFinRecordsSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedFinAcceptanceSource(path, source));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [index, entry] of previous.evidence.entries())
	{
		const now = current.evidence[index], strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [position, file] of entry.files.entries())
		{
			if(file.sha256 === now.files[position].sha256) continue;
			assert.ok(reviewedFinAcceptanceChangedPaths.includes(file.path));
			const bytes = beforeNativeFinRecordsSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeReviewedFinAcceptanceSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
