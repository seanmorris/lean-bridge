/**
 * Authenticate the added host probes without rewriting past installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSemanticDecisionsSource } from "./reviewed-semantic-decisions-source-history.mjs";
import { beforeContainerHostDispatchSource, containerHostDispatchChangedPaths
	, containerHostDispatchHistoryPath, reverseContainerHostDispatchUpdate } from "./container-host-dispatch-source-history.mjs";

test("container dispatch history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(containerHostDispatchHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "aaadc43140c991a407ed8bd215e57ad0f8bcbf42");
	assert.deepEqual(record.updates.map(item => item.path), containerHostDispatchChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedSemanticDecisionsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseContainerHostDispatchUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeContainerHostDispatchSource(update.path, source)), update.previousSha256);
		assert.equal(beforeContainerHostDispatchSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeContainerHostDispatchSource(update.path, changed), changed);
		assert.throws(() => reverseContainerHostDispatchUpdate(changed, update));
		assert.throws(() => reverseContainerHostDispatchUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("container dispatch adds no support claims or rewritten archived observations", async () => {
	const path = "docs/type-surface.v1.json", source = beforeReviewedSemanticDecisionsSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeContainerHostDispatchSource(path, source));
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
			assert.ok(containerHostDispatchChangedPaths.includes(file.path));
			const bytes = beforeReviewedSemanticDecisionsSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(file.sha256, sha256(beforeContainerHostDispatchSource(file.path, bytes)));
			assert.equal(now.files[position].sha256, sha256(bytes));
			refreshed++;
		}
	}
	assert.equal(refreshed, 8);
});
