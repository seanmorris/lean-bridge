/**
 * Reviewed PHP-Wasm Fin integration and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedPhpWasmFinArchiveSource } from "./reviewed-php-wasm-fin-archive-source-history.mjs";
import { beforePhpWasmReviewedFinSource, phpWasmReviewedFinChangedPaths, phpWasmReviewedFinHistoryPath, reversePhpWasmReviewedFinUpdate } from "./php-wasm-reviewed-fin-source-history.mjs";

test("Reviewed PHP-Wasm Fin integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(phpWasmReviewedFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "b82e76a9e62699d84c838f5a61774fef101ea9f7");
	assert.deepEqual(record.updates.map(update => update.path), phpWasmReviewedFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedPhpWasmFinArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpWasmReviewedFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpWasmReviewedFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpWasmReviewedFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePhpWasmReviewedFinSource(update.path, changed), changed);
		assert.throws(() => reversePhpWasmReviewedFinUpdate(changed, update));
		assert.throws(() => reversePhpWasmReviewedFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Reviewed PHP-Wasm Fin source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = beforeReviewedPhpWasmFinArchiveSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforePhpWasmReviewedFinSource(path, text));
	const record = JSON.parse(await readFile(phpWasmReviewedFinHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeReviewedPhpWasmFinArchiveSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(document, previous);
});
