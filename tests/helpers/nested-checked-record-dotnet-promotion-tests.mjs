/**
 * Restrict nested checked-record C# claims to installed copied positions.
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
import { nestedCheckedRecordDotnetPromotionHistoryPath, nestedCheckedRecordDotnetPromotionPredecessor } from "./nested-checked-record-dotnet-promotion-history.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { bytesAtFinHistoryRecordSource } from "./source-at-fin-history-milestone.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordDotnetProducer } from "./nested-checked-record-dotnet-provenance.mjs";
import {
	nestedCheckedRecordDotnetConversion
	, nestedCheckedRecordDotnetField
	, nestedCheckedRecordDotnetLimit
	, nestedCheckedRecordDotnetProfiles
	, nestedCheckedRecordDotnetReferences
	, promoteNestedCheckedRecordDotnet
} from "./nested-checked-record-dotnet-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", [
	"show"
	, `${nestedCheckedRecordDotnetPromotionPredecessor}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nested checked-record C# promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordDotnetReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision),
		Array(4).fill(nestedCheckedRecordDotnetProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nestedCheckedRecordDotnetProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath,
			reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, {
			checks: full ? 3924 : 1290, rejections: full ? 524 : 0
			, hostRejections: full ? 7 : 4
			, recoveries: full ? 528 : 1
			, snapshots: full ? 1054 : 1
			, rounds: 256, wordBits: 64
		});
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
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
		assert.equal(reference.counts.loadCeiling, 10);
		assert.ok(reference.command.includes("LEAN_NUM_THREADS='1'"));
		assert.ok(reference.command.includes("'/usr/bin/nice'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'"));
		assert.ok(reference.scope.includes(nestedCheckedRecordDotnetLimit));
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.artifacts[0].path.endsWith(".nupkg"));
		assert.equal(reference.files.filter(file => file.path.endsWith(".nupkg")).length, 1);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/dotnet/copied-values.mjs"
			, "sources/tests/fixtures/nested-checked-record-consumers/dotnet.cs"
			, `${label}/producer/start.json`, `${label}/producer/run.tap`
			, `${label}/producer/verification.json`
			, `${label}/records/consumer.cs`
			, `${label}/records/handoff/archives/Nestedcheckedrecords.Api.1.0.0.nupkg`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record C# promotion rejects narrowed references and overlapping observations", async () => {
	const original = predecessor(), references = await nestedCheckedRecordDotnetReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordDotnet(original, changed));
	for(const mutate of [
		item => { item.profiles.push("python"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.positions = ["result"]; }
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
		, item => { item.scope = "All checked records pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNestedCheckedRecordDotnet(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordDotnet(original, references);
	await assert.rejects(promoteNestedCheckedRecordDotnet(promoted, references),
		/Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item =>
		item.id !== "checked-record-native-dotnet-ordinary-source-parameter");
	await assert.rejects(promoteNestedCheckedRecordDotnet(missing, references)
		, /Missing or overlapping/u);
	const overlap = structuredClone(original);
	overlap.observations.push({
		...structuredClone(original.observations.find(item =>
			item.id === "checked-record-native-dotnet-ordinary-source-parameter"))
		, id: "overlapping-field", positions: ["field"]
	});
	await assert.rejects(promoteNestedCheckedRecordDotnet(overlap, references)
		, /Overlapping/u);
	assert.deepEqual(original, predecessor());
});

test("nested checked-record C# promotion supplements six cells and preserves all others", async () => {
	const original = predecessor(), references = await nestedCheckedRecordDotnetReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordDotnetPromotionHistoryPath
		, await promoteNestedCheckedRecordDotnet(original, references)
	);
	const { document: live } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(nestedCheckedRecordDotnetPromotionPredecessor);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordDotnetPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordDotnetPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length),
		proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) =>
		JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 6);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record"); assert.equal(cell.profile, "dotnet");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& (cell.position === "result" || item.mode === "full"))
			.map(item => item.id);
		const prior = before.find(item => item.id === cell.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-dotnet-")), ids);
			if(prior) assert.ok(prior.stages[name].evidence.every(id =>
				stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordDotnetConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nestedCheckedRecordDotnetField);
		else assert.equal(cell.hostType, prior.hostType);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"]
			.map(position => `dotnet/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record C# docs state the installed and open boundary", async () => {
	for(const path of ["docs/consume/dotnet.md"
		, "docs/evidence/nested-checked-record-dotnet-20261016.md"
		, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
		, "docs/reference/types.md"]){
		const source = (await bytesAtFinHistoryRecordSource(
			nestedCheckedRecordDotnetPromotionHistoryPath, path
		)).toString();
		assert.ok(source.includes("nested-checked-record-dotnet-20261016/index.json"), path);
		const page = docPages.find(item => item.source === path);
		if(page)
		{
			const compiled = await compileDocumentationPage(source, page
				, { revision: nestedCheckedRecordDotnetPromotionPredecessor });
			assert.ok(compiled.links.some(link =>
				link.endsWith("nested-checked-record-dotnet-20261016/index.json")), path);
		}
		if(path === "docs/consume/dotnet.md")
			assert.ok(source.includes(
				"https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-dotnet.yml"
			));
		}
	const dotnet = await readFile("docs/consume/dotnet.md", "utf8");
	for(const text of ["Fin 10", "checked `Nat` subtype", "arrays", "Lists"
		, "options", "tuples", "`Result`", "record fields", "variant fields", "64-bit"
		, "Linux x64/glibc 2.36", ".NET SDK 8.0.424", "shared framework 8.0.30"
		, "standalone result-only"])
		assert.ok(dotnet.includes(text), text);
	// Later callback promotions broaden the live row. Keep this milestone's
	// three-position boundary tied to its authenticated documentation.
	const milestone = sourceAtHistoryMilestone(
		nestedCheckedRecordDotnetPromotionHistoryPath, "docs/consume/dotnet.md");
	const row = milestone.split("\n").find(line =>
		line.startsWith("| `Checked record"));
	assert.ok(row.includes(nestedCheckedRecordDotnetField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nestedCheckedRecordDotnetConversion));
	assert.ok(dotnet.includes(nestedCheckedRecordDotnetConversion));
	assert.ok(dotnet.includes(nestedCheckedRecordDotnetField));
});
