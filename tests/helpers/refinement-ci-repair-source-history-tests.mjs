/**
 * Authenticate the Refinement CI repair change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeRefinementCiRepairSource, refinementCiRepairChangedPaths
	, refinementCiRepairHistoryPath, reverseRefinementCiRepairUpdate } from "./refinement-ci-repair-source-history.mjs";

test("Refinement CI repair history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(refinementCiRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "1f010bb34bed300119756bdcf8d96f1ec320ad7e");
	assert.deepEqual(record.updates.map(item => item.path), refinementCiRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseRefinementCiRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRefinementCiRepairSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRefinementCiRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeRefinementCiRepairSource(update.path, changed), changed);
		assert.throws(() => reverseRefinementCiRepairUpdate(changed, update));
		assert.throws(() => reverseRefinementCiRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Refinement CI repair changes only refreshed source pins, no claim, receipt scope or archive", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeRefinementCiRepairSource(path, text));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [position, entry] of previous.evidence.entries())
	{
		const now = current.evidence[position];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(refinementCiRepairChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeRefinementCiRepairSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# refinement-ci-repair refreshed inventory pins: ${refreshed}\n`);
});
