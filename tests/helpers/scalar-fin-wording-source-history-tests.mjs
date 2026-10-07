/**
 * Authenticate the Scalar Fin wording change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePerlRefinementsSource, perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { perlIndexedErrorsChangedPaths } from "./perl-indexed-errors-source-history.mjs";
import { beforeScalarFinWordingSource, scalarFinWordingChangedPaths
	, scalarFinWordingHistoryPath, reverseScalarFinWordingUpdate } from "./scalar-fin-wording-source-history.mjs";

test("Scalar Fin wording history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(scalarFinWordingHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "9740bb0dadef59ea92b0acada2b21e783c19fc18");
	assert.deepEqual(record.updates.map(item => item.path), scalarFinWordingChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePerlRefinementsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseScalarFinWordingUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeScalarFinWordingSource(update.path, source)), update.previousSha256);
		assert.equal(beforeScalarFinWordingSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeScalarFinWordingSource(update.path, changed), changed);
		assert.throws(() => reverseScalarFinWordingUpdate(changed, update));
		assert.throws(() => reverseScalarFinWordingUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Scalar Fin wording changes only the scalar Fin receipt's scope wording and refreshed source pins", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeScalarFinWordingSource(path, text));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [position, entry] of previous.evidence.entries())
	{
		const now = current.evidence[position];
		const strip = value => ({ ...value, files: value.files.map(file => file.path), scope: value.id === "npm-scalar-fin-rejection-installed" ? null : value.scope });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		if(entry.id === "npm-scalar-fin-rejection-installed")
		{
			assert.match(entry.scope, /nothing reaches stderr/u);
			assert.match(now.scope, /without the panic diagnostic the pre-repair wrapper printed to stderr/u);
			assert.match(now.scope, /without measuring released allocations/u);
		}
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path) || perlIndexedErrorsChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeScalarFinWordingSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# scalar-fin-wording refreshed inventory pins: ${refreshed}\n`);
});
