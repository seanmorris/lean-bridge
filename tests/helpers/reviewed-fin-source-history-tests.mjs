/**
 * Authenticate semantic comparison changes without rewriting installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedFinSource, reviewedFinChangedPaths
	, reviewedFinHistoryPath, reverseReviewedFinUpdate } from "./reviewed-fin-source-history.mjs";

test("reviewed Fin history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(reviewedFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "bc63c615a69c888b4bdad43d3d06387172d497e2");
	assert.deepEqual(record.updates.map(item => item.path), reviewedFinChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeReviewedFinSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedFinUpdate(changed, update));
		assert.throws(() => reverseReviewedFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("reviewed Fin admission adds no support claims or rewritten archived observations", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedFinSource(path, source));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [index, entry] of previous.evidence.entries())
	{
		const now = current.evidence[index];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [position, file] of entry.files.entries())
		{
			if(now.files[position].sha256 === file.sha256) continue;
			assert.ok(reviewedFinChangedPaths.includes(file.path));
			const bytes = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeReviewedFinSource(file.path, bytes)));
			assert.equal(now.files[position].sha256, sha256(bytes));
			refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
