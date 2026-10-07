/**
 * CI gates for reviewed containers and products refresh source pins without new support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinProductsCiSource, finProductsCiChangedPaths, finProductsCiHistoryPath, reverseFinProductsCiUpdate } from "./fin-products-ci-source-history.mjs";

test("Fin products CI authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finProductsCiHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "f315e47b5f202a98b7398e1390188ebb3ba669ba");
	assert.deepEqual(record.updates.map(update => update.path), finProductsCiChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseFinProductsCiUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinProductsCiSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinProductsCiSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinProductsCiSource(update.path, changed), changed);
		assert.throws(() => reverseFinProductsCiUpdate(changed, update));
		assert.throws(() => reverseFinProductsCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Fin products CI changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeFinProductsCiSource(path, source));
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
			assert.ok(finProductsCiChangedPaths.includes(file.path));
			const bytes = await readFile(file.path, "utf8");
			assert.equal(sha256(beforeFinProductsCiSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});

