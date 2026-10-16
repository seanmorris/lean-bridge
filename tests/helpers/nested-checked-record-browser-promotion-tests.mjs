/**
 * Bind nested checked-record claims to the exact npm/browser archive and positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	nestedCheckedRecordBrowserConversion,
	nestedCheckedRecordBrowserField,
	nestedCheckedRecordBrowserLimit,
	nestedCheckedRecordBrowserProfiles,
	nestedCheckedRecordBrowserReferences,
	promoteNestedCheckedRecordBrowsers
} from "./nested-checked-record-browser-promotion.mjs";
import {
	nestedCheckedRecordBrowserArchive,
	nestedCheckedRecordBrowserProducer
} from "./nested-checked-record-browser-archive.mjs";
import {
	nestedCheckedRecordHistoryPath
} from "./nested-checked-record-source-history.mjs";
import {
	nestedCheckedRecordBrowserPromotionHistoryPath,
	nestedCheckedRecordBrowserPromotionPredecessor
} from "./nested-checked-record-browser-promotion-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeNominalPrimitiveSubtypeWitPromotionPins
} from "./nominal-primitive-subtype-wit-promotion-history.mjs";
import {
	beforeNominalPrimitiveSubtypeJvmPromotionPins
} from "./nominal-primitive-subtype-jvm-promotion-history.mjs";
import {
	beforeNestedCheckedRecordNativeCorrectionPins
} from "./nested-checked-record-native-correction-source-history.mjs";

const inventory = async () => JSON.parse(execFileSync("git", ["show"
	, `${nestedCheckedRecordBrowserPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const contracts = async () => ({
	irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json"))
	, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json"))
});

test("nested checked-record promotion authenticates four exact installed routes", async () => {
	const references = await nestedCheckedRecordBrowserReferences();
	assert.deepEqual(references.map(item => [item.route, item.mode]), [
		["ordinary-full", "full"], ["ordinary-result-only", "result-only"]
		, ["reviewed-full", "full"], ["reviewed-result-only", "result-only"]
	]);
	for(const reference of references)
	{
		assert.equal(reference.revision, nestedCheckedRecordBrowserProducer);
		assert.deepEqual(reference.profiles, nestedCheckedRecordBrowserProfiles);
		assert.deepEqual(reference.positions, reference.resultOnly
			? ["result"] : ["parameter", "result", "field"]);
		assert.equal(reference.counts.browserExecutions, 12);
		assert.equal(reference.counts.lifecycleObservations, 51);
		assert.deepEqual(reference.counts.engines, ["chromium", "firefox", "webkit"]);
		assert.equal(reference.counts.controls.record, 170);
		assert.equal(reference.counts.controls.browser, 162);
		assert.ok(reference.command.includes("--test-concurrency=1"));
		assert.ok(reference.command.includes("LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_TEST=1"));
		assert.ok(reference.scope.includes(nestedCheckedRecordBrowserLimit));
		assert.equal(reference.artifacts.length, 2);
		for(const suffix of ["index.json", `${reference.route}/records/report.json`
			, `${reference.route}/records/browser.json`
			, `${reference.route}/records/browser-controls.json`
			, "sources/producer/src/analyze/NativeExports.lean"
			, "sources/consumer/tests/fixtures/nested-checked-record-consumers/browser.mjs"])
			assert.ok(reference.files.some(file => file.path.endsWith(suffix)), suffix);
	}
});

test("nested checked-record promotion refuses narrowed, forged or repeated evidence", async () => {
	const original = await inventory(), references = await nestedCheckedRecordBrowserReferences();
	for(const changed of [references.slice(1), references.slice().reverse()
		, [...references, references[0]]])
		await assert.rejects(promoteNestedCheckedRecordBrowsers(original, changed));
	for(const mutate of [
		item => { item.profiles.pop(); }
		, item => { item.positions.pop(); }
		, item => { item.revision = "0".repeat(40); }
		, item => { item.consumerRevision = "0".repeat(40); }
		, item => { item.counts.browserExecutions = 11; }
		, item => { item.scope = "All checked records pass"; }
		, item => { item.command = "node --test"; }
		, item => { item.files.pop(); }
		, item => { item.artifacts.pop(); }
	]) {
		const changed = structuredClone(references); mutate(changed[0]);
		await assert.rejects(promoteNestedCheckedRecordBrowsers(original, changed));
	}
	const promoted = await promoteNestedCheckedRecordBrowsers(original, references);
	await assert.rejects(promoteNestedCheckedRecordBrowsers(promoted, references)
		, /Already promoted/u);
	const overlap = structuredClone(original);
	overlap.observations.push(structuredClone(promoted.observations.at(-1)));
	await assert.rejects(promoteNestedCheckedRecordBrowsers(overlap, references)
		, /overlapping/u);
});

test("nested checked-record promotion changes thirty exact cells and leaves callbacks open", async () => {
	const original = await inventory(), unchanged = structuredClone(original);
	const references = await nestedCheckedRecordBrowserReferences();
	const proposed = beforeNominalPrimitiveSubtypeWitPromotionPins(beforeNominalPrimitiveSubtypeJvmPromotionPins(
		beforeNestedCheckedRecordNativeCorrectionPins(
			await promoteNestedCheckedRecordBrowsers(original, references))));
	const contract = await contracts(); validateTypeSurface(proposed, contract);
	// Newer layers append receipts, supplement cells and refresh pins; read this
	// layer's exact output through them.
	const ledger = JSON.parse(await readFile(nestedCheckedRecordBrowserPromotionHistoryPath));
	const current = async path => beforeFinRefinementSource(path
		, await readFile(path, "utf8")
		, ledger.updates.find(update => update.path === path).currentSha256);
	assert.deepEqual(proposed, JSON.parse(await current("docs/type-surface.v1.json")));
	assert.deepEqual(original, unchanged);
	assert.equal(proposed.evidence.length, original.evidence.length + 4);
	assert.equal(proposed.observations.length, original.observations.length + 10);
	const before = typeSurfaceCells(original, contract);
	const after = typeSurfaceCells(proposed, contract), changed = [];
	for(const [index, cell] of after.entries())
	{
		if(JSON.stringify(cell) === JSON.stringify(before[index])) continue;
		assert.equal(cell.shape, "checked-record");
		assert.ok(nestedCheckedRecordBrowserProfiles.includes(cell.profile));
		assert.ok(["ordinary-source", "reviewed-ir"].includes(cell.path));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.ok(cell.conversionNote.includes(nestedCheckedRecordBrowserConversion));
		assert.ok(cell.limitations.includes(nestedCheckedRecordBrowserLimit));
		assert.ok(!cell.limitations.some(value => value.includes("No field or callback")));
		assert.ok(!cell.limitations.includes("Only top-level Interval, Sized 3 and Bounded 0 101 inputs/results are established. Nested/refined/recursive/inherited checked records, other index kinds, general dependent or zero-payload records, callbacks and owned positions remain unreviewed. These local Node/Chromium/Firefox/WebKit observations do not establish hosted or PHP-Wasm acceptance. Internal dispatch counts and memory are unmeasured. The archive retains selected producer sources and package digests, not package binaries or a complete toolchain closure."));
		if(cell.position === "field")
			assert.equal(cell.hostType, nestedCheckedRecordBrowserField);
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id => id.startsWith("nested-checked-record-browser-")));
		changed.push(cell.id);
	}
	assert.deepEqual(changed.sort(), nestedCheckedRecordBrowserProfiles.flatMap(profile =>
		["ordinary-source", "reviewed-ir"].flatMap(path =>
			["parameter", "result", "field"].map(position =>
				`${profile}/checked-record/${path}/${position}`))).sort());
	const callbackCells = after.filter(item => item.shape === "checked-record"
		&& nestedCheckedRecordBrowserProfiles.includes(item.profile)
		&& ["callback-parameter", "callback-result"].includes(item.position));
	for(const cell of callbackCells)
	{
		const prior = before.find(item => item.id === cell.id);
		assert.deepEqual(cell, prior); assert.equal(cell.stages.installedExecution.state, "unreviewed");
	}
	assert.ok(proposed.evidence.flatMap(item => item.files)
		.some(file => file.path === `${nestedCheckedRecordBrowserArchive}/index.json`));
	const history = JSON.parse(await readFile(nestedCheckedRecordHistoryPath));
	const pinnedUpdates = history.updates.filter(update => original.evidence
		.flatMap(item => item.files).some(file => file.path === update.path));
	assert.equal(pinnedUpdates.length, 14);
	for(const update of pinnedUpdates)
	{
		const pins = proposed.evidence.flatMap(item => item.files)
			.filter(file => file.path === update.path);
		assert.ok(pins.length > 0, update.path);
		assert.ok(pins.every(file => file.sha256 === update.currentSha256), update.path);
	}
	const promotedPins = ["docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md", "scripts/generate-type-docs.mjs"];
	for(const path of promotedPins)
	{
		const expected = sha256(await current(path));
		const pins = proposed.evidence.flatMap(item => item.files)
			.filter(file => file.path === path);
		assert.ok(pins.length > 0, path);
		assert.ok(pins.every(file => file.sha256 === expected), path);
	}
});

test("nested checked-record documentation names exact shapes, engines and remaining work", async () => {
	const paths = [
		"docs/javascript-typescript.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/reference/types.md"
	];
	for(const path of paths)
	{
		const source = await readFile(path, "utf8");
		assert.ok(source.includes("nested-checked-record-browser-20261016/index.json")
			, path);
	}
	const javascript = await readFile("docs/javascript-typescript.md", "utf8");
	for(const text of ["Fin 10", "checked `Nat` subtype", "Array", "List"
		, "Option", "products", "Except", "enclosing record field"
		, "active variant field", "Chromium", "Firefox", "WebKit"])
		assert.ok(javascript.includes(text), text);
	assert.ok(javascript.includes("actions/workflows/nested-checked-record-browser.yml"));
	const row = javascript.split("\n").find(line =>
		line.startsWith("| `Checked records and closed Nat indices`"));
	assert.ok(row.includes("Installed checks passed (input, result, field)"));
	assert.ok(row.includes("Not audited (callback input, callback result)"));
	assert.equal(row.split(nestedCheckedRecordBrowserConversion).length, 3
		, "Render the shared explanation once for Node/TypeScript and once for browsers");
});
