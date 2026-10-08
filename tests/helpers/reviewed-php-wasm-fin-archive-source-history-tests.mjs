/**
 * Reviewed PHP-Wasm Fin archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeConsumerCiRepairSource } from "./native-consumer-ci-repair-source-history.mjs";
import { beforeReviewedPhpWasmFinArchiveSource, reviewedPhpWasmFinArchiveChangedPaths, reviewedPhpWasmFinArchiveHistoryPath, reverseReviewedPhpWasmFinArchiveUpdate } from "./reviewed-php-wasm-fin-archive-source-history.mjs";

test("Reviewed PHP-Wasm Fin archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedPhpWasmFinArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ddb183caaddc8d847dbbb43a4217a92077c254ba");
	assert.deepEqual(record.updates.map(update => update.path), reviewedPhpWasmFinArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeConsumerCiRepairSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedPhpWasmFinArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedPhpWasmFinArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedPhpWasmFinArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedPhpWasmFinArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedPhpWasmFinArchiveUpdate(changed, update));
		assert.throws(() => reverseReviewedPhpWasmFinArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("reviewed PHP-Wasm archival leaves the entire preceding support inventory unchanged", async () => {
	const path = "docs/type-surface.v1.json", text = beforeNativeConsumerCiRepairSource(path, await readFile(path, "utf8"));
	assert.equal(sha256(text), "f4101011598d7ac9902ede7ba4261ec38e3ed555092779cdfd621f8da4b30349");
	assert.equal(beforeReviewedPhpWasmFinArchiveSource(path, text), text);
	assert.equal(reviewedPhpWasmFinArchiveChangedPaths.includes(path), false);
});
