/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createNativeCallableGraphDescriptor } from "../../src/build/native-callable-graph.mjs";
import { callbackFinPhpWasmReview } from "./callback-fin-php-wasm-fixture.mjs";
import { phpWasmCallbackEntryFixture } from "./php-wasm-callback-entry-fixtures.mjs";
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
		, "mixed-closure-input", "mixed-closure-input-refusal"
		, "mixed-closure-input-recovery", "mixed-closure-result"
	]);
	const mixed = control => plan.cases.find(item => item.control === control);
	const kinds = call => call.entries.map(item => item.kind);
	assert.deepEqual(mixed("mixed-closure-input").calls.map(kinds), [
		["adapter", "adapter", "cleanup"]
		, ["adapter", "adapter", "source", "closure", "cleanup"]
	]);
	assert.equal(mixed("mixed-closure-input-refusal").outcome, "refused");
	assert.deepEqual(mixed("mixed-closure-input-refusal").calls.map(kinds)
		, [["adapter", "adapter", "cleanup"]], "the Fin field refuses before the closure body");
	assert.deepEqual(mixed("mixed-closure-input-recovery").calls.map(kinds)
		, [["adapter", "adapter", "source", "closure", "cleanup"]]);
	assert.deepEqual(mixed("mixed-closure-result").calls.map(kinds), [
		["adapter", "adapter", "cleanup"]
		, ["adapter", "adapter", "source", "closure", "cleanup"]
	]);
	assert.equal(mixed("mixed-closure-result").calls[1].entries[3].label
		, "ReviewedCallbacks.tileMaker:body");
	assert.deepEqual(plan.cases.find(
		item => item.control === "invalid-recovery"
	).calls[0].entries.map(item => item.kind)
	, ["adapter", "adapter", "recovery", "recovery", "cleanup"]);
	const closureInput = plan.cases.find(item => item.control === "closure-input");
	assert.equal(closureInput.calls[0].counts.source, 0);
	assert.deepEqual(closureInput.calls[1].entries.slice(0, 4).map(
		item => item.kind
	), ["adapter", "adapter", "source", "closure"]);
	assert.deepEqual(plan.cases.find(
		item => item.control === "closure-input-refusal"
	).calls[0].entries.map(item => item.kind)
	, ["adapter", "adapter", "cleanup"]);
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
	const nestedValidator = key => "CallbackCheckedRecords.makeNestedClosure:callback_validator:"
		+ `closure_graph_refinement_0_${key}`;
	labels.push([
		"validator"
		, "CallbackCheckedRecords.makeClosure:callback_validator:"
			+ "closure_graph_refinement_0_test"
	], ["validator", nestedValidator("weighted")], ["validator", nestedValidator("positive")]);
	const selected = labels.map(([kind, label], index) => ({
		symbol: `probe_${index}`, kind, label
	}));
	const validatorConstructors = {
		[nestedValidator("weighted")]: "CallbackCheckedRecords.mkWeighted"
		, [nestedValidator("positive")]: "CallbackCheckedRecords.checkedPositive"
	};
	assert.throws(() => phpWasmCallbackEntryPlan("callback-checked-record", selected)
		, /validator\/CallbackCheckedRecords\.makeNestedClosure\/CallbackCheckedRecords\.checkedPositive/u);
	const plan = phpWasmCallbackEntryPlan("callback-checked-record", selected
		, validatorConstructors);
	const nested = plan.cases.find(item => item.control === "nested-subtype").calls[0];
	const constructors = nested.entries.filter(item => item.kind === "constructor")
		.map(item => item.label);
	assert.deepEqual(constructors, [
		"CallbackCheckedRecords.checkedPositive", "CallbackCheckedRecords.mkWeighted"
		, "CallbackCheckedRecords.checkedPositive"
		, "CallbackCheckedRecords.mkWeighted"
	]);
	const closureRefusal = plan.cases.find(
		item => item.control === "closure-input-refusal"
	).calls[0];
	assert.deepEqual(closureRefusal.entries.map(item => item.kind)
		, ["adapter", "adapter", "constructor", "validator", "constructor", "cleanup"]);
	assert.equal(closureRefusal.entries[3].label
		, "CallbackCheckedRecords.makeClosure:callback_validator:"
			+ "closure_graph_refinement_0_test");
	assert.deepEqual(closureRefusal.entries.filter(item => item.kind === "constructor")
		.map(item => item.label), [
			"CallbackCheckedRecords.mkInterval", "CallbackCheckedRecords.mkInterval"
		]
	);
	assert.deepEqual(plan.cases.find(
		item => item.control === "invalid-recovery"
	).calls[0].entries.map(item => item.kind)
	, ["adapter", "adapter", "recovery", "recovery", "constructor", "cleanup"]);
	const rejected = plan.cases.find(
		item => item.control === "actual-reply-rejection"
	).calls[0];
	assert.equal(rejected.counts.constructor, 3);
	assert.deepEqual(rejected.entries.slice(-5).map(item => item.kind)
		, ["constructor", "rejection", "rejection", "constructor", "cleanup"]);
	const closureInput = plan.cases.find(item => item.control === "closure-input");
	assert.equal(closureInput.calls[0].counts.source, 0);
	assert.deepEqual(closureInput.calls[1].entries.slice(0, 5).map(
		item => item.kind
	), ["adapter", "adapter", "constructor", "closure", "cleanup"]);
	assert.deepEqual(plan.cases.find(item => item.control === "mixed-closure")
		.calls[1].entries.map(item => item.kind)
		, ["adapter", "adapter", "constructor", "cleanup"]);
	assert.deepEqual(plan.cases.find(item => item.control === "nested-closure")
		.calls[1].entries.map(item => item.kind)
		, ["adapter", "adapter", "constructor", "constructor", "closure", "cleanup"]);
	// The selected Subtype payload field is the first refusal; its record constructor never runs.
	const positiveOnly = call => call.entries.filter(item => item.kind === "constructor")
		.map(item => item.label.split(".").at(-1));
	const nestedRecovery = plan.cases.find(item => item.control === "nested-invalid-recovery");
	assert.equal(nestedRecovery.outcome, "refused");
	assert.deepEqual(nestedRecovery.calls[0].entries.map(item => item.kind)
		, ["adapter", "adapter", "recovery", "recovery", "constructor", "cleanup"]);
	assert.deepEqual(positiveOnly(nestedRecovery.calls[0]), ["checkedPositive"]);
	const nestedReply = plan.cases.find(item => item.control === "nested-reply-rejection").calls[0];
	assert.deepEqual(positiveOnly(nestedReply), [
		"checkedPositive", "mkWeighted", "checkedPositive"
		, "checkedPositive", "mkWeighted"
	]);
	assert.deepEqual(nestedReply.entries.slice(-6).map(item => item.kind)
		, ["constructor", "rejection", "rejection", "constructor", "constructor", "cleanup"]);
	const nestedClosure = plan.cases.find(item => item.control === "nested-closure-refusal").calls[0];
	assert.deepEqual(nestedClosure.entries.map(item => item.kind)
		, ["adapter", "adapter", "constructor", "validator", "constructor", "cleanup"]);
	assert.equal(nestedClosure.entries[3].label, nestedValidator("positive"));
	assert.deepEqual(positiveOnly(nestedClosure), ["checkedPositive", "checkedPositive"]);
});

