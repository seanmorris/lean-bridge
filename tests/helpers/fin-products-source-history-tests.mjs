/**
 * Native Fin products and Except branches refresh source pins without new support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeGenericRecordPromotionSource } from "./generic-record-promotion-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinProductsSource, finProductsChangedPaths, finProductsHistoryPath, reverseFinProductsUpdate } from "./fin-products-source-history.mjs";

test("Fin products authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finProductsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e96a0e092275a383e127ba9d419776499d2c62a0");
	assert.deepEqual(record.updates.map(update => update.path), finProductsChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeGenericRecordPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinProductsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinProductsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinProductsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinProductsSource(update.path, changed), changed);
		assert.throws(() => reverseFinProductsUpdate(changed, update));
		assert.throws(() => reverseFinProductsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Fin products changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeGenericRecordPromotionSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinProductsSource(path, source));
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
			assert.ok(finProductsChangedPaths.includes(file.path));
			const bytes = beforeGenericRecordPromotionSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeFinProductsSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
