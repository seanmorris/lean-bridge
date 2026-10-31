/**
 * Cached hashes preserve every historical source and installed support claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeHistoryDigestSource, historyDigestChangedPaths, historyDigestHistoryPath, reverseHistoryDigestUpdate } from "./history-digest-source-history.mjs";
import { sourceAtFinHistoryRecordSource } from "./source-at-fin-history-milestone.mjs";

test("history digest integration authenticates each complete verifier predecessor", async () => {
	const record = JSON.parse(await readFile(historyDigestHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "410b866da5d7eb90b83f6926f6833084a334816e");
	assert.deepEqual(record.updates.map(update => update.path), historyDigestChangedPaths);
	for(const update of record.updates)
	{
		const source = await sourceAtFinHistoryRecordSource(
			historyDigestHistoryPath, update.path, update.currentSha256
			, beforeHistoryDigestSource
		);
		assert.equal(sha256(reverseHistoryDigestUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeHistoryDigestSource(update.path, source)), update.previousSha256);
		assert.equal(beforeHistoryDigestSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeHistoryDigestSource(update.path, changed), changed);
		assert.throws(() => reverseHistoryDigestUpdate(changed, update));
		assert.throws(() => reverseHistoryDigestUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("history digest cache changes current verifier pins only, not support or archived receipts", async () => {
	const record = JSON.parse(await readFile(historyDigestHistoryPath, "utf8"));
	const path = "docs/type-surface.v1.json";
	const target = record.updates.find(update => update.path === path);
	const source = await sourceAtFinHistoryRecordSource(
		historyDigestHistoryPath, path, target.currentSha256
		, beforeHistoryDigestSource
	);
	const current = JSON.parse(source);
	const previous = JSON.parse(beforeHistoryDigestSource(path, source));
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
			assert.ok(historyDigestChangedPaths.includes(file.path));
			const update = record.updates.find(item => item.path === file.path);
			const bytes = await sourceAtFinHistoryRecordSource(
				historyDigestHistoryPath, file.path, update.currentSha256
				, beforeHistoryDigestSource
			);
			assert.equal(sha256(beforeHistoryDigestSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
