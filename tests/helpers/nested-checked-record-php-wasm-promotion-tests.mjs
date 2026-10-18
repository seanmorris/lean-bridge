/**
 * Restrict nested checked-record PHP-Wasm claims to installed positions.
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
	checkedRecordPhpWasmConversion, checkedRecordPhpWasmLimit
} from "./checked-record-php-wasm-promotion.mjs";
import {
	nestedCheckedRecordPhpWasmPromotionHistoryPath
	, nestedCheckedRecordPhpWasmPromotionPredecessor
} from "./nested-checked-record-php-wasm-promotion-history.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
	, withHistorySourcePins
} from "./source-history-test-source.mjs";
import { nestedCheckedRecordPhpWasmProducer } from "./nested-checked-record-php-wasm-provenance.mjs";
import {
	nestedCheckedRecordPhpWasmConversion
	, nestedCheckedRecordPhpWasmField
	, nestedCheckedRecordPhpWasmLimit
	, nestedCheckedRecordPhpWasmProfiles
	, nestedCheckedRecordPhpWasmReferences
	, promoteNestedCheckedRecordPhpWasm
} from "./nested-checked-record-php-wasm-promotion.mjs";

const predecessor = () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordPhpWasmPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

test("nested checked-record PHP-Wasm promotion authenticates four installed selections", async () => {
	const references = await nestedCheckedRecordPhpWasmReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(references.map(item => item.revision)
		, Array(4).fill(nestedCheckedRecordPhpWasmProducer));
	for(const reference of references)
	{
		const full = reference.mode === "full";
		assert.deepEqual(reference.profiles, nestedCheckedRecordPhpWasmProfiles);
		assert.deepEqual(reference.positions, full
			? ["parameter", "result", "field"] : ["result"]);
		assert.equal(reference.sourcePath, reference.route === "ordinary"
			? "ordinary-source" : "reviewed-ir");
		assert.equal(reference.counts.checks, full ? 3705 : 1060);
		assert.equal(reference.counts.rejections, full ? 525 : 0);
		assert.equal(reference.counts.hostRejections, full ? 16 : 6);
		assert.equal(reference.counts.recoveries, full ? 256 : 0);
		assert.equal(reference.counts.snapshots, full ? 1840 : 520);
		assert.equal(reference.counts.snapshotControls, full ? 12 : 7);
		assert.equal(reference.counts.rounds, 256);
		assert.equal(reference.counts.executions, 12);
		assert.equal(reference.counts.records
			, reference.route === "ordinary" ? 50 : 52);
		assert.equal(reference.counts.loadCeiling, 20);
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME="));
		assert.ok(reference.command.includes(
			"LEAN_BRIDGE_NESTED_CHECKED_RECORD_PHP_WASM_MAX_LOAD='20'"));
		assert.ok(reference.command.includes("source 'scripts/env.sh'"));
		assert.ok(reference.scope.includes(nestedCheckedRecordPhpWasmLimit));
		assert.equal(reference.artifacts.length, 3);
		assert.deepEqual(reference.artifacts.map(item => item.path.split(".").at(-1))
			, ["zip", "tgz", "tgz"]);
		for(const suffix of [
			"sources/shared/src/backends/php/copied-values.mjs"
			, "sources/verifier/tests/helpers/nested-checked-record-php-wasm-report.mjs"
			, `${reference.route}-${reference.mode}/run.tap`
			, `${reference.route}-${reference.mode}/controls.json`
			, `${reference.route}-${reference.mode}/records/strict.php`
			, `${reference.route}-${reference.mode}/records/report.json`
		]) assert.ok(reference.files.some(file =>
			file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record PHP-Wasm promotion rejects narrowed references and overlaps", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordPhpWasmReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordPhpWasm(original, changed));
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
		await assert.rejects(promoteNestedCheckedRecordPhpWasm(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordPhpWasm(original, references);
	await assert.rejects(promoteNestedCheckedRecordPhpWasm(promoted, references)
		, /Already promoted/u);
	for(const extra of [false, true])
	{
		const changed = structuredClone(original);
		const position = changed.observations.findIndex(item =>
			item.id === "checked-record-php-wasm-ordinary-source-parameter");
		assert.ok(position >= 0);
		if(extra) changed.observations.push({
			...structuredClone(changed.observations[position]), id: "overlap"
		});
		else changed.observations.splice(position, 1);
		await assert.rejects(promoteNestedCheckedRecordPhpWasm(changed, references)
			, /Missing or overlapping/u);
	}
	assert.deepEqual(original, predecessor());
});

test("nested checked-record PHP-Wasm promotion supplements six cells only", async () => {
	const original = predecessor();
	const references = await nestedCheckedRecordPhpWasmReferences();
	const proposed = withHistoryMilestoneSourcePins(
		nestedCheckedRecordPhpWasmPromotionHistoryPath
		, await promoteNestedCheckedRecordPhpWasm(original, references)
	);
	const { document: live, ...contracts } = await readTypeSurface();
	const document = JSON.parse(sourceAtHistoryMilestone(
		nestedCheckedRecordPhpWasmPromotionHistoryPath
		, "docs/type-surface.v1.json"
	));
	assert.ok(live.evidence.length >= document.evidence.length);
	validateTypeSurface(proposed, contracts);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 2);
	assert.deepEqual(withHistorySourcePins(
		nestedCheckedRecordPhpWasmPromotionHistoryPath, proposed
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
		"checked-record-php-wasm-ordinary-source-parameter"
		, "checked-record-php-wasm-ordinary-source-result"
		, "checked-record-php-wasm-reviewed-ir-parameter"
		, "checked-record-php-wasm-reviewed-ir-result"
	]);
	const added = proposed.observations.slice(original.observations.length)
		.map(item => item.id).sort();
	assert.deepEqual(added, [
		"nested-checked-record-php-wasm-ordinary-source-field"
		, "nested-checked-record-php-wasm-reviewed-ir-field"
	]);
	const before = typeSurfaceCells(original, contracts);
	const after = typeSurfaceCells(proposed, contracts), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.profile, "php-wasm");
		assert.equal(cell.shape, "checked-record");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		const route = cell.path === "ordinary-source" ? "ordinary" : "reviewed";
		const ids = references.filter(item => item.route === route
			&& item.positions.includes(cell.position)).map(item => item.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence.filter(id =>
				id.startsWith("nested-checked-record-php-wasm-")), ids);
		}
		assert.ok(cell.conversionNote.includes(checkedRecordPhpWasmConversion));
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordPhpWasmConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordPhpWasmLimit));
		assert.ok(!cell.limitations.includes(checkedRecordPhpWasmLimit));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordPhpWasmField);
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), ["ordinary-source", "reviewed-ir"]
		.flatMap(path => ["parameter", "result", "field"].map(position =>
			`php-wasm/checked-record/${path}/${position}`)).sort());
	assert.deepEqual(original, predecessor());
});

test("nested checked-record PHP-Wasm docs name the accepted boundary", async () => {
	const pages = ["docs/php.md", "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "docs/reference/types.md"];
	for(const path of pages)
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes(
			"nested-checked-record-php-wasm-20261016/index.json"
		), path);
		const compiled = await compileDocumentationPage(source
			, docPages.find(item => item.source === path)
			, { revision: nestedCheckedRecordPhpWasmPromotionPredecessor });
		assert.ok(compiled.links.some(link =>
			link.endsWith("nested-checked-record-php-wasm-20261016/index.json")), path);
	}
	const guide = await readFile("docs/php.md", "utf8");
	const prose = guide.replace(/\s+/gu, " ");
	for(const text of ["nested `Packet`", "wasm32 PHP 8.4.1"
		, "Node 22.23.2", "Chromium 152.0.7977.75"
		, "twelve executions per selection"])
		assert.ok(prose.includes(text), text);
	const row = guide.split("\n")
		.find(line => line.startsWith("| `Checked record"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.replaceAll("`", "").includes(
		nestedCheckedRecordPhpWasmConversion
	));
});
