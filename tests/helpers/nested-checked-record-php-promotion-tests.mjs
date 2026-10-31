/**
 * Restrict nested checked-record native PHP claims to installed positions.
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
	nestedCheckedRecordPhpPromotionHistoryPath
	, nestedCheckedRecordPhpPromotionPredecessor
} from "./nested-checked-record-php-promotion-history.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordPhpProducer } from "./nested-checked-record-php-provenance.mjs";
import {
	nestedCheckedRecordPhpConversion
	, nestedCheckedRecordPhpField
	, nestedCheckedRecordPhpLimit
	, nestedCheckedRecordPhpProfiles
	, nestedCheckedRecordPhpReferences
	, promoteNestedCheckedRecordPhp
} from "./nested-checked-record-php-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordPhpPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record native PHP promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordPhpReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordPhpProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordPhpProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 14820 : 4240);
		assert.equal(reference.counts.rejections, full ? 2100 : 0);
		assert.equal(reference.counts.hostRejections, full ? 64 : 24);
		assert.equal(reference.counts.recoveries, full ? 1024 : 0);
		assert.equal(reference.counts.snapshots, full ? 7360 : 2080);
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.counts.records
			, reference.route === "ordinary" ? 66 : 68);
		assert.equal(reference.counts.loadCeiling, 20);
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR='2.36'"));
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_MAX_LOAD='20'"));
		assert.ok(reference.scope.includes(nestedCheckedRecordPhpLimit));
		assert.equal(reference.artifacts.length, 1);
		for(const suffix of [
			"sources/producer/src/backends/php/copied-values.mjs"
			, "sources/verifier/tests/helpers/nested-checked-record-php-report.mjs"
			, "producer/run.tap", `${reference.route}-${reference.mode}/controls.json`
			, `${reference.route}-${reference.mode}/records/consumer.php`
			, `${reference.route}-${reference.mode}/records/report.json`
		]) assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record native PHP promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor(), references = await nestedCheckedRecordPhpReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordPhp(original, changed));
	for(const mutate of [
		item => { item.profiles.push("php-wasm"); }
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
		await assert.rejects(promoteNestedCheckedRecordPhp(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordPhp(original, references);
	await assert.rejects(promoteNestedCheckedRecordPhp(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-native-php-native-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlap"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordPhp(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record native PHP promotion supplements six cells only", async () => {
	const original = predecessor(), references = await nestedCheckedRecordPhpReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordPhpPromotionHistoryPath
		, await promoteNestedCheckedRecordPhp(original, references)
	);
	const { document: live } = await readTypeSurface();
	const contracts = typeSurfaceContractsAtProducer(nestedCheckedRecordPhpPromotionPredecessor);
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordPhpPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordPhpPromotionHistoryPath, proposed
	).evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(document, proposed);
	assert.deepEqual(document.observations, proposed.observations);
	assert.deepEqual(document.evidence.slice(original.evidence.length)
		, proposed.evidence.slice(original.evidence.length));
	const changedExisting = proposed.observations.slice(0, original.observations.length)
		.filter((item, index) => JSON.stringify(item)
			!== JSON.stringify(original.observations[index]));
	assert.deepEqual(changedExisting.map(item => item.id).sort(), [
		"checked-record-native-php-native-ordinary-source-parameter"
		, "checked-record-native-php-native-ordinary-source-result"
		, "checked-record-native-php-native-reviewed-ir-parameter"
		, "checked-record-native-php-native-reviewed-ir-result"
	]);
	const added = proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort();
	assert.deepEqual(added, [
		"nested-checked-record-php-ordinary-source-field"
		, "nested-checked-record-php-reviewed-ir-field"
	]);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "php-native");
		assert.equal(cell.shape, "checked-record");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-php-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordNativeConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordPhpConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordPhpLimit));
		assert.ok(!cell.limitations.includes(checkedRecordNativeLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordPhpField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"].flatMap(path =>
		["parameter", "result", "field"].map(position =>
			`php-native/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record native PHP docs name the accepted boundary", async () => {
	const pages = ["docs/php.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"];
	for(const path of pages)
	{
		const source = sourceAtHistoryMilestone(
			nestedCheckedRecordPhpPromotionHistoryPath, path
		);
		assert.ok(source.includes("nested-checked-record-php-20261016/index.json"), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordPhpPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-php-20261016/index.json")), path);
	}
	const guide = sourceAtHistoryMilestone(
		nestedCheckedRecordPhpPromotionHistoryPath, "docs/php.md"
	);
	const prose = guide.replace(/\s+/gu, " ");
	for(const text of ["nested `Packet`", "PHP 8.2.33 and Composer 2.5.5"
		, "Linux x64/glibc 2.36", "weak and strict"
		, "four executions per selection"])
		assert.ok(prose.includes(text), text);
	const row = guide.split("\n").find(line => line.startsWith("| `Checked record"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.includes(nestedCheckedRecordPhpConversion));
});
