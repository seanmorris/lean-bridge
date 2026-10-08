/**
 * Bounded browser installation and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeBrowserInstallSource, browserInstallChangedPaths, browserInstallHistoryPath, reverseBrowserInstallUpdate } from "./browser-install-source-history.mjs";

test("Bounded browser installation authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(browserInstallHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "738d41764dcaa3f689a628ea18f7c292b2f2e8bd");
	assert.deepEqual(record.updates.map(update => update.path), browserInstallChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseBrowserInstallUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeBrowserInstallSource(update.path, source)), update.previousSha256);
		assert.equal(beforeBrowserInstallSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeBrowserInstallSource(update.path, changed), changed);
		assert.throws(() => reverseBrowserInstallUpdate(changed, update));
		assert.throws(() => reverseBrowserInstallUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
