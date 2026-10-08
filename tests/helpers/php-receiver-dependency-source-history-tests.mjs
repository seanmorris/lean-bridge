/**
 * PHP-Wasm receiver dependency and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNativeFinPromotionSource } from "./native-fin-promotion-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpReceiverDependencySource, phpReceiverDependencyChangedPaths, phpReceiverDependencyHistoryPath, reversePhpReceiverDependencyUpdate } from "./php-receiver-dependency-source-history.mjs";

test("PHP-Wasm receiver dependency authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(phpReceiverDependencyHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "c391e58a1fcfa9a3c137f1ca4b4fb8a49fc77dda");
	assert.deepEqual(record.updates.map(update => update.path), phpReceiverDependencyChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpReceiverDependencyUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpReceiverDependencySource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpReceiverDependencySource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePhpReceiverDependencySource(update.path, changed), changed);
		assert.throws(() => reversePhpReceiverDependencyUpdate(changed, update));
		assert.throws(() => reversePhpReceiverDependencyUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
