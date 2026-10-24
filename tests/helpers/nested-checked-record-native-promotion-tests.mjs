/**
 * Bind nested checked-record C/C++ claims to exact installed packages and cells.
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
	nestedCheckedRecordNativeConversion
	, nestedCheckedRecordNativeFields
	, nestedCheckedRecordNativeLimit
	, nestedCheckedRecordNativeProfiles
	, nestedCheckedRecordNativeReferences
	, promoteNestedCheckedRecordNative
} from "./nested-checked-record-native-promotion.mjs";
import {
	nestedCheckedRecordNativePromotionHistoryPath
	, nestedCheckedRecordNativePromotionPredecessor
} from "./nested-checked-record-native-promotion-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import {
	nestedCheckedRecordNativeArchiveSha256
} from "./nested-checked-record-native-archive.mjs";
import {
	nestedCheckedRecordNativeEvidence, nestedCheckedRecordNativeProducer
} from "./nested-checked-record-native-evidence.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordNativePromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

test("nested native promotion authenticates four exact installed selections", async () => {
	const references = await nestedCheckedRecordNativeReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.equal(reference.revision, nestedCheckedRecordNativeProducer);
		assert.deepEqual(reference.profiles, nestedCheckedRecordNativeProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.deepEqual(reference.counts.c, {
			checks: full ? 3369 : 768, recoveries: full ? 256 : 0
			, rejections: full ? 524 : 0, rounds: 256
			, snapshots: full ? 1294 : 0
		});
		assert.deepEqual(reference.counts.cpp, {
			checks: full ? 3884 : 1280, recoveries: full ? 256 : 0
			, rejections: full ? 526 : 0, rounds: 256
			, snapshots: full ? 1296 : 0
		});
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.counts.initialExecutions, 2);
		assert.equal(reference.counts.maxLoad, 12);
		assert.equal(reference.counts.floor, "2.36");
		assert.deepEqual(reference.counts.runtime, {
			arch: "x64", glibc: "2.36", platform: "linux"
		});
		assert.deepEqual(reference.counts.controls, {
			model: 4, package: 2
			, record: reference.route === "ordinary" ? 31 : 33
			, report: 34, resource: 5
		});
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MAX_LOAD=12"));
		assert.ok(reference.scope.includes(nestedCheckedRecordNativeLimit));
		assert.equal(reference.artifacts.length, 2);
		assert.ok(reference.artifacts.every(item => item.path.endsWith(".tar.gz")));
		assert.ok(reference.files.some(file => file.path
			=== `${nestedCheckedRecordNativeEvidence}/index.json`
			&& file.sha256 === nestedCheckedRecordNativeArchiveSha256));
		for(const suffix of ["records/report.json", "records/c/installed.json"
			, "records/cpp/relocated.json"
			, "sources/producer/src/analyze/NativeExports.lean"
			, "sources/producer/tests/fixtures/nested-checked-record-consumers/c.c"
			, "sources/producer/tests/fixtures/nested-checked-record-consumers/cpp.cpp"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested native promotion rejects narrowed, forged and overlapping evidence", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordNativeReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordNative(original, changed));
	for(const mutate of [
		item => { item.profiles.pop(); }
		, item => { item.positions.pop(); }
		, item => { item.route = "reviewed"; }
		, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.c.checks = 1; }
		, item => { item.counts.cpp.snapshots = 1; }
		, item => { item.counts.maxLoad = 6; }
		, item => { item.scope = "All checked records pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references);
		mutate(changed[0]);
		await assert.rejects(promoteNestedCheckedRecordNative(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordNative(original, references);
	await assert.rejects(promoteNestedCheckedRecordNative(promoted, references)
		, /Already promoted/u);
	const missing = structuredClone(original);
	missing.observations = missing.observations.filter(item =>
		item.id !== "checked-record-c-ordinary-source-parameter");
	await assert.rejects(promoteNestedCheckedRecordNative(missing, references)
		, /Missing or overlapping/u);
	const overlap = structuredClone(original);
	overlap.observations.push(structuredClone(promoted.observations.at(-1)));
	await assert.rejects(promoteNestedCheckedRecordNative(overlap, references)
		, /Overlapping/u);
	assert.deepEqual(original, predecessor());
});

test("nested native promotion changes twelve exact C/C++ cells", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordNativeReferences();
	const promoted = await promoteNestedCheckedRecordNative(original, references);
	const { document: current, ...contracts } = await readTypeSurface();
	validateTypeSurface(promoted, contracts);
	assert.ok(current.evidence.length >= promoted.evidence.length);
	assert.equal(promoted.evidence.length, 578);
	assert.equal(promoted.observations.length, 609);
	assert.deepEqual(promoted.evidence.slice(0, original.evidence.length)
		, original.evidence);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(promoted, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record");
		assert.ok(nestedCheckedRecordNativeProfiles.includes(cell.profile));
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordNativeConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordNativeLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordNativeFields[cell.profile]);
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& (cell.position === "result" || item.mode === "full"))
			.map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-native-")), ids);
		}
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), nestedCheckedRecordNativeProfiles.flatMap(profile =>
		["ordinary-source", "reviewed-ir"].flatMap(path =>
			["parameter", "result", "field"].map(position =>
				`${profile}/checked-record/${path}/${position}`))).sort());
	for(const cell of after.filter(item => item.shape === "checked-record"
		&& nestedCheckedRecordNativeProfiles.includes(item.profile)
		&& item.position.startsWith("callback-")))
		assert.deepEqual(cell, before.find(item => item.id === cell.id));
	assert.deepEqual(original, predecessor());
});

test("nested native checked-record docs state the accepted and open boundary", async () => {
	const paths = ["docs/consume/c.md", "docs/consume/cpp.md"
		, "docs/evidence/nested-checked-record-native-20261016.md"
		, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
		, "docs/reference/types.md"];
	for(const path of paths)
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes(
			"nested-checked-record-native-20261016/index.json"), path);
		const page = docPages.find(item => item.source === path);
		if(page)
		{
			const compiled = await compileDocumentationPage(source, page
				, { revision: nestedCheckedRecordNativePromotionPredecessor });
			assert.ok(compiled.links.some(link => link.endsWith(
				"nested-checked-record-native-20261016/index.json")), path);
		}
	}
	for(const path of ["docs/consume/c.md", "docs/consume/cpp.md"])
	{
		const source = await readFile(path, "utf8");
		for(const text of ["Fin 10", "checked `Nat` subtype", "arrays"
			, "Lists", "options", "products", "`Except`", "record fields"
			, "variant fields", "Linux x64/glibc 2.36", "glibc 2.38"])
			assert.ok(source.includes(text), `${path}: ${text}`);
		assert.ok(source.includes(
			"actions/workflows/nested-checked-record-native.yml"), path);
		// Keep the original copied-position claim separate from later callbacks.
		const milestone = sourceAtHistoryMilestone(
			nestedCheckedRecordNativePromotionHistoryPath, path);
		const row = milestone.split("\n").find(line =>
			line.startsWith("| `Checked record"));
		assert.ok(row.includes("Installed checks passed (input, result, field)"));
		assert.ok(row.includes(nestedCheckedRecordNativeConversion));
		assert.ok(source.includes(nestedCheckedRecordNativeConversion));
	}
});
