/**
 * Authenticate the Perl refinements change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePerlRefinementsSource, perlRefinementsChangedPaths
	, perlRefinementsHistoryPath, reversePerlRefinementsUpdate } from "./perl-refinements-source-history.mjs";

test("Perl refinements history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(perlRefinementsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "16b0e9c24a7993876f8408a6ed664766be9c6106");
	assert.deepEqual(record.updates.map(item => item.path), perlRefinementsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reversePerlRefinementsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlRefinementsSource(update.path, source)), update.previousSha256);
		assert.equal(beforePerlRefinementsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforePerlRefinementsSource(update.path, changed), changed);
		assert.throws(() => reversePerlRefinementsUpdate(changed, update));
		assert.throws(() => reversePerlRefinementsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Perl refinements changes only refreshed source pins, no claim, receipt scope or archive", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforePerlRefinementsSource(path, text));
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
			assert.ok(perlRefinementsChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforePerlRefinementsSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# perl-refinements refreshed inventory pins: ${refreshed}\n`);
});
