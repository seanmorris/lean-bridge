/**
 * Reconcile hosted Fin support without changing older reports or unrelated coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { finHostedPromotionReferences } from "./fin-native-hosted-promotion-references.mjs";
import { finHostedMissingFieldProfiles, promoteFinHostedCoverage } from "./fin-native-hosted-promotion.mjs";
import { beforeFinHostedPromotionSource, finHostedPromotionHistoryPath } from "./fin-native-hosted-promotion-history.mjs";
import "./fin-native-hosted-promotion-history-tests.mjs";

const references = finHostedPromotionReferences();
const current = await readTypeSurface();
const before = { ...current, document: JSON.parse(beforeFinHostedPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"))) };
const proposed = references.then(rows => promoteFinHostedCoverage(before.document, rows));

test("hosted Fin promotion retains all native profiles, Python selections and four Perl ABIs", async () => {
	const rows = await references;
	assert.equal(rows.length, 78);
	assert.equal(rows.reduce((sum, row) => sum + row.profiles.length, 0), 90);
	assert.deepEqual([...new Set(rows.flatMap(row => row.profiles))].sort(),
		["c", "cpp", "dotnet", "java", "kotlin", "perl", "php-native", "python", "ruby", "rust", "wit-wasi"]);
	assert.deepEqual([...new Set(rows.map(row => row.python).filter(Boolean))], ["3.11.17", "3.12.15"]);
	assert.deepEqual([...new Set(rows.map(row => row.perlAbi).filter(Boolean))],
		["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	for(const row of rows)
	{
		assert.match(row.id, /^[a-z][a-z0-9-]*$/u);
		assert.equal(row.revision, "ff71335c762628da47887bfd4f208e62c39b94b7");
		assert.match(row.environment, /host glibc was not measured/u);
		for(const profile of row.profiles) assert.equal(row.dispatch[profile], profile === "c" ? "measured" : "unmeasured");
		for(const file of row.executionFiles) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
	}
	for(const family of ["product", "product-array", "record"]) for(const sourcePath of ["ordinary-source", "reviewed-ir"])
	{
		const python = rows.filter(row => row.family === family && row.sourcePath === sourcePath && row.python);
		assert.equal(python.length, 2);
		assert.notEqual(python[0].id, python[1].id);
		assert.notEqual(python[0].command, python[1].command);
		assert.notEqual(python[0].report.path, python[1].report.path);
		assert.equal(rows.filter(row => row.family === family && row.sourcePath === sourcePath && row.perlAbi).length, 4);
	}
});

test("hosted Fin promotion adds 78 evidence entries without rewriting an earlier entry", async () => {
	const rows = await references, document = await proposed;
	assert.deepEqual(document.evidence.slice(0, before.document.evidence.length), before.document.evidence);
	assert.deepEqual(document.evidence.slice(before.document.evidence.length).map(row => row.id), rows.map(row => row.id));
	for(const row of rows)
	{
		const entry = document.evidence.find(item => item.id === row.id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.command, row.command);
		assert.ok(entry.scope.includes(row.environment));
		assert.deepEqual(entry.artifacts, row.artifacts.map(item => ({ ...item, path: row.id + "/" + item.path })));
		for(const file of row.executionFiles) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256));
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256);
		if(row.profiles.includes("c")) assert.match(entry.scope, /Only C measures.*C\+\+ is unmeasured/u);
		else assert.match(entry.scope, /Dispatch is unmeasured/u);
	}
	for(const key of Object.keys(before.document).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], before.document[key], key);
	validateTypeSurface(document, before);
	const expected = structuredClone(document);
	const history = JSON.parse(await readFile(finHostedPromotionHistoryPath, "utf8"));
	for(const entry of expected.evidence.slice(0, before.document.evidence.length)) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(current.document, expected, "The committed inventory must equal the reviewed promotion and exact source-pin refresh");
});

test("hosted Fin promotion supplements 31 observations and adds only eight missing field cells", async () => {
	const rows = await references, document = await proposed;
	const added = document.observations.slice(before.document.observations.length);
	assert.equal(added.length, 8);
	assert.deepEqual(added.map(item => [item.profiles[0], item.path]),
		finHostedMissingFieldProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].map(path => [profile, path])));
	for(const item of added)
	{
		assert.deepEqual(item.positions, ["field"]); assert.deepEqual(item.shapes, ["fin"]);
		assert.match(item.scope, /nonrecursive, nongeneric/u);
		for(const stage of Object.values(item.stages))
		{
			assert.equal(stage.state, "passed");
			assert.equal(stage.evidence.length, item.profiles[0] === "perl" ? 4 : 1);
			for(const id of stage.evidence)
			{
				const row = rows.find(row => row.id === id);
				assert.equal(row.family, "record"); assert.equal(row.sourcePath, item.path);
				assert.ok(row.profiles.includes(item.profiles[0]));
			}
		}
	}
	let changed = 0;
	for(const [index, old] of before.document.observations.entries())
	{
		const now = document.observations[index];
		if(JSON.stringify(now) === JSON.stringify(old)) continue;
		changed++;
		for(const key of ["id", "profiles", "positions", "shapes", "path", "hostTypes"]) assert.deepEqual(now[key], old[key], old.id);
		for(const [name, stage] of Object.entries(old.stages))
		{
			assert.equal(now.stages[name].state, stage.state);
			assert.deepEqual(now.stages[name].evidence.slice(0, stage.evidence.length), stage.evidence);
			assert.ok(now.stages[name].note.startsWith(stage.note));
			for(const id of now.stages[name].evidence.slice(stage.evidence.length))
			{
				const row = rows.find(row => row.id === id);
				assert.equal(row.sourcePath, old.path);
				assert.equal(row.family === "record", old.positions.includes("field"));
				assert.ok(old.profiles.some(profile => row.profiles.includes(profile)));
			}
		}
	}
	assert.equal(changed, 31);
	const cells = typeSurfaceCells(document, before), oldCells = typeSurfaceCells(before.document, before);
	const changedCells = cells.filter((cell, index) => JSON.stringify(cell.stages) !== JSON.stringify(oldCells[index].stages));
	assert.equal(changedCells.length, 66);
	for(const cell of changedCells)
	{
		assert.equal(cell.shape, "fin");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.equal(cell.stages.installedExecution.state, "passed");
	}
});

test("hosted Fin promotion refuses missing reports, duplicate selections and repeated promotion", async () => {
	const rows = await references;
	await assert.rejects(promoteFinHostedCoverage(before.document, rows.slice(1)), assert.AssertionError);
	await assert.rejects(promoteFinHostedCoverage(before.document, [...rows.slice(0, -1), rows[0]]), assert.AssertionError);
	await assert.rejects(promoteFinHostedCoverage(await proposed, rows), /Already promoted/u);
});
