/**
 * Restrict nineteen-base nominal Python claims to the installed input, result and field positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypePythonProducer } from "./nominal-primitive-subtype-python-archive.mjs";
import { nominalPrimitiveSubtypePythonPromotionPredecessor } from "./nominal-primitive-subtype-python-promotion-history.mjs";
import { nominalPrimitiveSubtypePythonReferences, promoteNominalPrimitiveSubtypePython, nominalPrimitiveSubtypePythonProfiles, nominalPrimitiveSubtypePythonConversion, nominalPrimitiveSubtypePythonLimit, nominalPrimitiveSubtypePythonField } from "./nominal-primitive-subtype-python-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypePythonPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base Python promotion authenticates four installed selections on both interpreter floors", async () => {
	const references = await nominalPrimitiveSubtypePythonReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypePythonProfiles);
		assert.equal(reference.revision, nominalPrimitiveSubtypePythonProducer);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.counts.checks, reference.mode === "full" ? 1225 : 587);
		assert.equal(reference.counts.counts.rejections, reference.mode === "full" ? 283 : 0);
		assert.equal(reference.counts.counts.rounds, 256); assert.equal(reference.counts.counts.snapshotControls, 9);
		assert.equal(reference.counts.counts.wordBits, 64);
		assert.equal(reference.counts.executions, 4); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36"); assert.deepEqual(reference.counts.minors, ["3.11", "3.12"]);
		assert.ok(reference.command.includes("--test-concurrency=1")); assert.ok(reference.scope.includes(nominalPrimitiveSubtypePythonLimit));
		assert.equal(reference.artifacts.length, 1); assert.ok(reference.artifacts[0].path.endsWith(".whl"));
		assert.equal(reference.files.filter(file => file.path.endsWith(".whl")).length, 1);
		for(const suffix of ["sources/src/analyze/NativeExports.lean", "sources/tests/fixtures/nominal-primitive-subtype-consumers/python.py", "records/3.11/baseline.json", "records/3.12/relocated-process.json"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base Python promotion rejects narrowed references, new hosts and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypePythonReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypePython(original, changed));
	for(const mutate of [
		item => { item.profiles.push("ruby"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 2; }
		, item => { item.counts.minors.pop(); }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypePython(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypePython(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypePython(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-python-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypePython(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base Python promotion supplements six existing Python cells and preserves all other observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypePythonReferences();
	const proposed = await promoteNominalPrimitiveSubtypePython(original, references), { document, ...contracts } = await readTypeSurface();
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, 528); assert.equal(proposed.observations.length, 595);
	assert.deepEqual(proposed.evidence.slice(0, 524), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(524), proposed.evidence.slice(524));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "python");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-python-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypePythonConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypePythonField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `python/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base Python docs name all nineteen bases without claiming pending host or callback matrices", async () => {
	for(const path of ["docs/consume/python.md", "docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nominal-primitive-subtype-python-20261014/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypePythonPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-python-20261014/index.json")), path);
		if(path === "docs/consume/python.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-python.yml"));
	}
	const python = await readFile("docs/consume/python.md", "utf8");
	for(const text of ["nineteen primitive bases", "None", "bool", "int", "float", "str", "bytes", "64-bit", "normalization", "Linux x64/glibc 2.36"])
		assert.ok(python.includes(text), text);
	assert.doesNotMatch(python, /Other primitive-base nominal fixtures, refined callbacks/u);
	const row = python.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypePythonField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypePythonConversion));
});
