/**
 * Authenticate the Scalar Fin rejection change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeScalarFinWordingSource, scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { perlIndexedErrorsChangedPaths } from "./perl-indexed-errors-source-history.mjs";
import { refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";
import { beforeScalarFinRejectionSource, scalarFinRejectionChangedPaths
	, scalarFinRejectionHistoryPath, reverseScalarFinRejectionUpdate } from "./scalar-fin-rejection-source-history.mjs";

test("Scalar Fin rejection history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(scalarFinRejectionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "0c57d7b4849117dbb81cf3198b6c3ae11f9e3eda");
	assert.deepEqual(record.updates.map(item => item.path), scalarFinRejectionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeScalarFinWordingSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseScalarFinRejectionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeScalarFinRejectionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeScalarFinRejectionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeScalarFinRejectionSource(update.path, changed), changed);
		assert.throws(() => reverseScalarFinRejectionUpdate(changed, update));
		assert.throws(() => reverseScalarFinRejectionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// The commit whose tree ran every acceptance.
const acceptedRevision = "9743855bacf6bcf98652240d6f419fcc0a0113cc";
const repointed = ["npm-fin-refinements-ordinary-source", "npm-browser-fin-ordinary-source", "npm-browser-subtype-ordinary-source"];

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Scalar Fin rejection evidence adds one receipt, repoints the npm and browser Fin claims and changes no other claim", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeScalarFinWordingSource(path, text)), previous = JSON.parse(beforeScalarFinRejectionSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), ["npm-scalar-fin-rejection-installed"]);
	const [evidence] = added;
	assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
	assert.equal(evidence.command, "LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/scalar-fin-rejection.test.mjs");
	for(const file of ["tests/scalar-fin-rejection.test.mjs", "src/build/compiler-adapters.mjs", "src/build/component-scalar-adapters.mjs", "src/build/component-callable-adapters.mjs", "src/build/component-copied-adapters.mjs", "src/build/component-record-adapters.mjs"])
		assert.ok(evidence.files.some(item => item.path === file), file);
	assert.equal(evidence.artifacts.length, 7);
	assert.ok(evidence.artifacts.every(item => item.path.startsWith("npm/scalar-fin-rejection/") && /^[0-9a-f]{64}$/.test(item.sha256)));
	// No cell appears or disappears; only the three Fin and browser cells change, and only in their claims text, citations and limitations.
	assert.deepEqual(current.observations.map(entry => entry.id), previous.observations.map(entry => entry.id));
	for(const [index, cell] of current.observations.entries())
	{
		const before = previous.observations[index];
		if(!repointed.includes(cell.id))
		{ assert.deepEqual(cell, before, cell.id); continue; }
		const strip = value => ({ ...value, scope: null, limitations: null, conversionNotes: null, stages: Object.fromEntries(Object.entries(value.stages).map(([stage, item]) => [stage, item.state])) });
		assert.deepEqual(strip(cell), strip(before), cell.id);
		for(const [stage, item] of Object.entries(cell.stages))
			assert.ok(before.stages[stage].evidence.every(id => item.evidence.includes(id)), `${cell.id} ${stage} keeps its citations`);
	}
	// The browser receipt moves to the repaired revision and archives; every other receipt keeps its claims.
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	let refreshed = 0;
	for(const entry of previous.evidence)
	{
		const now = current.evidence.find(item => item.id === entry.id);
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		if(entry.id === "npm-browser-refinements-installed")
		{
			assert.equal(now.revision, acceptedRevision);
			assert.notEqual(entry.revision, acceptedRevision);
			assert.deepEqual({ ...strip(now), revision: null, scope: null, artifacts: null }, { ...strip(entry), revision: null, scope: null, artifacts: null });
			assert.deepEqual(now.artifacts.map(item => item.path), entry.artifacts.map(item => item.path));
		}
		else
		{
			assert.deepEqual(strip(now), strip(entry), entry.id);
			assert.deepEqual(now.artifacts, entry.artifacts, entry.id);
		}
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(scalarFinRejectionChangedPaths.includes(file.path) || scalarFinWordingChangedPaths.includes(file.path) || perlRefinementsChangedPaths.includes(file.path) || perlIndexedErrorsChangedPaths.includes(file.path) || refinementCiRepairChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeScalarFinRejectionSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeScalarFinWordingSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# scalar-fin-rejection refreshed inventory pins: ${refreshed}\n`);
});
