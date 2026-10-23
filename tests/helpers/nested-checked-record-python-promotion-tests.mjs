/**
 * Restrict nested checked-record Python claims to installed wheel positions.
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
	checkedRecordNativeConversion, checkedRecordNativeLimit
} from "./checked-record-native-promotion.mjs";
import {
	nestedCheckedRecordPythonPromotionHistoryPath
	, nestedCheckedRecordPythonPromotionPredecessor
} from "./nested-checked-record-python-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordPythonProducer } from "./nested-checked-record-python-provenance.mjs";
import {
	nestedCheckedRecordPythonConversion
	, nestedCheckedRecordPythonField
	, nestedCheckedRecordPythonLimit
	, nestedCheckedRecordPythonProfiles
	, nestedCheckedRecordPythonReferences
	, promoteNestedCheckedRecordPython
} from "./nested-checked-record-python-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordPythonPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record Python promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordPythonReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordPythonProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordPythonProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 3704 : 1057);
		assert.equal(reference.counts.rejections, full ? 525 : 0);
		assert.equal(reference.counts.hostRejections, full ? 15 : 4);
		assert.equal(reference.counts.recoveries, full ? 256 : 0);
		assert.equal(reference.counts.snapshots, full ? 1840 : 518);
		assert.equal(reference.counts.snapshotControls, full ? 11 : 8);
		assert.equal(reference.counts.rounds, 256);
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.counts.records
			, reference.route === "ordinary" ? 65 : 67);
		assert.equal(reference.counts.loadCeiling, 20);
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_MAX_LOAD='20'"));
		assert.ok(reference.command.includes("python311/bin/python3.11"));
		assert.ok(reference.command.includes("python312/bin/python3.12"));
		assert.ok(reference.scope.includes(nestedCheckedRecordPythonLimit));
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.artifacts[0].path.endsWith(".whl"));
		for(const suffix of [
			"sources/producer/src/backends/python/copied-values.mjs"
			, "sources/verifier/tests/helpers/nested-checked-record-python-report.mjs"
			, "producer/run.tap", `${reference.route}-${reference.mode}/controls.json`
			, `${reference.route}-${reference.mode}/records/consumer.py`
			, `${reference.route}-${reference.mode}/records/report.json`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record Python promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nestedCheckedRecordPythonReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordPython(original, changed));
	for(const mutate of [
		item => { item.profiles.push("ruby"); }
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
		await assert.rejects(promoteNestedCheckedRecordPython(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordPython(original, references);
	await assert.rejects(promoteNestedCheckedRecordPython(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-native-python-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlap"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordPython(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record Python promotion supplements six cells only", async () => {
	const original = predecessor(), references = await nestedCheckedRecordPythonReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordPythonPromotionHistoryPath
		, await promoteNestedCheckedRecordPython(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordPythonPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordPythonPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length)
		, proposed.evidence.slice(original.evidence.length));
	const changedExisting = proposed.observations.slice(0, original.observations.length)
		.filter((item, index) => JSON.stringify(item)
			!== JSON.stringify(original.observations[index]));
	assert.deepEqual(changedExisting.map(item => item.id).sort(), [
		"checked-record-native-python-ordinary-source-parameter"
		, "checked-record-native-python-ordinary-source-result"
		, "checked-record-native-python-reviewed-ir-parameter"
		, "checked-record-native-python-reviewed-ir-result"
	]);
	const added = proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort();
	assert.deepEqual(added, [
		"nested-checked-record-python-ordinary-source-field"
		, "nested-checked-record-python-reviewed-ir-field"
	]);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "python");
		assert.equal(cell.shape, "checked-record");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-python-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordNativeConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordPythonConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordPythonLimit));
		assert.ok(!cell.limitations.includes(checkedRecordNativeLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordPythonField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path =>
		["parameter", "result", "field"].map(position =>
			`python/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record Python docs name the accepted boundary", async () => {
	const pages = ["docs/consume/python.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"];
	for(const path of pages)
	{
		const source = sourceAtHistoryMilestone(
			nestedCheckedRecordPythonPromotionHistoryPath, path
		);
		assert.ok(source.includes("nested-checked-record-python-20261016/index.json"), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordPythonPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-python-20261016/index.json")), path);
	}
	const guide = sourceAtHistoryMilestone(
		nestedCheckedRecordPythonPromotionHistoryPath, "docs/consume/python.md"
	);
	const prose = guide.replace(/\s+/gu, " ");
	for(const text of ["nested `Packet`", "CPython 3.11.16 and 3.12.14"
		, "Linux x64/glibc 2.36", "four executions per selection"
		, "same wheel spans both interpreter floors"])
		assert.ok(prose.includes(text), text);
	const row = guide.split("\n").find(line => line.startsWith("| `Checked record"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.includes(nestedCheckedRecordPythonConversion));
});
