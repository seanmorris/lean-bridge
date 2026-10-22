/** @file */
import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCallableGraphDescriptor } from "../../src/build/native-callable-graph.mjs";
import { callbackFinPhpWasmReview } from "./callback-fin-php-wasm-fixture.mjs";
import { phpWasmCallbackEntryPlan } from "./php-wasm-callback-entry-plan.mjs";
import { phpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-selection.mjs";
import { phpWasmCallbackEntrySourceFixture } from "./php-wasm-callback-entry-source-fixtures.mjs";

const modelFromReview = ir => {
	const copiedGraph = createNativeCallableGraphDescriptor(ir);
	const exports = ir.declarations.map(declaration => {
		const entry = copiedGraph.exports.find(item => item.bindingId === declaration.id);
		const refinements = declaration.source.extensions["lean-lang.org/refinements"];
		return { module: "ReviewedCallbacks", name: declaration.source.declaration
			, bindingId: declaration.id, symbol: `${entry.symbol}_lean`
			, parameters: declaration.parameters.map(() => ({ leanType: "" }))
			, ...refinements ? { refinements } : {} };
	});
	return { schemaVersion: 5, profile: "php-wasm-copied-v1", pointerBits: 32
		, byteOrder: "little", component: ir.component, bindingIr: ir
		, copiedGraph, exports, types: [] };
};

test("Fin callback plan separates preflight refusal, reply rejection and recovery", async () => {
	const source = await phpWasmCallbackEntrySourceFixture("callback-fin");
	const selected = phpWasmCallbackEntrySelection(
		modelFromReview(callbackFinPhpWasmReview()), source.entries
	).selected;
	const plan = phpWasmCallbackEntryPlan("callback-fin", selected);
	assert.deepEqual(plan.cases.map(item => item.control), [
		"closure-input", "closure-input-refusal", "closure-input-recovery"
		, "closure-result", "host-arguments", "invalid-recovery"
		, "actual-reply-rejection", "later-call-recovery"
	]);
	assert.deepEqual(plan.cases.find(item => item.control === "invalid-recovery").calls, []);
	const rejection = plan.cases.find(item => item.control === "actual-reply-rejection")
		.calls[0].entries.map(item => item.kind);
	assert.deepEqual(rejection.slice(-3), ["rejection", "rejection", "cleanup"]);
	const visit = plan.cases.find(item => item.control === "host-arguments").calls[0];
	assert.equal(visit.counts.callback, 15);
	assert.equal(visit.counts.cleanup, 1);
});

test("checked-record callback plan keeps Subtype-before-record constructor order", () => {
	const labels = [
		["constructor", "CallbackCheckedRecords.mkInterval"]
		, ["constructor", "CallbackCheckedRecords.checkedPositive"]
		, ["constructor", "CallbackCheckedRecords.mkWeighted"]
	];
	const sources = ["callHost", "callHostMixed", "callHostNested"
		, "makeClosure", "makeMixedClosure", "makeNestedClosure"];
	for(const name of sources)
	{
		const base = `CallbackCheckedRecords.${name}`;
		labels.push(["source", base], ["public", base]
			, ["adapter", `${base}:native`], ["adapter", `${base}:lean`]
			, ["cleanup", `${base}:cleanup`]);
		if(name.startsWith("callHost")) labels.push(
			["recovery", `${base}:recovery:lean`], ["recovery", `${base}:recovery:native`]
			, ["callback", `${base}:callback:lean`], ["callback", `${base}:callback:native`]
			, ["callback", `${base}:callback:zend`], ["rejection", `${base}:rejection:lean`]
			, ["rejection", `${base}:rejection:native`]
		);
		else labels.push(["closure", `${base}:body`], ["public", `${base}:invoke`]
			, ["adapter", `${base}:closure:native`], ["adapter", `${base}:closure:lean`]
			, ["cleanup", `${base}:invoke:cleanup`]);
	}
	const selected = labels.map(([kind, label], index) => ({
		symbol: `probe_${index}`, kind, label
	}));
	const plan = phpWasmCallbackEntryPlan("callback-checked-record", selected);
	const nested = plan.cases.find(item => item.control === "nested-subtype").calls[0];
	const constructors = nested.entries.filter(item => item.kind === "constructor")
		.map(item => item.label);
	assert.deepEqual(constructors, [
		"CallbackCheckedRecords.checkedPositive", "CallbackCheckedRecords.mkWeighted"
		, "CallbackCheckedRecords.checkedPositive"
		, "CallbackCheckedRecords.mkWeighted"
	]);
	assert.deepEqual(plan.cases.find(item => item.control === "closure-input-refusal").calls, []);
});
