/**
 * Restrict nineteen-base nominal support to the observed Node input, result and field positions.
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
import { nominalPrimitiveSubtypeNpmProducer } from "./nominal-primitive-subtype-npm-archive.mjs";
import { beforeNominalPrimitiveSubtypePythonPromotionSource, beforeNominalPrimitiveSubtypePythonPromotionPins } from "./nominal-primitive-subtype-python-promotion-history.mjs";
import { nominalPrimitiveSubtypeNpmPromotionPredecessor } from "./nominal-primitive-subtype-npm-promotion-history.mjs";
import { nominalPrimitiveSubtypeNpmReferences, promoteNominalPrimitiveSubtypeNpm, nominalPrimitiveSubtypeNpmProfiles, nominalPrimitiveSubtypeNpmConversion, nominalPrimitiveSubtypeNpmLimit, nominalPrimitiveSubtypeNpmField } from "./nominal-primitive-subtype-npm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeNpmPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base npm promotion authenticates all four original Node selections", async () => {
	const references = await nominalPrimitiveSubtypeNpmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeNpmProfiles);
		assert.equal(reference.revision, nominalPrimitiveSubtypeNpmProducer);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, reference.mode === "full" ? 1213 : 578);
		assert.equal(reference.counts.rejections, reference.mode === "full" ? 283 : 0);
		assert.equal(reference.counts.executions, 2); assert.equal(reference.counts.dispatchObserved, false);
		assert.equal(reference.counts.wordBits, 32);
		assert.deepEqual(reference.counts.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.ok(reference.command.includes("--test-concurrency=1")); assert.ok(reference.scope.includes(nominalPrimitiveSubtypeNpmLimit));
		assert.equal(reference.artifacts.length, 2);
		assert.equal(reference.files.filter(file => file.path.endsWith(".tgz")).length, 2);
		assert.ok(reference.files.some(file => file.path.endsWith("runtime/main.wasm")));
		assert.ok(reference.files.some(file => file.path.endsWith("sources/src/analyze/NativeExports.lean")));
	}
});

test("primitive-base npm promotion rejects narrowed references, new hosts and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeNpmReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeNpm(original, changed));
	for(const mutate of [
		item => { item.profiles.push("browser-javascript"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.wordBits = 64; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeNpm(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeNpm(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeNpm(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-npm-fields-ordinary-source");
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeNpm(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base npm promotion supplements twelve existing Node cells and preserves all other observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeNpmReferences();
	const proposed = beforeNominalPrimitiveSubtypePythonPromotionPins(await promoteNominalPrimitiveSubtypeNpm(original, references));
	const { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalPrimitiveSubtypePythonPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.ok(current.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, 524); assert.equal(proposed.observations.length, 595);
	assert.deepEqual(proposed.evidence.slice(0, 520), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(520), proposed.evidence.slice(520));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(nominalPrimitiveSubtypeNpmProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-npm-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeNpmConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeNpmField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), nominalPrimitiveSubtypeNpmProfiles.flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`))).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base npm docs name the nineteen Node bases without claiming the pending host matrices", async () => {
	for(const path of ["docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nominal-primitive-subtype-npm-20261014/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeNpmPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-npm-20261014/index.json")), path);
		if(path === "docs/javascript-typescript.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-npm.yml"));
	}
	const javascript = beforeNominalPrimitiveSubtypePythonPromotionSource("docs/javascript-typescript.md", await readFile("docs/javascript-typescript.md", "utf8"));
	for(const text of ["nineteen primitive bases", "undefined", "void", "wasm32", "normalization"])
		assert.ok(javascript.includes(text), text);
	assert.doesNotMatch(javascript, /Other primitive-base nominal fixtures and callback/u);
	assert.ok(javascript.includes("Primitive-base nominal acceptance in other hosts"));
	const row = javascript.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypeNpmField));
	assert.ok(row.includes("Browser / React / Worker"));
	assert.ok(row.includes("bigint Nat payload"));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
});
