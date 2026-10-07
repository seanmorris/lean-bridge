/**
 * The array-of-product acceptance, its shared harness and CI gates refresh source pins without new support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedFinAcceptanceSource } from "./reviewed-fin-acceptance-source-history.mjs";
import { beforeFinProductArraysSource, finProductArraysChangedPaths, finProductArraysHistoryPath, reverseFinProductArraysUpdate } from "./fin-product-arrays-source-history.mjs";

test("Fin product arrays authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finProductArraysHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "346ec2a7be1d97de21f6f0331cf61e79417ccd55");
	assert.deepEqual(record.updates.map(update => update.path), finProductArraysChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedFinAcceptanceSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinProductArraysUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinProductArraysSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinProductArraysSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinProductArraysSource(update.path, changed), changed);
		assert.throws(() => reverseFinProductArraysUpdate(changed, update));
		assert.throws(() => reverseFinProductArraysUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Fin product arrays changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeReviewedFinAcceptanceSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinProductArraysSource(path, source));
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
			assert.ok(finProductArraysChangedPaths.includes(file.path));
			const bytes = beforeReviewedFinAcceptanceSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeFinProductArraysSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
