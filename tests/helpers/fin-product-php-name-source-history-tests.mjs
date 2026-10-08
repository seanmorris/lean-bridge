/**
 * PHP-safe product name and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePhpReceiverDependencySource } from "./php-receiver-dependency-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinProductPhpNameSource, finProductPhpNameChangedPaths, finProductPhpNameHistoryPath, reverseFinProductPhpNameUpdate } from "./fin-product-php-name-source-history.mjs";

test("PHP-safe product name authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finProductPhpNameHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "758c979e2151864fd6b044b648714cdd99c03fe8");
	assert.deepEqual(record.updates.map(update => update.path), finProductPhpNameChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePhpReceiverDependencySource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinProductPhpNameUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinProductPhpNameSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinProductPhpNameSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinProductPhpNameSource(update.path, changed), changed);
		assert.throws(() => reverseFinProductPhpNameUpdate(changed, update));
		assert.throws(() => reverseFinProductPhpNameUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