test("selected-Subtype callback plan follows the analyzer-authenticated compiler model", async () => {
	const directory = "tests/fixtures/php-wasm-callback-entry/analyzer";
	const modelBytes = await readFile(`${directory}/callback-subtype-ordinary.model.json`);
	const identity = JSON.parse(await readFile(`${directory}/callback-subtype-ordinary.identity.json`));
	assert.equal(identity.scope, "analyzer-only-compiler-model");
	assert.equal(sha256(modelBytes), identity.modelSha256);
	const source = await phpWasmCallbackEntrySourceFixture("callback-subtype");
	assert.equal(source.probeSha256, identity.probeSha256, "analyzer model binds the current probe source");
	assert.equal(source.originalSha256, identity.fixtureLeanSha256, "admitted fixture source is unchanged");
	const model = JSON.parse(modelBytes);
	const configuration = phpWasmCallbackEntryFixture("callback-subtype", "ordinary").configuration;
	assert.equal(sha256(canonicalJson(configuration)), identity.configurationSha256);
	assert.equal(model.sourceIdentity.exportConfigurationSha256, identity.configurationSha256);
	assert.equal(model.sourceIdentity.leanCompilerSha256, identity.leanCompilerSha256);
	assert.equal(model.sourceIdentity.modules.find(item => item.module === "CallbackSubtypes")
		.source.sha256, identity.probeSha256, "the model was elaborated from the probe source");
	const selection = phpWasmCallbackEntrySelection(model, source.entries);
	const positive = "CallbackSubtypes.checkedPositive";
	assert.throws(() => phpWasmCallbackEntryPlan("callback-subtype", selection.selected)
		, /validator\/CallbackSubtypes\.makeClosure\/CallbackSubtypes\.checkedPositive/u);
	const plan = phpWasmCallbackEntryPlan("callback-subtype", selection.selected
		, selection.validatorConstructors);
	assert.deepEqual(plan.cases.map(item => [item.control, item.outcome]), [
		["host-reply", "accepted"], ["invalid-recovery", "refused"]
		, ["actual-reply-rejection", "refused"], ["later-call-recovery", "accepted"]
		, ["mixed-host", "accepted"], ["closure-input", "accepted"]
		, ["closure-input-refusal", "refused"], ["closure-input-recovery", "accepted"]
		, ["mixed-closure", "accepted"], ["mixed-closure-refusal", "refused"]
	]);
	const kinds = control => plan.cases.find(item => item.control === control)
		.calls.map(call => call.entries.map(item => item.kind));
	assert.deepEqual(kinds("invalid-recovery")
		, [["adapter", "adapter", "recovery", "recovery", "constructor", "cleanup"]]);
	assert.deepEqual(kinds("host-reply")[0], [
		"adapter", "adapter", "recovery", "recovery", "constructor", "source"
		, "callback", "callback", "callback", "constructor", "cleanup"
	]);
	assert.deepEqual(kinds("actual-reply-rejection")[0].slice(-5)
		, ["constructor", "rejection", "rejection", "constructor", "cleanup"]);
	assert.deepEqual(kinds("closure-input")[1]
		, ["adapter", "adapter", "constructor", "closure", "cleanup"]);
	assert.deepEqual(kinds("mixed-closure")[1], ["adapter", "adapter", "constructor", "cleanup"]);
	for(const control of ["closure-input-refusal", "mixed-closure-refusal"])
	{
		assert.deepEqual(kinds(control)
			, [["adapter", "adapter", "constructor", "validator", "constructor", "cleanup"]]);
		const validator = plan.cases.find(item => item.control === control).calls[0].entries[3];
		assert.equal(selection.validatorConstructors[validator.label], positive);
	}
	assert.match(plan.cases.find(item => item.control === "mixed-closure-refusal")
		.calls[0].entries[3].label, /makeMixedClosure:callback_validator:closure_graph_refinement_1_/u);
	assert.ok(selection.selected.every(item => !/Container/u.test(item.label))
		, "container exports stay compiled but unselected");
});
