/**
 * Restrict nested checked-record Java and Kotlin claims to installed positions.
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
import { checkedRecordNativeConversion, checkedRecordNativeLimit } from "./checked-record-native-promotion.mjs";
import { nestedCheckedRecordJvmPromotionHistoryPath, nestedCheckedRecordJvmPromotionPredecessor } from "./nested-checked-record-jvm-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordJvmProducer } from "./nested-checked-record-jvm-provenance.mjs";
import {
	nestedCheckedRecordJvmConversion
	, nestedCheckedRecordJvmFields
	, nestedCheckedRecordJvmLimit
	, nestedCheckedRecordJvmProfiles
	, nestedCheckedRecordJvmReferences
	, promoteNestedCheckedRecordJvm
} from "./nested-checked-record-jvm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordJvmPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record JVM promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordJvmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordJvmProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordJvmProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 23544 : 7740);
		assert.equal(reference.counts.rejections, full ? 3144 : 0);
		assert.equal(reference.counts.hostRejections, full ? 42 : 24);
		assert.equal(reference.counts.recoveries, full ? 3168 : 6);
		assert.equal(reference.counts.snapshots, full ? 6324 : 6);
		assert.equal(reference.counts.executions, 6);
		assert.equal(reference.counts.loadCeiling, 12);
		assert.equal(reference.counts.executionControls, 48);
		assert.equal(reference.counts.probeControls, 22);
		assert.equal(reference.counts.packageControls, 4);
		assert.equal(reference.counts.modelControls, full ? 5 : 4);
		assert.equal(reference.counts.resourceControls, 8);
		assert.equal(reference.counts.recordControls
			, reference.counts.records.length * 2);
		assert.equal(reference.counts.archiveSha256
			, reference.artifacts.find(item => item.path.endsWith(".jar")).sha256);
		assert.ok(reference.command.includes("LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MAX_LOAD='12'"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes("'--test-concurrency=1'"));
		assert.ok(reference.scope.includes(nestedCheckedRecordJvmLimit));
		assert.deepEqual(reference.artifacts.map(item => item.path), [
			"archives/nestedcheckedrecords-1.0.0.jar"
			, "archives/nestedcheckedrecords-1.0.0.pom"
		]);
		const label = `${reference.route}-${reference.mode}`;
		for(const suffix of [
			"sources/src/backends/jvm/copied-model.mjs"
			, "sources/tests/fixtures/nested-checked-record-consumers/java.java"
			, "sources/tests/fixtures/nested-checked-record-consumers/kotlin.kt"
			, "runners/run-vo1506-nested-record-jvm-ef8876b.mjs"
			, `${label}/producer/run.tap`, `${label}/producer/controls.json`
			, `${label}/records/consumer.java`, `${label}/records/consumer.kt`
			, `${label}/records/report.json`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record JVM promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nestedCheckedRecordJvmReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordJvm(original, changed));
	for(const mutate of [
		item => { item.profiles.push("c"); }
		, item => { item.route = "reviewed"; }
		, item => { item.mode = "result-only"; }
		, item => { item.sourcePath = "reviewed-ir"; }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.counts.checks = 1; }
		, item => { item.counts.loadCeiling = 6; }
		, item => { item.scope = "All checked records pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.files[0].sha256 = "0".repeat(64); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNestedCheckedRecordJvm(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordJvm(original, references);
	await assert.rejects(promoteNestedCheckedRecordJvm(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-native-java-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlapping-parameter"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordJvm(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record JVM promotion supplements twelve cells only", async () => {
	const original = predecessor(), references = await nestedCheckedRecordJvmReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordJvmPromotionHistoryPath
		, await promoteNestedCheckedRecordJvm(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordJvmPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 4);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordJvmPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length)
		, proposed.evidence.slice(original.evidence.length));
	const changedExisting = proposed.observations.slice(0, original.observations.length)
		.filter((item, index) => JSON.stringify(item)
			!== JSON.stringify(original.observations[index]));
	assert.deepEqual(changedExisting.map(item => item.id).sort()
		, nestedCheckedRecordJvmProfiles.flatMap(profile =>
			["ordinary-source", "reviewed-ir"].flatMap(path =>
				["parameter", "result"].map(position =>
					`checked-record-native-${profile}-${path}-${position}`))).sort());
	assert.deepEqual(proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort(), nestedCheckedRecordJvmProfiles.flatMap(profile =>
		["ordinary-source", "reviewed-ir"].map(path =>
			`nested-checked-record-jvm-${profile}-${path}-field`)).sort());
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record");
		assert.ok(nestedCheckedRecordJvmProfiles.includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-jvm-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordNativeConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordJvmConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordJvmLimit));
		assert.ok(!cell.limitations.includes(checkedRecordNativeLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordJvmFields[cell.profile]);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), nestedCheckedRecordJvmProfiles.flatMap(profile =>
		["ordinary-source", "reviewed-ir"].flatMap(path =>
			["parameter", "result", "field"].map(position =>
				`${profile}/checked-record/${path}/${position}`))).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record JVM docs name the accepted boundary", async () => {
	for(const path of ["docs/consume/java.md", "docs/consume/kotlin.md"
		, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
		, "docs/reference/types.md"]){
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nested-checked-record-jvm-20261016/index.json"), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordJvmPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-jvm-20261016/index.json")), path);
		if(path.startsWith("docs/consume/")) assert.ok(compiled.links.includes(
			"https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-jvm.yml"), path);
		}
	for(const path of ["docs/consume/java.md", "docs/consume/kotlin.md"])
	{
		const guide = await readFile(path, "utf8");
		for(const text of ["nested `Packet`", "JDK 22.0.2", "Kotlin 2.2.0"
			, "Linux x64/glibc 2.36", "source-free", "load-admission ceiling of 12"])
			assert.ok(guide.includes(text), `${path}: ${text}`);
		// Later callback promotions broaden the live row. Check this milestone's
		// exact three-position claim against its authenticated documentation.
		const milestone = sourceAtHistoryMilestone(
			nestedCheckedRecordJvmPromotionHistoryPath, path);
		const row = milestone.split("\n").find(line => line.startsWith("| `Checked record"));
		assert.ok(row.includes("Installed checks passed (input, result, field)"), path);
		assert.ok(row.includes(nestedCheckedRecordJvmConversion), path);
		assert.ok(guide.includes(nestedCheckedRecordJvmConversion), path);
	}
});
