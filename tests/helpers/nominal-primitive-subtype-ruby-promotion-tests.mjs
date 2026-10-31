/**
 * Restrict nineteen-base nominal Ruby claims to the installed input, result and field positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readTypeSurface, typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import { nominalPrimitiveSubtypeRubyProducer } from "./nominal-primitive-subtype-ruby-provenance.mjs";
import { nominalPrimitiveSubtypeRubyPromotionHistoryPath, nominalPrimitiveSubtypeRubyPromotionPredecessor } from "./nominal-primitive-subtype-ruby-promotion-history.mjs";
import {
	nominalPrimitiveSubtypeRubyConversion
	, nominalPrimitiveSubtypeRubyField
	, nominalPrimitiveSubtypeRubyLimit
	, nominalPrimitiveSubtypeRubyProfiles
	, nominalPrimitiveSubtypeRubyReferences
	, promoteNominalPrimitiveSubtypeRuby
} from "./nominal-primitive-subtype-ruby-promotion.mjs";
import { sourceAtHistoryMilestone, withHistoryMilestoneSourcePins, withHistorySourcePins } from "./source-history-test-source.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypeRubyPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("primitive-base Ruby promotion authenticates four installed selections on both source routes", async () => {
	const references = await nominalPrimitiveSubtypeRubyReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	assert.deepEqual(references.map(item => item.revision), Array(4).fill(nominalPrimitiveSubtypeRubyProducer));
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypeRubyProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, { checks: full ? 1664 : 875, rejections: full ? 306 : 0, rounds: 256, snapshotControls: 12, wordBits: 64 });
		assert.equal(reference.counts.executions, 2); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36"); assert.equal(reference.counts.rubyVersion, "3.3.12");
		assert.equal(reference.counts.generatorModules, 19); assert.equal(reference.counts.modelControls, full ? 42 : 23);
		assert.equal(reference.counts.packageControls, 4); assert.equal(reference.counts.environmentControls, 12);
		assert.equal(reference.counts.executionControls, 20); assert.equal(reference.counts.recordControls, reference.counts.records * 2);
		assert.equal(reference.counts.loadCeiling, 8);
		assert.ok(reference.command.includes("--test-concurrency=1")); assert.ok(reference.command.includes("'/usr/bin/nice'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypeRubyLimit));
		assert.equal(reference.artifacts.length, 1); assert.ok(reference.artifacts[0].path.endsWith(".gem"));
		assert.equal(reference.files.filter(file => file.path.endsWith(".gem")).length, 1);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/analyze/NativeExports.lean"
			, "sources/tests/fixtures/nominal-primitive-subtype-consumers/ruby.rb"
			, `${label}/producer/run.tap`
			, `${label}/controls/controls.json`
			, `${label}/records/consumer.rb`
			, "checkers/provenance.mjs"
			, "runners/run-vo1492-nominal-primitive-ruby-controls-aaadc4f.mjs"
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("primitive-base Ruby promotion rejects narrowed references, new hosts and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeRubyReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypeRuby(original, changed));
	for(const mutate of [
		item => { item.profiles.push("python"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 1; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.counts.rubyVersion = "3.2.0"; }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypeRuby(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypeRuby(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypeRuby(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-ruby-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypeRuby(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base Ruby promotion supplements six existing Ruby cells and preserves all other observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypeRubyReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypeRubyPromotionHistoryPath
		, await promoteNominalPrimitiveSubtypeRuby(original, references)
	);
	const { document: current } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(
		nominalPrimitiveSubtypeRubyPromotionPredecessor
	);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeRubyPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(current.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4); assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(withHistorySourcePins(
		nominalPrimitiveSubtypeRubyPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length), proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "ruby");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-ruby-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypeRubyConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypeRubyField);
		else assert.equal(cell.hostType, before[index].hostType);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `ruby/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base Ruby docs name all nineteen bases without claiming pending host or callback matrices", async () => {
	for(const path of ["docs/consume/ruby.md", "docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeRubyPromotionHistoryPath, path
		);
		assert.ok(source.includes("nominal-primitive-subtype-ruby-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypeRubyPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-ruby-20261015/index.json")), path);
		if(path === "docs/consume/ruby.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-ruby.yml"));
	}
	const ruby = sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeRubyPromotionHistoryPath, "docs/consume/ruby.md"
	);
	for(const text of ["all nineteen primitive bases", "64-bit", "normalization", "Linux x64/glibc 2.36", "MRI Ruby 3.3.12", "standalone result-only"])
		assert.ok(ruby.includes(text), text);
	assert.doesNotMatch(ruby, /cover Nat fields, aliases, mixed Fin guards and constructor-free results\. Other primitive-base/u);
	const row = ruby.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypeRubyField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypeRubyConversion));
});
