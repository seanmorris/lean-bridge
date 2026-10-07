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
import { beforePerlFinArchiveSource } from "./perl-fin-archive-source-history.mjs";
import { beforeRefinementCoreFollowupSource, refinementCoreFollowupChangedPaths, refinementCoreFollowupHistoryPath, reverseRefinementCoreFollowupUpdate } from "./refinement-core-followup-source-history.mjs";

test("refinement core follow-up authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(refinementCoreFollowupHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "4f07abddfeb6b7fd2dfa16faefde41f0fdeb8cea");
	assert.deepEqual(record.updates.map(update => update.path), refinementCoreFollowupChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePerlFinArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRefinementCoreFollowupUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRefinementCoreFollowupSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRefinementCoreFollowupSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeRefinementCoreFollowupSource(update.path, changed), changed);
		assert.throws(() => reverseRefinementCoreFollowupUpdate(changed, update));
		assert.throws(() => reverseRefinementCoreFollowupUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("refinement core follow-up changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforePerlFinArchiveSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeRefinementCoreFollowupSource(path, source));
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
			assert.ok(refinementCoreFollowupChangedPaths.includes(file.path));
			const bytes = beforePerlFinArchiveSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeRefinementCoreFollowupSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
