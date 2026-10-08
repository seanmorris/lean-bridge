/**
 * Structural Fin promotion changes only the archived hosts, routes and positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import { beforeCheckedRecordPromotionSource } from "./checked-record-promotion-source-history.mjs";
import { historicalTypeSurfaceCells as typeSurfaceCells } from "./historical-type-surface-cells.mjs";
import { finNativeBatchPromotionReferences } from "./fin-native-batch-promotion-references.mjs";
import { beforeFinNativeBatchPromotionSource } from "./fin-native-batch-promotion-source-history.mjs";
import "./fin-native-batch-promotion-source-history-tests.mjs";

const previousSurface = async () => JSON.parse(beforeFinNativeBatchPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

const readPromotedSurface = async () => {
	const result = await readTypeSurface();
	result.document = JSON.parse(beforeCheckedRecordPromotionSource("docs/type-surface.v1.json", JSON.stringify(result.document, null, 2) + "\n"));
	return result;
};

test("native Fin batch promotion retains fourteen original selections and their distinct environments", async () => {
	const references = await finNativeBatchPromotionReferences(), { document } = await readPromotedSurface();
	const previous = await previousSurface();
	assert.equal(references.length, 14);
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const item = document.evidence.find(item => item.id === reference.id);
		assert.equal(item.kind, "installed"); assert.equal(item.revision, reference.revision);
		assert.equal(item.command, reference.command);
		assert.ok(item.scope.includes(reference.environment)); assert.ok(item.scope.includes(`${reference.checks} checks`));
		assert.match(item.scope, /Dispatch is unmeasured/u);
		for(const file of item.files) assert.equal(sha256(beforeCheckedRecordPromotionSource(file.path, await readFile(file.path, "utf8"))), file.sha256, file.path);
		for(const file of [reference.report, ...reference.executionFiles])
			assert.ok(item.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256), file.path);
		assert.ok(item.files.some(pin => pin.path === reference.receiptPath));
		assert.deepEqual(item.artifacts, reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })));
		if(reference.profile === "dotnet")
		{
			assert.equal(reference.execution, "hosted"); assert.match(item.scope, /Host glibc was not measured/u);
			assert.match(item.scope, /not a whole-run pass/u); assert.match(item.scope, /builds with the .NET SDK/u);
		}
		else
		{
			assert.equal(reference.execution, "local"); assert.match(item.scope, /host glibc 2\.36/u);
			assert.ok(reference.command.includes(`_REPORT=/app/${reference.report.originalPath}`));
			if(reference.profile === "rust") assert.match(item.scope, /consumer compiles offline with cargo/u);
			else
			{ assert.match(item.scope, /version was not queried/u); assert.match(item.command, /LEAN_BRIDGE_WASMTIME_C_API=/u); }
		}
	}
});

test("native Fin batch adds six field cells and supplements only eight Rust and .NET structural cells", async () => {
	const { document, ...contracts } = await readPromotedSurface(), previous = await previousSurface();
	const references = await finNativeBatchPromotionReferences();
	const added = document.observations.slice(previous.observations.length);
	assert.equal(added.length, 6);
	assert.deepEqual(added.map(item => [item.profiles[0], item.path]), ["rust", "dotnet", "wit-wasi"].flatMap(profile => ["ordinary-source", "reviewed-ir"].map(path => [profile, path])));
	for(const item of added)
	{
		assert.equal(item.profiles.length, 1); assert.deepEqual(item.shapes, ["fin"]); assert.deepEqual(item.positions, ["field"]);
		const selected = references.filter(ref => ref.profile === item.profiles[0] && ref.sourcePath === item.path && ref.family === "record");
		assert.equal(selected.length, 1);
		for(const stage of Object.values(item.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, selected.map(ref => ref.id)); }
		assert.match(item.scope, /nonrecursive, nongeneric/u); assert.ok(item.limitations.some(note => /No recursive, generic, indexed or inherited/u.test(note)));
	}
	const modified = ["native-fin-rust-ordinary-source", "reviewed-fin-rust-scalar-containers", "native-fin-dotnet-ordinary-source", "reviewed-fin-dotnet-scalar-containers"];
	for(const [index, old] of previous.observations.entries())
	{
		const now = document.observations[index];
		if(!modified.includes(old.id))
		{ assert.deepEqual(now, old, old.id); continue; }
		for(const key of ["id", "profiles", "shapes", "positions", "path", "hostTypes"]) assert.deepEqual(now[key], old[key]);
		const selected = references.filter(ref => ref.profile === now.profiles[0] && ref.sourcePath === now.path && ref.family !== "record");
		for(const [name, stage] of Object.entries(now.stages))
		{
			assert.equal(stage.state, old.stages[name].state);
			assert.deepEqual(stage.evidence, [...old.stages[name].evidence, ...selected.map(ref => ref.id)]);
		}
		assert.ok(now.stages.installedExecution.note.startsWith(old.stages.installedExecution.note));
		assert.doesNotMatch(now.stages.analysis.note, /fields, callbacks, products and results is rejected/u);
	}
	const cells = typeSurfaceCells(document, contracts), old = typeSurfaceCells(previous, contracts);
	const changed = cells.filter((cell, index) => JSON.stringify(cell.stages) !== JSON.stringify(old[index].stages));
	assert.equal(changed.length, 14); assert.equal(changed.filter(cell => cell.position === "field").length, 6);
	for(const cell of changed)
	{
		assert.equal(cell.shape, "fin"); assert.ok(["rust", "dotnet", "wit-wasi"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		if(cell.profile === "wit-wasi") assert.equal(cell.position, "field");
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key))) assert.deepEqual(document[key], previous[key], key);
});
