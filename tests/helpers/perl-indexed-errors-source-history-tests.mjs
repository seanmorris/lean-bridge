/**
 * Authenticate the Perl indexed errors change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePerlIndexedErrorsSource, perlIndexedErrorsChangedPaths
	, perlIndexedErrorsHistoryPath, reversePerlIndexedErrorsUpdate } from "./perl-indexed-errors-source-history.mjs";
import { beforeRefinementCiRepairSource, refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";

test("Perl indexed errors history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(perlIndexedErrorsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "7f7bd65104050efddd328377389072f4c4272ac0");
	assert.deepEqual(record.updates.map(item => item.path), perlIndexedErrorsChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeRefinementCiRepairSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePerlIndexedErrorsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlIndexedErrorsSource(update.path, source)), update.previousSha256);
		assert.equal(beforePerlIndexedErrorsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforePerlIndexedErrorsSource(update.path, changed), changed);
		assert.throws(() => reversePerlIndexedErrorsUpdate(changed, update));
		assert.throws(() => reversePerlIndexedErrorsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Perl indexed errors changes only refreshed source pins, no claim, receipt scope or archive", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforePerlIndexedErrorsSource(path, text));
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
			assert.ok(perlIndexedErrorsChangedPaths.includes(file.path) || refinementCiRepairChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforePerlIndexedErrorsSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# perl-indexed-errors refreshed inventory pins: ${refreshed}\n`);
});
