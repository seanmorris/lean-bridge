/**
 * Independent plan controls for all #1824 graph entry families.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypePhpWasmReview
} from "./nominal-primitive-subtype-php-wasm-fixture.mjs";
import {
	recursiveCheckedRecordPhpWasmReview
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import { phpWasmRefinementEntryPlan } from "./php-wasm-refinement-entry-plan.mjs";
import { phpWasmGraphRefinementEntrySelection } from "./php-wasm-refinement-entry-selection.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";
import { phpWasmRefinementEntrySourceFixture } from "./php-wasm-refinement-entry-source-fixtures.mjs";
import { recursiveSubtypeReview } from "./recursive-subtype-fixture.mjs";
import { readFile } from "node:fs/promises";

const fixtureModel = family => {
	const nominal = family.startsWith("nominal-");
	const bindingIr = nominal
		? nominalPrimitiveSubtypePhpWasmReview(family === "nominal-result-only" ? "result-only" : "full")
		: family === "recursive-subtype" ? recursiveSubtypeReview()
			: recursiveCheckedRecordPhpWasmReview("recursive");
	const module = nominal ? "NominalPrimitiveSubtypes"
		: family === "recursive-subtype" ? "RecursiveSubtypes" : "RecursiveCheckedRecords";
	const exports = bindingIr.declarations.map(item => ({
		bindingId: item.id
		, symbol: `lean_bridge_${sha256(bindingIr.component.id + "\0" + item.id).slice(0, 24)}`
		, parameters: item.parameters.map(site => site.type)
		, result: item.result.type, resultMode: item.resultMode
	}));
	const copiedGraph = { schemaVersion: 1
		, types: componentRecordDefinitions(bindingIr, true), exports };
	return {
		schemaVersion: 5, profile: "php-wasm-copied-v1"
		, pointerBits: 32, byteOrder: "little", component: bindingIr.component
		, bindingIr, copiedGraph
		, exports: bindingIr.declarations.map((declaration, index) => ({
			bindingId: declaration.id, symbol: `${exports[index].symbol}_lean`
			, name: declaration.source.declaration, module
			, parameters: declaration.parameters.map(() => ({}))
			, ...declaration.source.extensions["lean-lang.org/refinements"] ? {
				refinements: declaration.source.extensions["lean-lang.org/refinements"]
			} : {}
		}))
	};
};

const plan = async family => {
	const marker = phpWasmRefinementEntrySourceFixture(family);
	const source = phpWasmRefinementEntrySource(await readFile(marker.path, "utf8"), marker);
	const selection = phpWasmGraphRefinementEntrySelection(fixtureModel(family), source.entries);
	return phpWasmRefinementEntryPlan(family, selection.selected, selection.generated.leanSource);
};

test("every graph entry family has a closed semantic call plan", async () => {
	for(const family of [
		"nominal-full", "nominal-result-only", "recursive-subtype"
		, "recursive-checked-record"
	]) {
		const value = await plan(family);
		assert.equal(value.family, family); assert.equal(value.scope, "separate-instrumented-probe");
		assert.ok(value.selected.length > value.cases.length);
		assert.ok(value.cases.every(item => item.call.counts.adapter === (item.outcome === "accepted" ? 1 : 0)));
		assert.ok(value.cases.every(item => item.call.counts.source > 0 === (item.outcome === "accepted")));
		assert.ok(value.cases.some(item => item.control === "constructor-free"));
		if(family !== "nominal-result-only")
		{
			assert.ok(value.cases.some(item => item.control === "first-refusal" && item.outcome === "refused"));
			assert.ok(value.cases.some(item => item.control === "recovery" && item.outcome === "accepted"));
			assert.ok(value.cases.some(item => item.control === "active-branch" || item.control === "repeated-fields"));
		}
		else assert.ok(value.cases.every(item => item.call.counts.constructor === 0));
	}
});

test("checked-record refusal plans name compiler-authenticated diagnostic validators", async () => {
	const value = await plan("recursive-checked-record");
	const first = value.cases.find(item => item.control === "first-refusal");
	const record = value.cases.find(item => item.control === "record-refusal");
	assert.equal(first.call.entries.filter(item => item.label.includes(":graph_refinement_0_")).length, 2);
	assert.equal(record.call.entries.filter(item => item.label.includes(":graph_refinement_0_")).length, 2);
	assert.notDeepEqual(first.call.entries, record.call.entries);
	for(const item of [...first.call.entries, ...record.call.entries].filter(item => item.kind === "validator"))
		assert.ok(value.selected.some(selected => selected.kind === item.kind && selected.label === item.label));
});

test("graph entry plans refuse incomplete compiler selections and generated source drift", async () => {
	const family = "recursive-checked-record", marker = phpWasmRefinementEntrySourceFixture(family);
	const source = phpWasmRefinementEntrySource(await readFile(marker.path, "utf8"), marker);
	const selection = phpWasmGraphRefinementEntrySelection(fixtureModel(family), source.entries);
	for(const selected of [selection.selected.slice(1), selection.selected.filter(item => item.kind !== "constructor")])
		assert.throws(() => phpWasmRefinementEntryPlan(family, selected, selection.generated.leanSource));
	assert.throws(() => phpWasmRefinementEntryPlan(family, selection.selected
		, selection.generated.leanSource.replace("_root_.RecursiveCheckedRecords.mkPacket", "_root_.RecursiveCheckedRecords.changed")));
});
