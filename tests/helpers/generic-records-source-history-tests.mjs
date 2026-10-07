/**
 * Authenticate the Generic records change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeGenericRecordsSource, genericRecordsChangedPaths
	, genericRecordsHistoryPath, reverseGenericRecordsUpdate } from "./generic-records-source-history.mjs";

test("Generic records history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(genericRecordsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "37e8b8a453d00ab413b7ec96ef97e615068859b0");
	assert.deepEqual(record.updates.map(item => item.path), genericRecordsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseGenericRecordsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeGenericRecordsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeGenericRecordsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeGenericRecordsSource(update.path, changed), changed);
		assert.throws(() => reverseGenericRecordsUpdate(changed, update));
		assert.throws(() => reverseGenericRecordsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// The commit whose tree ran every acceptance.
const acceptedRevision = "018872e23dd930fd652c7a28a335ea3d6dea935e";
const receipts = { "npm-finite-specializations-ordinary-source": "npm-generic-records-installed", "native-specializations-c-cpp-ordinary-source": "native-generic-records-c-cpp-installed" };
const reworded = ["dotnet", "java-kotlin", "php-native", "ruby", "rust", "wit-wasi"].map(group => `native-specializations-${group}-ordinary-source`);

// Audit the inventory against its exact predecessor, reconstructed without Git.
test("Generic records evidence adds two receipts, extends the two generic signature cells they cover, rewords six limitations and changes no other claim", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeGenericRecordsSource(path, text));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	assert.deepEqual(added.map(entry => entry.id), Object.values(receipts));
	for(const evidence of added)
	{
		assert.equal(evidence.kind, "installed"); assert.equal(evidence.revision, acceptedRevision);
		assert.ok(evidence.command.endsWith("node --test tests/generic-records.test.mjs"));
		for(const file of ["src/analyze/NativeExports.lean", "src/analyze/native-types.mjs", "src/analyze/semantic-model.mjs", "tests/generic-records.test.mjs", "tests/helpers/generic-record-packages.mjs"])
			assert.ok(evidence.files.some(item => item.path === file), `${evidence.id}: ${file}`);
		assert.equal(evidence.artifacts.length, 2);
		assert.ok(evidence.artifacts.every(item => item.path.includes("/generic-records/") && /^[0-9a-f]{64}$/.test(item.sha256)));
	}
	// No cell appears or disappears. The two generic signature cells gain the new citation beside every
	// previous one and change only their claims text; six others reword one limitation; the rest are unchanged.
	assert.deepEqual(current.observations.map(entry => entry.id), previous.observations.map(entry => entry.id));
	for(const [index, cell] of current.observations.entries())
	{
		const before = previous.observations[index];
		if(!(cell.id in receipts) && !reworded.includes(cell.id))
		{ assert.deepEqual(cell, before, cell.id); continue; }
		const strip = value => ({ ...value, scope: null, limitations: null, conversionNotes: null, hostTypes: null, stages: Object.fromEntries(Object.entries(value.stages).map(([stage, item]) => [stage, item.state])) });
		assert.deepEqual(strip(cell), strip(before), cell.id);
		if(cell.id in receipts)
		{
			for(const [stage, item] of Object.entries(cell.stages))
				assert.deepEqual(item.evidence, [...before.stages[stage].evidence, receipts[cell.id]], `${cell.id} ${stage}`);
			assert.equal(cell.limitations.length, before.limitations.length + 1, cell.id);
			assert.ok(cell.scope.includes("is an alias-named record"), cell.id);
		}
		else
		{
			assert.deepEqual(Object.fromEntries(Object.entries(cell.stages).map(([stage, item]) => [stage, item.evidence])), Object.fromEntries(Object.entries(before.stages).map(([stage, item]) => [stage, item.evidence])), cell.id);
			assert.deepEqual({ ...cell, limitations: null }, { ...before, limitations: null, scope: cell.scope }, cell.id);
			assert.equal(cell.limitations.length, before.limitations.length, cell.id);
			assert.ok(cell.limitations.some(item => item.includes("require an abbrev that names them")), cell.id);
		}
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	let refreshed = 0;
	for(const entry of previous.evidence)
	{
		const now = current.evidence.find(item => item.id === entry.id);
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(genericRecordsChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeGenericRecordsSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# generic-records refreshed inventory pins: ${refreshed}\n`);
});
