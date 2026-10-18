/**
 * Restrict nested checked-record WIT/WASI claims to installed component positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
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
	nestedCheckedRecordWitPromotionHistoryPath
	, nestedCheckedRecordWitPromotionPredecessor
} from "./nested-checked-record-wit-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordWitProducer } from "./nested-checked-record-wit-provenance.mjs";
import {
	nestedCheckedRecordWitConversion
	, nestedCheckedRecordWitField
	, nestedCheckedRecordWitLimit
	, nestedCheckedRecordWitProfiles
	, nestedCheckedRecordWitReferences
	, promoteNestedCheckedRecordWit
} from "./nested-checked-record-wit-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordWitPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record WIT promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordWitReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordWitProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordWitProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 6008 : 1553);
		assert.equal(reference.counts.rejections, full ? 524 : 0);
		assert.equal(reference.counts.hostRejections, full ? 7 : 4);
		assert.equal(reference.counts.recoveries, full ? 256 : 0);
		assert.equal(reference.counts.snapshots, full ? 1826 : 516);
		assert.equal(reference.counts.rounds, 256);
		assert.equal(reference.counts.executions, 2);
		assert.equal(reference.counts.records
			, reference.route === "ordinary" ? 90 : 92);
		assert.equal(reference.counts.loadCeiling, 20);
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_MAX_LOAD='20'"));
		assert.ok(reference.command.includes("wasm-tools/bin/wasm-tools"));
		assert.ok(reference.command.includes(".toolchains/wasmtime42"));
		assert.ok(reference.command.includes("taskset' '-c' '3'"));
		assert.ok(reference.scope.includes(nestedCheckedRecordWitLimit));
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.artifacts[0].path.endsWith("-wit-wasi.tar.gz"));
		for(const suffix of [
			"sources/producer/src/backends/wit/copied-component.mjs"
			, "sources/verifier/tests/helpers/nested-checked-record-wit-report.mjs"
			, "producer/run.tap"
			, `${reference.route}-${reference.mode}/controls.json`
			, `${reference.route}-${reference.mode}/records/consumer.c`
			, `${reference.route}-${reference.mode}/records/report.json`
		]) assert.ok(reference.files.some(file =>
			file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record WIT promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordWitReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordWit(original, changed));
	for(const mutate of [
		item => { item.profiles.push("python"); }
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
		await assert.rejects(promoteNestedCheckedRecordWit(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordWit(original, references);
	await assert.rejects(promoteNestedCheckedRecordWit(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-native-wit-wasi-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlap"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordWit(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record WIT promotion supplements six cells only", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordWitReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordWitPromotionHistoryPath
		, await promoteNestedCheckedRecordWit(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordWitPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordWitPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length)
		, proposed.evidence.slice(original.evidence.length));
	const changedExisting = proposed.observations
		.slice(0, original.observations.length)
		.filter((item, index) => JSON.stringify(item)
			!== JSON.stringify(original.observations[index]));
	assert.deepEqual(changedExisting.map(item => item.id).sort(), [
		"checked-record-native-wit-wasi-ordinary-source-parameter"
		, "checked-record-native-wit-wasi-ordinary-source-result"
		, "checked-record-native-wit-wasi-reviewed-ir-parameter"
		, "checked-record-native-wit-wasi-reviewed-ir-result"
	]);
	const added = proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort();
	assert.deepEqual(added, [
		"nested-checked-record-wit-ordinary-source-field"
		, "nested-checked-record-wit-reviewed-ir-field"
	]);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "wit-wasi");
		assert.equal(cell.shape, "checked-record");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-wit-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordNativeConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordWitConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordWitLimit));
		assert.ok(!cell.limitations.includes(checkedRecordNativeLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordWitField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"].map(position =>
			`wit-wasi/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record WIT docs name the accepted boundary", async () => {
	const pages = ["docs/consume/wit-wasi.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"];
	for(const path of pages)
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes(
			"nested-checked-record-wit-20261016/index.json"
		), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordWitPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-wit-20261016/index.json")), path);
	}
	const guide = await readFile("docs/consume/wit-wasi.md", "utf8");
	const prose = guide.replace(/\s+/gu, " ");
	for(const text of ["nested `Packet`", "Wasmtime 42.0.1"
		, "Linux x64/glibc 2.36", "two executions per selection"])
		assert.ok(prose.includes(text), text);
	const row = guide.split("\n")
		.find(line => line.startsWith("| `Checked record"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.replaceAll("`", "").includes(
		nestedCheckedRecordWitConversion
	));
});
