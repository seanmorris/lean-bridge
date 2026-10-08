/**
 * CI dependency timeout and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinProductPhpNameSource } from "./fin-product-php-name-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCiDependencyTimeoutSource, ciDependencyTimeoutChangedPaths, ciDependencyTimeoutHistoryPath, reverseCiDependencyTimeoutUpdate } from "./ci-dependency-timeout-source-history.mjs";

test("CI dependency timeout authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(ciDependencyTimeoutHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "6e010ce5d4e87b458cd44af41c2bf72a87314d8e");
	assert.deepEqual(record.updates.map(update => update.path), ciDependencyTimeoutChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinProductPhpNameSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseCiDependencyTimeoutUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCiDependencyTimeoutSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCiDependencyTimeoutSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCiDependencyTimeoutSource(update.path, changed), changed);
		assert.throws(() => reverseCiDependencyTimeoutUpdate(changed, update));
		assert.throws(() => reverseCiDependencyTimeoutUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
