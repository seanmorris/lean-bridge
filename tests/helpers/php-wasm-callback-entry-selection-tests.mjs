/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createNativeCallableGraphDescriptor } from "../../src/build/native-callable-graph.mjs";
import { generateCompiledPhpWasmGraph } from "../../src/build/php-wasm-graph-component.mjs";
import { callbackFinPhpWasmReview } from "./callback-fin-php-wasm-fixture.mjs";
import {
	callbackRefinementsPhpWasmHostedEvidence
} from "./callback-refinements-php-wasm-hosted-evidence.mjs";
import {
	instrumentPhpWasmCallbackEntries
} from "./php-wasm-callback-entry-c.mjs";
import { phpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-selection.mjs";
import { phpWasmCallbackEntrySourceFixture } from "./php-wasm-callback-entry-source-fixtures.mjs";

const modelFromReview = ir => {
	const copiedGraph = createNativeCallableGraphDescriptor(ir);
	const exports = ir.declarations.map(declaration => {
		const entry = copiedGraph.exports.find(item => item.bindingId === declaration.id);
		const refinements = declaration.source.extensions["lean-lang.org/refinements"];
		return {
			module: declaration.source.declaration.split(".")[0]
			, name: declaration.source.declaration
			, bindingId: declaration.id, symbol: `${entry.symbol}_lean`
			, parameters: declaration.parameters.map(() => ({ leanType: "" }))
			, ...refinements ? { refinements } : {}
		};
	});
	return { schemaVersion: 5, profile: "php-wasm-copied-v1"
		, pointerBits: 32, byteOrder: "little", component: ir.component
		, bindingIr: ir, copiedGraph, exports, types: [] };
};

test("callback selection derives every admitted Fin entry from model and generated sources", async () => {
	const fixture = await phpWasmCallbackEntrySourceFixture("callback-fin");
	const model = modelFromReview(callbackFinPhpWasmReview());
	const selection = phpWasmCallbackEntrySelection(model, fixture.entries);
	for(const kind of ["public", "adapter", "validator", "recovery", "callback"
		, "rejection", "closure", "cleanup", "source"])
		assert.ok(selection.selected.some(item => item.kind === kind), kind);
	for(const label of ["ReviewedCallbacks.scaler", "ReviewedCallbacks.counter"
		, "ReviewedCallbacks.visit", "ReviewedCallbacks.three"])
		assert.ok(selection.selected.some(item => item.kind === "public"
			&& (item.label === label || item.label === `${label}:invoke`)), label);
	assert.ok(selection.selected.some(item => item.label
		=== "ReviewedCallbacks.three:recovery:native"));
	assert.ok(selection.selected.some(item => item.label
		=== "ReviewedCallbacks.scaler:closure:lean"));
	const graph = generateCompiledPhpWasmGraph(model, selection.generated);
	const cSymbols = new Set(selection.selected.filter(item => [
		"public", "recovery", "callback", "rejection", "cleanup"
	].includes(item.kind) || item.kind === "adapter" && (
		item.label.endsWith(":native")
	)).map(item => item.symbol));
	const counts = new Map([...cSymbols].map(symbol => [symbol, 0]));
	for(const source of Object.values(graph.files))
	{
		const chosen = selection.selected.filter(item => cSymbols.has(item.symbol));
		const receipt = instrumentPhpWasmCallbackEntries(source, chosen).receipt;
		for(const item of receipt.insertions.filter(item => item.kind !== "preamble"))
			counts.set(item.symbol, counts.get(item.symbol) + 1);
	}
	for(const [symbol, count] of counts) assert.equal(count, 1, symbol);
});

test("callback selection keeps checked-record validator labels in the trace grammar", async () => {
	const model = JSON.parse(await readFile(
		`${callbackRefinementsPhpWasmHostedEvidence}/hosted/output/records/checked-record/reviewed/build-0/model.json`
	));
	const fixture = await phpWasmCallbackEntrySourceFixture(
		"callback-checked-record");
	const selected = phpWasmCallbackEntrySelection(model, fixture.entries).selected;
	const validators = selected.filter(item => item.kind === "validator"
		&& item.label.includes(":callback_validator:"));
	assert.ok(validators.length > 0);
	assert.ok(validators.every(item =>
		/^[A-Za-z_][A-Za-z0-9_.:]*$/u.test(item.label)));
	assert.ok(selected.filter(item => item.kind === "validator")
		.every(item => !item.label.includes(":validator:structured_")));
});

test("callback selection measures nominal-only callbacks only as returned closures", async () => {
	const fixture = await phpWasmCallbackEntrySourceFixture("callback-fin");
	const model = modelFromReview(callbackFinPhpWasmReview());
	const { selected } = phpWasmCallbackEntrySelection(model, fixture.entries);
	for(const name of ["tiles", "tileMaker"])
	{
		assert.ok(selected.some(item => item.label === `ReviewedCallbacks.${name}:closure:lean`), name);
		assert.ok(!selected.some(item => item.label === `ReviewedCallbacks.${name}:recovery:lean`), name);
	}
	// The unrefined host callback of apply has no admitted role to measure.
	const visit = fixture.entries.find(item => item.label === "ReviewedCallbacks.visit");
	const apply = { ...visit, symbol: `${visit.symbol}_apply`, label: "ReviewedCallbacks.apply" };
	assert.throws(() => phpWasmCallbackEntrySelection(model, [...fixture.entries, apply])
		, /Selected callback has no admitted direction: ReviewedCallbacks\.apply/u);
});

test("callback selection names the constructor of each closure refusal validator", async () => {
	const model = JSON.parse(await readFile(
		`${callbackRefinementsPhpWasmHostedEvidence}/hosted/output/records/checked-record/reviewed/build-0/model.json`
	));
	const fixture = await phpWasmCallbackEntrySourceFixture("callback-checked-record");
	const { selected, validatorConstructors } = phpWasmCallbackEntrySelection(model, fixture.entries);
	const nested = selected.filter(item => item.kind === "validator"
		&& item.label.startsWith("CallbackCheckedRecords.makeNestedClosure:callback_validator:"));
	assert.equal(nested.length, 2);
	assert.deepEqual(nested.map(item => validatorConstructors[item.label]).sort()
		, ["CallbackCheckedRecords.checkedPositive", "CallbackCheckedRecords.mkWeighted"]);
	for(const label of Object.keys(validatorConstructors))
		assert.ok(selected.some(item => item.kind === "validator" && item.label === label), label);
	assert.ok(Object.keys(validatorConstructors).every(label => label.includes(":callback_validator:closure_")));
});

test("callback selection derives every selected-Subtype entry from the analyzer model", async () => {
	const model = JSON.parse(await readFile(
		"tests/fixtures/php-wasm-callback-entry/analyzer/callback-subtype-ordinary.model.json"));
	const fixture = await phpWasmCallbackEntrySourceFixture("callback-subtype");
	const { selected, validatorConstructors } = phpWasmCallbackEntrySelection(model, fixture.entries);
	for(const kind of ["public", "adapter", "validator", "recovery", "callback"
		, "rejection", "closure", "cleanup", "source", "constructor"])
		assert.ok(selected.some(item => item.kind === kind), kind);
	for(const name of ["callHost", "callHostMixed"])
		assert.ok(selected.some(item => item.label === `CallbackSubtypes.${name}:recovery:native`), name);
	for(const name of ["makeClosure", "makeMixedClosure"])
		assert.ok(selected.some(item => item.label === `CallbackSubtypes.${name}:closure:lean`), name);
	assert.deepEqual(Object.values(validatorConstructors)
		, ["CallbackSubtypes.checkedPositive", "CallbackSubtypes.checkedPositive"]);
	assert.ok(selected.every(item => !/Container/u.test(item.label)));
	assert.throws(() => phpWasmCallbackEntrySelection(model, [
		...fixture.entries
		, { symbol: "invented_constructor", kind: "constructor", label: "CallbackSubtypes.invented" }
	]), /constructor is absent from compiler refinements/u);
});

test("callback selection refuses authored identities outside the compiler model", async () => {
	const fixture = await phpWasmCallbackEntrySourceFixture("callback-fin");
	const model = modelFromReview(callbackFinPhpWasmReview());
	assert.throws(() => phpWasmCallbackEntrySelection(model, [
		...fixture.entries
		, { symbol: "invented_constructor", kind: "constructor"
			, label: "ReviewedCallbacks.invented" }
	]), /constructor is absent from compiler refinements/u);
	const source = fixture.entries.find(item => item.kind === "source");
	assert.throws(() => phpWasmCallbackEntrySelection(model, [
		...fixture.entries.filter(item => item !== source)
		, { ...source, label: "ReviewedCallbacks.unknown" }
	]), /closure body lacks a selected source owner|authored callback source selection differs/u);
});
