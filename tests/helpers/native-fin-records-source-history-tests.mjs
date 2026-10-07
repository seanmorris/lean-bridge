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
import { beforeNativeFinRecordsSource, nativeFinRecordsChangedPaths, nativeFinRecordsHistoryPath, reverseNativeFinRecordsUpdate } from "./native-fin-records-source-history.mjs";

test("Native Fin records authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinRecordsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "dd0e48e4884ed8b5418c037898a30518ab66a61a");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinRecordsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseNativeFinRecordsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinRecordsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinRecordsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinRecordsSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinRecordsUpdate(changed, update));
		assert.throws(() => reverseNativeFinRecordsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native Fin records changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeNativeFinRecordsSource(path, source));
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
			assert.ok(nativeFinRecordsChangedPaths.includes(file.path));
			const bytes = await readFile(file.path, "utf8");
			assert.equal(sha256(beforeNativeFinRecordsSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
