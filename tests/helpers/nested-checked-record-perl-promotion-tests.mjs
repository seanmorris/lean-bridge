/**
 * Restrict nested checked-record Perl claims to installed positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	readTypeSurface, typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import { compileDocumentationPage } from "../../scripts/generate-site-content.mjs";
import { docPages } from "../../site/registry.mjs";
import {
	checkedRecordPerlConversion, checkedRecordPerlLimit
} from "./checked-record-perl-promotion.mjs";
import {
	nestedCheckedRecordPerlPromotionHistoryPath
	, nestedCheckedRecordPerlPromotionPredecessor
} from "./nested-checked-record-perl-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordPerlProducer } from "./nested-checked-record-perl-provenance.mjs";
import {
	nestedCheckedRecordPerlConversion
	, nestedCheckedRecordPerlField
	, nestedCheckedRecordPerlGeneratorAfter
	, nestedCheckedRecordPerlGeneratorBefore
	, nestedCheckedRecordPerlGeneratorPath
	, nestedCheckedRecordPerlGeneratorPins
	, nestedCheckedRecordPerlLimit
	, nestedCheckedRecordPerlProfiles
	, nestedCheckedRecordPerlReferences
	, promoteNestedCheckedRecordPerl
} from "./nested-checked-record-perl-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordPerlPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record Perl promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordPerlReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordPerlProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordPerlProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 4762 : 1571);
		assert.equal(reference.counts.rejections, full ? 524 : 0);
		assert.equal(reference.counts.hostRejections, full ? 4 : 1);
		assert.equal(reference.counts.recoveries, full ? 528 : 1);
		assert.equal(reference.counts.snapshots, full ? 1060 : 520);
		assert.equal(reference.counts.executions, 16);
		assert.equal(reference.counts.records
			, reference.route === "ordinary" ? 108 : 110);
		assert.deepEqual(reference.counts.installModes
			, ["prebuilt-only", "build-xs"]);
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes("'--test-name-pattern="));
		assert.ok(reference.scope.includes(nestedCheckedRecordPerlLimit));
		assert.equal(reference.artifacts.length, 2);
		for(const suffix of [
			"sources/src/backends/perl/generate.mjs"
			, "sources/tests/fixtures/nested-checked-record-consumers/perl.pl"
			, `${reference.route}-${reference.mode}/producer/run.tap`
			, `${reference.route}-${reference.mode}/records/consumer.pl`
			, `${reference.route}-${reference.mode}/records/report.json`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record Perl promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nestedCheckedRecordPerlReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordPerl(original, changed));
	for(const mutate of [
		item => { item.profiles.push("c"); }
		, item => { item.route = "reviewed"; }
		, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.checks = 1; }
		, item => { item.scope = "All checked records pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNestedCheckedRecordPerl(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordPerl(original, references);
	await assert.rejects(promoteNestedCheckedRecordPerl(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-perl-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlapping-parameter"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordPerl(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record Perl promotion supplements six cells only", async () => {
	const original = predecessor(), references = await nestedCheckedRecordPerlReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordPerlPromotionHistoryPath
		, await promoteNestedCheckedRecordPerl(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordPerlPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	const priorEvidence = structuredClone(
		proposed.evidence.slice(0, original.evidence.length)
	);
	let generatorPins = 0;
	for(const entry of priorEvidence) for(const file of entry.files)
		if(file.path === nestedCheckedRecordPerlGeneratorPath)
		{
			assert.equal(file.sha256, nestedCheckedRecordPerlGeneratorAfter);
			generatorPins++;
		}
	assert.equal(generatorPins, nestedCheckedRecordPerlGeneratorPins);
	const predecessorEvidence = withHistorySourcePins(
		nestedCheckedRecordPerlPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length);
	let predecessorGeneratorPins = 0;
	for(const entry of predecessorEvidence) for(const file of entry.files)
		if(file.path === nestedCheckedRecordPerlGeneratorPath)
		{
			assert.equal(file.sha256, nestedCheckedRecordPerlGeneratorBefore);
			predecessorGeneratorPins++;
		}
	assert.equal(predecessorGeneratorPins, nestedCheckedRecordPerlGeneratorPins);
	assert.deepEqual(predecessorEvidence, original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length)
		, proposed.evidence.slice(original.evidence.length));
	const changedExisting = proposed.observations.slice(0, original.observations.length)
		.filter((item, index) => JSON.stringify(item)
			!== JSON.stringify(original.observations[index]));
	assert.deepEqual(changedExisting.map(item => item.id).sort(), [
		"checked-record-perl-ordinary-source-parameter"
		, "checked-record-perl-ordinary-source-result"
		, "checked-record-perl-reviewed-ir-parameter"
		, "checked-record-perl-reviewed-ir-result"
	]);
	const added = proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort();
	assert.deepEqual(added, [
		"nested-checked-record-perl-ordinary-source-field"
		, "nested-checked-record-perl-reviewed-ir-field"
	]);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "perl"); assert.equal(cell.shape, "checked-record");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-perl-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordPerlConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordPerlConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordPerlLimit));
		assert.ok(!cell.limitations.includes(checkedRecordPerlLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordPerlField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path =>
		["parameter", "result", "field"].map(position =>
			`perl/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record Perl docs name the accepted boundary", async () => {
	const pages = ["docs/consume/perl.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"];
	for(const path of pages)
	{
		const source = sourceAtHistoryMilestone(
			nestedCheckedRecordPerlPromotionHistoryPath, path
		);
		assert.ok(source.includes("nested-checked-record-perl-20261016/index.json"), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordPerlPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-perl-20261016/index.json")), path);
		if(path === "docs/consume/perl.md") assert.ok(compiled.links.includes(
			"https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-perl.yml"));
	}
	const guide = sourceAtHistoryMilestone(
		nestedCheckedRecordPerlPromotionHistoryPath, "docs/consume/perl.md"
	);
	for(const text of ["nested `Packet`", "Perl 5.36.3 and 5.38.2"
		, "Linux x64/glibc 2.36", "source-free", "sixteen installed executions"])
		assert.ok(guide.includes(text), text);
	const row = guide.split("\n").find(line => line.startsWith("| `Checked record"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.includes(nestedCheckedRecordPerlConversion));
});
