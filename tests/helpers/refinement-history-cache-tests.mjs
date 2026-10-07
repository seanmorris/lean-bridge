/**
 * Preserve complete historical verification while reusing exact Fin inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeRefinementHistoryCacheSource, refinementHistoryCacheChangedPaths
	, refinementHistoryCacheHistoryPath, reverseRefinementHistoryCacheUpdate } from "./refinement-history-cache-source-history.mjs";

test("Fin cache integration authenticates every historical verifier edit", async () => {
	const record = JSON.parse(await readFile(refinementHistoryCacheHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "a82e4c55bbf94585e0edf733ffe561b055c360bb");
	assert.deepEqual(record.updates.map(update => update.path), refinementHistoryCacheChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseRefinementHistoryCacheUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRefinementHistoryCacheSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRefinementHistoryCacheSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const altered = source + "\n// unrecorded change\n";
		assert.equal(beforeRefinementHistoryCacheSource(update.path, altered), altered);
		assert.throws(() => reverseRefinementHistoryCacheUpdate(altered, update));
		assert.throws(() => reverseRefinementHistoryCacheUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseRefinementHistoryCacheUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Fin normalization keeps buffer identity, expected stops and mutated-source rejection", async () => {
	const path = "src/build/native-model.mjs", bytes = await readFile(path);
	const record = JSON.parse(await readFile("docs/evidence/reviewed-fin-source-history-20261007.json", "utf8"));
	const update = record.updates.find(item => item.path === path);
	assert.equal(beforeFinRefinementSource(path, bytes, sha256(bytes)), bytes);
	const first = beforeFinRefinementSource(path, bytes, update.previousSha256);
	assert.equal(sha256(first), update.previousSha256);
	assert.equal(beforeFinRefinementSource(path, Buffer.from(bytes), update.previousSha256), first);
	const changed = Buffer.concat([bytes, Buffer.from("\n// unrecorded change\n")]);
	assert.notEqual(sha256(beforeFinRefinementSource(path, changed, update.previousSha256)), update.previousSha256);
	assert.equal(beforeFinRefinementSource("unregistered-path", changed), changed);
	assert.equal(beforeFinRefinementSource(path, bytes, sha256(bytes)), bytes);
});
