/**
 * Restrict nested checked-record Rust claims to installed crate positions.
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
	nestedCheckedRecordRustPromotionHistoryPath
	, nestedCheckedRecordRustPromotionPredecessor
} from "./nested-checked-record-rust-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordRustProducer } from "./nested-checked-record-rust-provenance.mjs";
import {
	nestedCheckedRecordRustConversion
	, nestedCheckedRecordRustField
	, nestedCheckedRecordRustLimit
	, nestedCheckedRecordRustProfiles
	, nestedCheckedRecordRustReferences
	, promoteNestedCheckedRecordRust
} from "./nested-checked-record-rust-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordRustPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record Rust promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordRustReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordRustProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordRustProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 3914 : 1291);
		assert.equal(reference.counts.rejections, full ? 525 : 0);
		assert.equal(reference.counts.recoveries, full ? 256 : 0);
		assert.equal(reference.counts.snapshots, full ? 1824 : 514);
		assert.equal(reference.counts.snapshotControls, full ? 9 : 7);
		assert.equal(reference.counts.rounds, 256);
		assert.equal(reference.counts.executions, 3);
		assert.equal(reference.counts.records
			, reference.route === "ordinary" ? 74 : 76);
		assert.equal(reference.counts.generatorModules, 21);
		assert.equal(reference.counts.dispatchObserved, false);
		assert.deepEqual(reference.counts.runtime, {
			platform: "linux", arch: "x64", glibc: "2.36"
		});
		assert.equal(reference.counts.floor, "2.36");
		assert.match(reference.counts.toolchain.rustc.run.stdout
			, /^rustc 1\.90\.0 /u);
		assert.match(reference.counts.toolchain.cargo.run.stdout
			, /^cargo 1\.90\.0 /u);
		assert.equal(reference.counts.loadCeiling, 20);
		assert.equal(reference.counts.recordControls
			, (reference.route === "ordinary" ? 74 : 76) * 2);
		assert.equal(reference.counts.resourceControls, 8);
		assert.equal(reference.counts.environmentControls, full ? 60 : 61);
		assert.equal(reference.counts.packageControls, 6);
		assert.equal(reference.counts.modelControls, full ? 6 : 5);
		assert.equal(reference.counts.executionControls, 30);
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_RUST_MAX_LOAD='20'"));
		assert.ok(reference.command.includes("rust-1.90.0/bin/rustc"));
		assert.ok(reference.command.includes("rust-1.90.0/bin/cargo"));
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.scope.includes(nestedCheckedRecordRustLimit));
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.artifacts[0].path.endsWith(".crate"));
		for(const suffix of [
			"sources/shared/src/backends/rust/copied-values.mjs"
			, "sources/shared/tests/helpers/nested-checked-record-rust-report.mjs"
			, `${reference.route}-${reference.mode}/run.tap`
			, `${reference.route}-${reference.mode}/controls.json`
			, `${reference.route}-${reference.mode}/records/consumer.rs`
			, `${reference.route}-${reference.mode}/records/report.json`
			, `${reference.route}-${reference.mode}/records/handoff/archives/nestedcheckedrecords-1.0.0.crate`
		]) assert.ok(reference.files.some(file =>
			file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record Rust promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordRustReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordRust(original, changed));
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
		await assert.rejects(promoteNestedCheckedRecordRust(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordRust(original, references);
	await assert.rejects(promoteNestedCheckedRecordRust(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-native-rust-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlap"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordRust(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record Rust promotion supplements six cells only", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordRustReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordRustPromotionHistoryPath
		, await promoteNestedCheckedRecordRust(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordRustPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordRustPromotionHistoryPath, proposed
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
		"checked-record-native-rust-ordinary-source-parameter"
		, "checked-record-native-rust-ordinary-source-result"
		, "checked-record-native-rust-reviewed-ir-parameter"
		, "checked-record-native-rust-reviewed-ir-result"
	]);
	const added = proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort();
	assert.deepEqual(added, [
		"nested-checked-record-rust-ordinary-source-field"
		, "nested-checked-record-rust-reviewed-ir-field"
	]);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "rust");
		assert.equal(cell.shape, "checked-record");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-rust-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordNativeConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordRustConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordRustLimit));
		assert.ok(!cell.limitations.includes(checkedRecordNativeLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordRustField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"].map(position =>
			`rust/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record Rust docs name the accepted boundary", async () => {
	const pages = ["docs/consume/rust.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"];
	for(const path of pages)
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes(
			"nested-checked-record-rust-20261016/index.json"
		), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordRustPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-rust-20261016/index.json")), path);
	}
	const guide = await readFile("docs/consume/rust.md", "utf8");
	const prose = guide.replace(/\s+/gu, " ");
	for(const text of ["nested `Packet`", "Rust and Cargo 1.90.0"
		, "Linux x64/glibc 2.36", "three executions per selection"])
		assert.ok(prose.includes(text), text);
	const row = guide.split("\n")
		.find(line => line.startsWith("| `Checked record"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.includes(nestedCheckedRecordRustConversion));
});
