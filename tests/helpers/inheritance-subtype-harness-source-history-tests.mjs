/**
 * Inheritance and Subtype harness integration and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeInheritanceSubtypeHarnessSource, inheritanceSubtypeHarnessChangedPaths, inheritanceSubtypeHarnessHistoryPath, reverseInheritanceSubtypeHarnessUpdate } from "./inheritance-subtype-harness-source-history.mjs";

test("Inheritance and Subtype harness integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(inheritanceSubtypeHarnessHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "f041c559805386b053d0aa79c6ab85af66482bf1");
	assert.deepEqual(record.updates.map(update => update.path), inheritanceSubtypeHarnessChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseInheritanceSubtypeHarnessUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeInheritanceSubtypeHarnessSource(update.path, source)), update.previousSha256);
		assert.equal(beforeInheritanceSubtypeHarnessSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeInheritanceSubtypeHarnessSource(update.path, changed), changed);
		assert.throws(() => reverseInheritanceSubtypeHarnessUpdate(changed, update));
		assert.throws(() => reverseInheritanceSubtypeHarnessUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
