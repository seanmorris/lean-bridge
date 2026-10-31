/**
 * Restrict nineteen-base nominal WIT claims to installed positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { beforeNominalPrimitiveSubtypeJvmPromotionPins } from "./nominal-primitive-subtype-jvm-promotion-history.mjs";
import { nominalPrimitiveSubtypeWitPromotionHistoryPath, nominalPrimitiveSubtypeWitPromotionPredecessor } from "./nominal-primitive-subtype-wit-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { nominalPrimitiveSubtypeWitProducer } from "./nominal-primitive-subtype-wit-provenance.mjs";
import {
	nominalPrimitiveSubtypeWitConversion
	, nominalPrimitiveSubtypeWitField
	, nominalPrimitiveSubtypeWitLimit
	, nominalPrimitiveSubtypeWitParameter
	, nominalPrimitiveSubtypeWitProfiles
	, nominalPrimitiveSubtypeWitReferences
	, nominalPrimitiveSubtypeWitResult
	, promoteNominalPrimitiveSubtypeWit
} from "./nominal-primitive-subtype-wit-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeWitPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base WIT promotion authenticates four installed selections", async () => {
	const references = await nominalPrimitiveSubtypeWitReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision), Array(4).fill(nominalPrimitiveSubtypeWitProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeWitProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, {
			checks: full ? 3114 : 5584, hostRejections: full ? 22 : 14
			, rejections: full ? 308 : 0, rounds: 256, snapshotControls: 22, wordBits: 64
		});
		assert.equal(reference.counts.attempt, "r1"); assert.equal(reference.counts.loadCeiling, 8);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.deepEqual(reference.counts.tools, {
			cc: "/usr/bin/cc", wasmtime: "42.0.1"
			, wasmTools: "/app/.toolchains/wasm-tools/bin/wasm-tools"
		});
		assert.equal(reference.counts.executionControls, 24); assert.equal(reference.counts.toolControls, 12);
		assert.equal(reference.counts.resourceControls, 4); assert.equal(reference.counts.environmentControls, 15);
		assert.equal(reference.counts.packageControls, 5); assert.equal(reference.counts.modelControls, full ? 6 : 5);
		assert.equal(reference.counts.recordControls, reference.route === "ordinary" ? 180 : 184);
		assert.match(reference.counts.archiveSha256, /^[a-f0-9]{64}$/u);
		assert.ok(reference.command.includes("LEAN_BRIDGE_WASMTIME_C_API='/app/.toolchains/wasmtime42'"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'")); assert.ok(reference.command.includes("'/usr/bin/nice'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypeWitLimit));
		assert.equal(reference.artifacts.length, 1); assert.ok(reference.artifacts[0].path.endsWith("nominalprimitivesubtypes-1.0.0-wit-wasi.tar.gz"));
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/wit/copied-model.mjs"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/wit-wasi.c"
			, "checkers/report.mjs", "checkers/provenance.mjs"
			, "runners/run-vo1498-nominal-primitive-wit-controls-88cf601.mjs"
			, `${label}/producer/run.tap`, `${label}/controls/controls.json`
			, `${label}/records/consumer.c`, `${label}/records/report.json`
			, `${label}/records/package/component/nominalprimitivesubtypes.wasm`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base WIT promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeWitReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeWit(original, changed));
	for(const mutate of [
		item => { item.profiles.push("c"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.tools.wasmtime = "0.0.0"; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeWit(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeWit(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeWit(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-wit-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeWit(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base WIT promotion supplements six cells only", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeWitReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeWitPromotionHistoryPath
		, beforeNominalPrimitiveSubtypeJvmPromotionPins(
			await promoteNominalPrimitiveSubtypeWit(original, references)));
	const { document: published } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(
		nominalPrimitiveSubtypeWitPromotionPredecessor
	);
	validateTypeSurface(proposed, contracts);
	const inventoryPath = "docs/type-surface.v1.json";
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeWitPromotionHistoryPath, inventoryPath
	));
	assert.deepEqual(published.evidence.slice(0, document.evidence.length).map(entry => entry.id)
		, document.evidence.map(entry => entry.id));
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypeWitPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length), proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "wit-wasi");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-wit-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeWitConversion));
		assert.equal(cell.hostType, {
			parameter: nominalPrimitiveSubtypeWitParameter
			, result: nominalPrimitiveSubtypeWitResult
			, field: nominalPrimitiveSubtypeWitField
		}[cell.position]);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `wit-wasi/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base WIT docs name the accepted boundary", async () => {
	for(const path of ["docs/consume/wit-wasi.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeWitPromotionHistoryPath, path
		);
		assert.ok(source.includes("nominal-primitive-subtype-wit-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeWitPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-wit-20261015/index.json")), path);
		if(path === "docs/consume/wit-wasi.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-wit.yml"));
	}
	const wit = sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeWitPromotionHistoryPath, "docs/consume/wit-wasi.md"
	);
	for(const text of ["all nineteen primitive bases", "64-bit", "normalization", "Wasmtime 42.0.1", "wasm-tools 1.245.1", "Linux x64/glibc 2.36", "standalone result-only", "load-admission ceiling of 8"])
		assert.ok(wit.includes(text), text);
	assert.doesNotMatch(wit, /Other primitive-base nominal fixtures, refined callbacks, owned values,\nrecursive graphs and broader generic combinations remain separate work\./u);
	const row = wit.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypeWitField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypeWitConversion));
});
