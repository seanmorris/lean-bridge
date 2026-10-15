/**
 * Restrict nineteen-base nominal C/C++ claims to the installed input, result and field positions.
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
import { nominalPrimitiveSubtypeNativeProducer } from "./nominal-primitive-subtype-native-archive.mjs";
import { nominalPrimitiveSubtypeNativePromotionPredecessor } from "./nominal-primitive-subtype-native-promotion-history.mjs";
import { nominalPrimitiveSubtypeNativeReferences, promoteNominalPrimitiveSubtypeNative, nominalPrimitiveSubtypeNativeProfiles, nominalPrimitiveSubtypeNativeConversion, nominalPrimitiveSubtypeNativeLimit, nominalPrimitiveSubtypeNativeField } from "./nominal-primitive-subtype-native-promotion.mjs";
import { beforeNominalPrimitiveSubtypeRubyPromotionSource, beforePrimitiveSubtypeRubyPromotionPins } from "./nominal-primitive-subtype-ruby-promotion-history.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeNativePromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base Native promotion authenticates four installed selections on both public native projections", async () => {
	const references = await nominalPrimitiveSubtypeNativeReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeNativeProfiles);
		assert.equal(reference.revision, nominalPrimitiveSubtypeNativeProducer);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts.c, { checks: full ? 3714 : 583, rejections: full ? 306 : 0, rounds: 256, snapshotControls: 22, wordBits: 64 });
		assert.deepEqual(reference.counts.counts.cpp, { checks: full ? 1314 : 579, rejections: full ? 306 : 0, rounds: 256, snapshotControls: 9, wordBits: 64 });
		assert.equal(reference.counts.initialExecutions, 2);
		assert.equal(reference.counts.executions, 4); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36"); assert.deepEqual(reference.counts.profiles, ["c", "cpp"]);
		assert.ok(reference.command.includes("--test-concurrency=1")); assert.ok(reference.scope.includes(nominalPrimitiveSubtypeNativeLimit));
		assert.equal(reference.artifacts.length, 2); assert.ok(reference.artifacts.every(item => item.path.endsWith(".tar.gz")));
		assert.equal(reference.files.filter(file => file.path.endsWith(".tar.gz")).length, 2);
		for(const suffix of ["sources/src/analyze/NativeExports.lean", "sources/tests/fixtures/nominal-primitive-subtype-consumers/c.c", "sources/tests/fixtures/nominal-primitive-subtype-consumers/cpp.cpp", "records/c/installed.json", "records/cpp/relocated.json", "process-capture.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base Native promotion rejects narrowed references, new hosts and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeNativeReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeNative(original, changed));
	for(const mutate of [
		item => { item.profiles.push("ruby"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.c.wordBits = 32; }
		, item => { item.counts.counts.cpp.checks = 1; }
		, item => { item.counts.executions = 2; }
		, item => { item.counts.profiles.pop(); }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeNative(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeNative(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeNative(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-native-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeNative(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base Native promotion supplements twelve existing C/C++ cells and preserves all other observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeNativeReferences();
	const proposed = beforePrimitiveSubtypeRubyPromotionPins(await promoteNominalPrimitiveSubtypeNative(original, references));
	const { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalPrimitiveSubtypeRubyPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.ok(current.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, 536); assert.equal(proposed.observations.length, 595);
	assert.deepEqual(proposed.evidence.slice(0, 532), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(532), proposed.evidence.slice(532));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.ok(["c", "cpp"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-native-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeNativeConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeNativeField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["c", "cpp"].flatMap(profile => ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `${profile}/subtype/${path}/${position}`))).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base Native docs name all nineteen bases without claiming pending host or callback matrices", async () => {
	for(const path of ["docs/consume/c.md", "docs/consume/cpp.md", "docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nominal-primitive-subtype-native-20261014/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeNativePromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-native-20261014/index.json")), path);
		if(["docs/consume/c.md", "docs/consume/cpp.md"].includes(path))
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-native.yml"));
	}
	for(const path of ["docs/consume/c.md", "docs/consume/cpp.md"])
	{
		const native = await readFile(path, "utf8");
		for(const text of ["nineteen primitive bases", "64-bit", "normalization", "Linux x64/glibc 2.36"])
			assert.ok(native.includes(text), text);
		assert.doesNotMatch(native, /Other primitive-base nominal fixtures, refined callbacks/u);
		const row = native.split("\n").find(line => line.startsWith("| `Subtype /"));
		assert.ok(row.includes(nominalPrimitiveSubtypeNativeField));
		for(const route of ["Ordinary source", "Reviewed IR"])
			assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
		assert.ok(row.includes("Not audited (callback input, callback result)"));
		assert.ok(row.includes(nominalPrimitiveSubtypeNativeConversion));
	}
});
