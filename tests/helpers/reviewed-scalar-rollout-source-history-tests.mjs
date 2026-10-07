/**
 * Core regression repairs preserve historical receipts and support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinProductsCiSource } from "./fin-products-ci-source-history.mjs";
import { beforeReviewedScalarRolloutSource, reviewedScalarRolloutChangedPaths, reviewedScalarRolloutHistoryPath, reverseReviewedScalarRolloutUpdate } from "./reviewed-scalar-rollout-source-history.mjs";

test("reviewed scalar rollout authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedScalarRolloutHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "433814ece25573132f7ad534022afa14d6083343");
	assert.deepEqual(record.updates.map(update => update.path), reviewedScalarRolloutChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinProductsCiSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedScalarRolloutUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedScalarRolloutSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedScalarRolloutSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedScalarRolloutSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedScalarRolloutUpdate(changed, update));
		assert.throws(() => reverseReviewedScalarRolloutUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("reviewed scalar rollout changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeFinProductsCiSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedScalarRolloutSource(path, source));
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
			assert.ok(reviewedScalarRolloutChangedPaths.includes(file.path));
			const bytes = beforeFinProductsCiSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeReviewedScalarRolloutSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});

