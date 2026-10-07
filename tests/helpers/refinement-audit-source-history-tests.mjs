/**
 * Authenticate the Refinement audit change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeBrowserRefinementsSource, browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { beforeRefinementAuditSource, refinementAuditChangedPaths
	, refinementAuditHistoryPath, reverseRefinementAuditUpdate } from "./refinement-audit-source-history.mjs";

test("Refinement audit history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(refinementAuditHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "da7de114386ada61d165b1be5b42918dc9ab2832");
	assert.deepEqual(record.updates.map(item => item.path), refinementAuditChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeBrowserRefinementsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRefinementAuditUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRefinementAuditSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRefinementAuditSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeRefinementAuditSource(update.path, changed), changed);
		assert.throws(() => reverseRefinementAuditUpdate(changed, update));
		assert.throws(() => reverseRefinementAuditUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Refinement audit changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeBrowserRefinementsSource(path, text)), previous = JSON.parse(beforeRefinementAuditSource(path, text));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [position, entry] of previous.evidence.entries())
	{
		const now = current.evidence[position];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(refinementAuditChangedPaths.includes(file.path) || browserRefinementsChangedPaths.includes(file.path) || scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeRefinementAuditSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeBrowserRefinementsSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# refinement-audit refreshed inventory pins: ${refreshed}\n`);
});
