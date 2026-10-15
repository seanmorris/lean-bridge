/**
 * Restrict nineteen-base nominal Perl claims to the installed input, result and field positions.
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
import { nominalPrimitiveSubtypePerlProducers } from "./nominal-primitive-subtype-perl-archive.mjs";
import { nominalPrimitiveSubtypePerlPromotionPredecessor } from "./nominal-primitive-subtype-perl-promotion-history.mjs";
import { nominalPrimitiveSubtypePerlReferences, promoteNominalPrimitiveSubtypePerl, nominalPrimitiveSubtypePerlProfiles, nominalPrimitiveSubtypePerlConversion, nominalPrimitiveSubtypePerlLimit, nominalPrimitiveSubtypePerlField } from "./nominal-primitive-subtype-perl-promotion.mjs";
import { beforeNominalPrimitiveSubtypeRubyPromotionSource } from "./nominal-primitive-subtype-ruby-promotion-history.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show", `${nominalPrimitiveSubtypePerlPromotionPredecessor}:docs/type-surface.v1.json`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
const abis = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];

test("primitive-base Perl promotion authenticates four installed selections on both source routes and all four ABIs", async () => {
	const references = await nominalPrimitiveSubtypePerlReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]]);
	assert.deepEqual(references.map(item => item.revision), [nominalPrimitiveSubtypePerlProducers[0], ...Array(3).fill(nominalPrimitiveSubtypePerlProducers[1])]);
	assert.deepEqual(references.map(item => item.counts.loadCeiling), [6, 8, 8, 12]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, nominalPrimitiveSubtypePerlProfiles);
		assert.equal(reference.revision, reference.counts.producerCommit);
		assert.equal(reference.sourcePath, reference.route === "ordinary" ? "ordinary-source" : "reviewed-ir");
		const full = reference.mode === "full";
		assert.deepEqual(reference.counts.counts, { checks: full ? 1225 : 587, rejections: full ? 283 : 0, rounds: 256, snapshotControls: 9, wordBits: 64 });
		assert.equal(reference.counts.executions, 16); assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(reference.counts.floor, "2.36");
		assert.deepEqual(reference.counts.configurations, abis); assert.deepEqual(reference.counts.deliveryModes, ["prebuilt-only", "build-xs"]);
		assert.equal(reference.counts.modelControls, full ? 43 : 24); assert.equal(reference.counts.packageControls, 48);
		assert.ok(reference.command.includes("--test-concurrency=1")); assert.ok(reference.command.includes("'/usr/bin/nice'"));
		assert.ok(reference.scope.includes(nominalPrimitiveSubtypePerlLimit));
		assert.ok(reference.scope.includes(`producer revision ${reference.revision} under a recorded host-load admission ceiling of ${reference.counts.loadCeiling}`));
		assert.equal(reference.artifacts.length, 2); assert.ok(reference.artifacts.every(item => item.path.endsWith(".tar.gz")));
		assert.equal(reference.files.filter(file => file.path.endsWith(".tar.gz")).length, 2);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			`sources/${reference.revision}/src/analyze/NativeExports.lean`
			, `sources/${reference.revision}/tests/fixtures/nominal-primitive-subtype-consumers/perl.pl`
			, `${label}/producer/run.tap`
			, `${label}/controls/controls.json`
			, `${label}/records/5.38.2-unthreaded/build-xs/repeated.json`
			, "checkers/provenance.mjs"
			, "runners/run-vo1493-nominal-primitive-perl-controls-e15acb5-load12.mjs"
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
		assert.ok(!reference.files.some(file => file.path.includes(`/sources/${nominalPrimitiveSubtypePerlProducers[reference.revision === nominalPrimitiveSubtypePerlProducers[0] ? 1 : 0]}/`)));
	}
});

test("primitive-base Perl promotion rejects narrowed references, new hosts and overlapping observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypePerlReferences();
	for(const changed of [references.slice(1), references.slice().reverse(), [...references, references[0]]])
		await assert.rejects(promoteNominalPrimitiveSubtypePerl(original, changed));
	for(const mutate of [
		item => { item.profiles.push("python"); }
		, item => { item.route = "reviewed"; }, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.dispatchObserved = true; }
		, item => { item.counts.counts.wordBits = 32; }
		, item => { item.counts.counts.checks = 1; }
		, item => { item.counts.executions = 8; }
		, item => { item.counts.loadCeiling = 12; }
		, item => { item.counts.configurations.pop(); }
		, item => { item.counts.deliveryModes.pop(); }
		, item => { item.counts.runtime.glibc = "2.38"; }
		, item => { item.counts.floor = "2.38"; }
		, item => { item.scope = "All Subtypes pass"; }
		, item => { item.command = "node --test"; }, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNominalPrimitiveSubtypePerl(original, changed));
	}
	const promoted = await promoteNominalPrimitiveSubtypePerl(original, references);
	await assert.rejects(promoteNominalPrimitiveSubtypePerl(promoted, references), /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item => item.id === "nominal-subtype-perl-fields-ordinary-source");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({ ...structuredClone(changed.observations[position]), id: "overlapping-field" });
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNominalPrimitiveSubtypePerl(changed, references), /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("primitive-base Perl promotion supplements six existing Perl cells and preserves all other observations", async () => {
	const original = predecessor(), references = await nominalPrimitiveSubtypePerlReferences();
	const proposed = await promoteNominalPrimitiveSubtypePerl(original, references);
	const { document: current, ...contracts } = await readTypeSurface();
	const document = JSON.parse(beforeNominalPrimitiveSubtypeRubyPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
	assert.ok(current.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4); assert.equal(proposed.observations.length, original.observations.length);
	assert.deepEqual(proposed.evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length), proposed.evidence.slice(original.evidence.length));
	const changedObservations = proposed.observations.filter((item, index) => JSON.stringify(item) !== JSON.stringify(original.observations[index]));
	assert.equal(changedObservations.length, 4);
	const before = typeSurfaceCells(original, contracts), after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "subtype"); assert.equal(cell.profile, "perl");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route).map(item => item.id);
		for(const [name, stage] of Object.entries(cell.stages))
		{
			assert.equal(stage.state, before[index].stages[name].state); assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id => id.startsWith("nominal-primitive-subtype-perl-")), ids);
			assert.ok(before[index].stages[name].evidence.every(id => stage.evidence.includes(id)));
		}
		assert.ok(cell.conversionNote.includes(nominalPrimitiveSubtypePerlConversion));
		if(cell.position === "field") assert.equal(cell.hostType, nominalPrimitiveSubtypePerlField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path => ["parameter", "result", "field"].map(position => `perl/subtype/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("primitive-base Perl docs name all nineteen bases without claiming pending host or callback matrices", async () => {
	for(const path of ["docs/consume/perl.md", "docs/javascript-typescript.md", "docs/lean/existing-package.md", "docs/lean/export-decisions.md", "docs/reference/types.md"])
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nominal-primitive-subtype-perl-20261015/index.json"), path);
		const compiled = await compileDocumentationPage(source, docPages.find(item => item.source === path), { revision: nominalPrimitiveSubtypePerlPromotionPredecessor });
		assert.ok(compiled.links.some(link => link.endsWith("nominal-primitive-subtype-perl-20261015/index.json")), path);
		if(path === "docs/consume/perl.md")
			assert.ok(compiled.links.includes("https://github.com/seanmorris/lean-bridge/actions/workflows/nominal-primitive-subtype-perl.yml"));
	}
	const perl = await readFile("docs/consume/perl.md", "utf8");
	for(const text of ["nineteen primitive bases", "64-bit", "normalization", "Linux x64/glibc 2.36", "prebuilt-only and build-xs", "a consistency check between"])
		assert.ok(perl.includes(text), text);
	assert.doesNotMatch(perl, /These nominal runs cover Nat payloads/u);
	assert.doesNotMatch(perl, /Other primitive-base nominal fixtures,\nrefined callbacks/u);
	const row = perl.split("\n").find(line => line.startsWith("| `Subtype /"));
	assert.ok(row.includes(nominalPrimitiveSubtypePerlField));
	for(const route of ["Ordinary source", "Reviewed IR"])
		assert.ok(row.includes(`${route}: Installed checks passed (input, result, field)`));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.ok(row.includes(nominalPrimitiveSubtypePerlConversion));
});
