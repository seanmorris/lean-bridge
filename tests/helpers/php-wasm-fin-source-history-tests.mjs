/**
 * PHP-Wasm Fin admission and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedFinPromotionSource } from "./reviewed-fin-promotion-source-history.mjs";
import { beforePhpWasmFinSource, phpWasmFinChangedPaths, phpWasmFinHistoryPath, reversePhpWasmFinUpdate } from "./php-wasm-fin-source-history.mjs";

test("PHP-Wasm Fin admission authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(phpWasmFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e013f9a9ba7531cf12d901140d407c4e5c2f53f9");
	assert.deepEqual(record.updates.map(update => update.path), phpWasmFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedFinPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpWasmFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpWasmFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpWasmFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePhpWasmFinSource(update.path, changed), changed);
		assert.throws(() => reversePhpWasmFinUpdate(changed, update));
		assert.throws(() => reversePhpWasmFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("PHP-Wasm Fin admission changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeReviewedFinPromotionSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforePhpWasmFinSource(path, source));
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
			assert.ok(phpWasmFinChangedPaths.includes(file.path));
			const bytes = beforeReviewedFinPromotionSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforePhpWasmFinSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
