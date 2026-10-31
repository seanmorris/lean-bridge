/**
 * Restrict nineteen-base nominal C# claims to installed input, result, and field positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypeDotnetPromotionHistoryPath, nominalPrimitiveSubtypeDotnetPromotionPredecessor } from "./nominal-primitive-subtype-dotnet-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { nominalPrimitiveSubtypeDotnetProducer } from "./nominal-primitive-subtype-dotnet-provenance.mjs";
import {
	nominalPrimitiveSubtypeDotnetConversion
	, nominalPrimitiveSubtypeDotnetField
	, nominalPrimitiveSubtypeDotnetLimit
	, nominalPrimitiveSubtypeDotnetProfiles
	, nominalPrimitiveSubtypeDotnetReferences
	, promoteNominalPrimitiveSubtypeDotnet
} from "./nominal-primitive-subtype-dotnet-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", [
	"show"
	, `${nominalPrimitiveSubtypeDotnetPromotionPredecessor}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base C# promotion authenticates four installed selections", async () => {
	const references = await nominalPrimitiveSubtypeDotnetReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision),
		Array(4).fill(nominalPrimitiveSubtypeDotnetProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeDotnetProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath,
			reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, {
			checks: full ? 1346 : 603, rejections: full ? 306 : 0
			, hostRejections: full ? 7 : 1, rounds: 256
			, snapshotControls: 30, wordBits: 64
		});
		assert.equal(reference.counts.executions, 3);
		assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime,
			{ platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.equal(reference.counts.toolchain.sdk.version, "8.0.424");
		assert.equal(reference.counts.framework.facts.version, "8.0.30");
		assert.equal(reference.counts.generatorModules, 18);
		assert.equal(reference.counts.modelControls, full ? 5 : 4);
		assert.equal(reference.counts.packageControls, 5);
		assert.equal(reference.counts.environmentControls, 28);
		assert.equal(reference.counts.executionControls, 30);
		assert.equal(reference.counts.recordControls, reference.counts.records * 2);
		assert.equal(reference.counts.loadCeiling, 8);
		assert.ok(reference.command.includes("LEAN_NUM_THREADS='1'"));
		assert.ok(reference.command.includes("'/usr/bin/nice'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypeDotnetLimit));
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.artifacts[0].path.endsWith(".nupkg"));
		assert.equal(reference.files.filter(file => file.path.endsWith(".nupkg")).length, 1);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/dotnet/copied-values.mjs"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/dotnet.cs"
			, `${label}/producer/start.json`, `${label}/producer/run.tap`
			, `${label}/producer/verification.json`
			, `${label}/records/consumer.cs`
			, `${label}/records/handoff/archives/Nominalprimitivesubtypes.Api.1.0.0.nupkg`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base C# promotion rejects narrowed references and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeDotnetReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeDotnet(original, changed));
	for(const mutate of [
		item => { item.profiles.push("python"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 2; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.toolchain.sdk.version = "8.0.100"; }
		, item => { item.counts.framework.facts.version = "8.0.0"; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeDotnet(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeDotnet(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeDotnet(promoted, references),
		/Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "nominal-subtype-dotnet-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlapping-field"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeDotnet(changed, references),
			/Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base C# promotion supplements six cells and preserves all others", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeDotnetReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath
		, await promoteNominalPrimitiveSubtypeDotnet(original, references)
	);
	const { document: live } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(
		nominalPrimitiveSubtypeDotnetPromotionPredecessor
	);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length),
		proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "dotnet");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state);
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nominal-primitive-subtype-dotnet-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeDotnetConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeDotnetField);
		else assert.equal(cell.hostType, before[index].hostType);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"]
			.map(position => `dotnet/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base C# docs name all nineteen bases without claiming callbacks", async () => {
	for(const path of ["docs/consume/dotnet.md", "docs/javascript-typescript.md"
		, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
		, "docs/reference/types.md"]){
		const source = sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeDotnetPromotionHistoryPath, path
		);
		assert.ok(source.includes("nominal-primitive-subtype-dotnet-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source,
			docPages.find(item => item.source === path)
			, { revision: nominalPrimitiveSubtypeDotnetPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nominal-primitive-subtype-dotnet-20261015/index.json")), path);
		if(path === "docs/consume/dotnet.md")
			assert.ok(compiled.links.includes(
				"https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-dotnet.yml"
			));
		}
	const dotnet = sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath, "docs/consume/dotnet.md"
	);
	for(const text of ["all nineteen primitive bases", "64-bit", "normalization"
		, "Linux x64/glibc 2.36", ".NET SDK 8.0.424", "shared framework 8.0.30"
		, "standalone result-only"])
		assert.ok(dotnet.includes(text), text);
	const row = dotnet.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypeDotnetField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypeDotnetConversion));
});
