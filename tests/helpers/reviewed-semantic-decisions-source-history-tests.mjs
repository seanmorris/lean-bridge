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
import { beforeReviewedSemanticDecisionsSource, reviewedSemanticDecisionsChangedPaths
	, reviewedSemanticDecisionsHistoryPath, reverseReviewedSemanticDecisionsUpdate } from "./reviewed-semantic-decisions-source-history.mjs";

test("reviewed semantic decisions history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(reviewedSemanticDecisionsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "1757a65eb0c1f5b0dc67e5b00dc1a1e913421a8e");
	assert.deepEqual(record.updates.map(item => item.path), reviewedSemanticDecisionsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedSemanticDecisionsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSemanticDecisionsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSemanticDecisionsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeReviewedSemanticDecisionsSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSemanticDecisionsUpdate(changed, update));
		assert.throws(() => reverseReviewedSemanticDecisionsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("semantic comparison adds no support claims or rewritten archived observations", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedSemanticDecisionsSource(path, source));
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
			assert.ok(reviewedSemanticDecisionsChangedPaths.includes(file.path));
			const bytes = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeReviewedSemanticDecisionsSource(file.path, bytes)));
			assert.equal(now.files[position].sha256, sha256(bytes));
			refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
