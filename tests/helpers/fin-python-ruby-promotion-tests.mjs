/**
 * Prevent Python/Ruby evidence promotion from borrowing hosts, routes or runtimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { finPythonRubyPromotionReferences, finPythonRubyReceiptPath } from "./fin-python-ruby-promotion-references.mjs";
import { beforeFinPythonRubyPromotionSource } from "./fin-python-ruby-promotion-source-history.mjs";
import "./fin-python-ruby-promotion-source-history-tests.mjs";
import "./fin-python-ruby-host-notes-source-history-tests.mjs";

const previousSurface = async () => JSON.parse(beforeFinPythonRubyPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));

test("Python/Ruby promotion notes preserve host-specific runtime and earlier observation facts", async () => {
	const { document } = await readTypeSurface();
	for(const profile of ["python", "ruby"])
		for(const source of ["ordinary-source", "reviewed-ir"])
		{
			const id = source === "ordinary-source" ? `native-fin-${profile}-ordinary-source` : `reviewed-fin-${profile}-scalar-containers`;
			for(const name of [id, `native-nominal-fin-${profile}-${source}`])
			{
				const entry = document.observations.find(item => item.id === name);
				assert.match(entry.stages.packaging.note, profile === "python" ? /original wheel/u : /original gem/u);
				assert.match(entry.stages.installedExecution.note, profile === "python" ? /Python 3\.11\.16 and 3\.12\.14/u : /Ruby 3\.3\.12/u);
				assert.doesNotMatch(entry.stages.installedExecution.note, profile === "python" ? /Ruby/u : /Python/u);
				assert.match(entry.stages.installedExecution.note, /these runs do not measure dispatch/u);
			}
		}
	const python = document.observations.find(item => item.id === "native-fin-python-ordinary-source");
	assert.match(python.stages.installedExecution.note, /earlier container checks run in the CI Python environment/u);
	assert.match(python.stages.packaging.note, /compare bundled C libraries and verify receipts/u);
	const ruby = document.observations.find(item => item.id === "native-fin-ruby-ordinary-source");
	assert.match(ruby.limitations[1], /Ordinary Ruby dispatch is not counted/u);
	assert.match(ruby.stages.installedExecution.note, /RangeError naming the parameter and bound/u);
	assert.match(ruby.stages.installedExecution.note, /non-Integer input raises TypeError/u);
});

test("Python/Ruby promotion authenticates 18 reports with separate interpreter execution evidence", async () => {
	const references = await finPythonRubyPromotionReferences();
	assert.equal(references.length, 18);
	const { document } = await readTypeSurface(), previous = await previousSurface();
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.revision, reference.revision);
		assert.equal(entry.command, reference.command);
		assert.match(entry.command, /node --test --test-concurrency=1/u);
		assert.ok(entry.command.includes(`${reference.sourcePath === "reviewed-ir" ? "REVIEWED_" : ""}FIN_${reference.family.replaceAll("-", "_").toUpperCase()}_PROFILES=${reference.profile}`));
		assert.deepEqual(entry.artifacts, reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })));
		assert.ok(entry.files.some(file => file.path === reference.reportPath && file.sha256 === reference.reportSha256));
		assert.ok(entry.files.some(file => file.path === finPythonRubyReceiptPath));
		for(const execution of reference.executionFiles)
			assert.ok(entry.files.some(file => file.path === execution.path && file.sha256 === execution.sha256), execution.path);
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
		assert.ok(entry.scope.includes(reference.version));
		assert.match(entry.scope, /consumer did not print its version/u);
		assert.match(entry.scope, /host glibc and Lean version were not measured/u);
		assert.match(entry.scope, /Dispatch is unmeasured/u);
	}
	for(const first of references.filter(item => item.runtime === "python311"))
	{
		const second = references.find(item => item.runtime === "python312" && item.family === first.family && item.sourcePath === first.sourcePath);
		assert.equal(first.reportSha256, second.reportSha256);
		assert.notEqual(first.reportPath, second.reportPath);
		assert.notDeepEqual(first.executionFiles, second.executionFiles);
		assert.notEqual(first.command, second.command);
	}
});

test("Python/Ruby promotion adds four field cells and supplements eight structural cells only", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await previousSurface();
	const references = await finPythonRubyPromotionReferences();
	const added = document.observations.slice(previous.observations.length);
	assert.equal(added.length, 4);
	assert.deepEqual(added.map(item => [item.profiles[0], item.path]), [
		["python", "ordinary-source"], ["python", "reviewed-ir"]
		, ["ruby", "ordinary-source"], ["ruby", "reviewed-ir"]
	]);
	for(const observation of added)
	{
		assert.equal(observation.profiles.length, 1);
		assert.deepEqual(observation.shapes, ["fin"]); assert.deepEqual(observation.positions, ["field"]);
		const selected = references.filter(item => item.profile === observation.profiles[0] && item.sourcePath === observation.path && item.family === "record");
		assert.equal(selected.length, observation.profiles[0] === "python" ? 2 : 1);
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, selected.map(item => item.id));
		}
		assert.ok(observation.limitations.some(note => /no recursive, generic, indexed or inherited/u.test(note)));
		assert.ok(observation.limitations.some(note => /Dispatch is unmeasured/u.test(note)));
	}
	const modified = ["native-fin-python-ordinary-source"
		, "native-fin-ruby-ordinary-source", "reviewed-fin-python-scalar-containers"
		, "reviewed-fin-ruby-scalar-containers"];
	for(const [index, before] of previous.observations.entries())
	{
		const now = document.observations[index];
		if(!modified.includes(before.id))
		{ assert.deepEqual(now, before, before.id); continue; }
		for(const key of ["id", "profiles", "shapes", "positions", "path", "hostTypes"]) assert.deepEqual(now[key], before[key]);
		const selected = references.filter(item => item.profile === before.profiles[0] && item.sourcePath === before.path && item.family !== "record");
		for(const [name, stage] of Object.entries(now.stages))
		{
			assert.equal(stage.state, before.stages[name].state);
			assert.deepEqual(stage.evidence, [...before.stages[name].evidence, ...selected.map(item => item.id)]);
		}
	}
	const cells = typeSurfaceCells(document, contracts), old = typeSurfaceCells(previous, contracts);
	const changed = cells.filter((cell, index) => JSON.stringify(cell.stages) !== JSON.stringify(old[index].stages));
	assert.equal(changed.length, 12);
	assert.equal(changed.filter(cell => cell.position === "field").length, 4);
	for(const cell of changed)
	{
		assert.equal(cell.shape, "fin"); assert.ok(["python", "ruby"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
});
