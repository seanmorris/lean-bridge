/**
 * Shared ordinary/reviewed selections for checked records crossing host
 * callbacks and leased Lean closures: a host reply and a closure argument
 * select the exact record constructor, a host callback argument and a closure
 * result project the proof-backed payload.
 *
 * @file
 */
import assert from "node:assert/strict";

export const callbackCheckedRecordFixture
	= "tests/fixtures/onboarding/callback-checked-records";
export const callbackCheckedRecordModule = "CallbackCheckedRecords";
export const callbackCheckedRecordName = "callbackcheckedrecords";
const qualified = name => `${callbackCheckedRecordModule}.${name}`;
const copy = refinement => ({ ownership: "copy", lifetime: null
	, ...refinement ? { refinement } : {} });
const field = (name, refinement = null) => ({ name, refinement });
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const host = (parameters, result) => ({ ownership: "borrow"
	, lifetime: { scope: "call", anchor: null }
	, callable: { parameters, result } });
const closure = (parameters, result) => ({ ownership: "lease"
	, lifetime: { scope: "explicit", anchor: null }
	, callable: { parameters, result } });

/** The host-produced interval: its exact constructor over both payload fields. */
export const callbackCheckedRecordInterval = Object.freeze({
	kind: "checked-record", name: qualified("Interval")
	, constructor: qualified("mkInterval"), fields: [field("lo"), field("hi")]
});
/** The host-produced weighted record: its Subtype field runs first, then the record. */
export const callbackCheckedRecordWeighted = Object.freeze({
	kind: "checked-record", name: qualified("Weighted")
	, constructor: qualified("mkWeighted")
	, fields: [field("weight", { constructor: qualified("checkedPositive") }), field("limit")]
});

export const callbackCheckedRecordContracts = Object.freeze({
	[qualified("callHost")]: { parameters: [host([copy()], copy(callbackCheckedRecordInterval))], result: copy() }
	, [qualified("makeClosure")]: { parameters: [copy()]
		, result: closure([copy(callbackCheckedRecordInterval)], copy()) }
	, [qualified("callHostMixed")]: { parameters: [host([copy(), copy()], copy(callbackCheckedRecordInterval))], result: copy() }
	, [qualified("makeMixedClosure")]: { parameters: [copy()]
		, result: closure([copy(), copy(callbackCheckedRecordInterval)], copy()) }
	, [qualified("callHostContainer")]: {
		parameters: [host([copy()], copy(tree("result", tree("option", callbackCheckedRecordInterval), null)))]
		, result: copy()
	}
	, [qualified("makeContainerClosure")]: { parameters: [copy()]
		, result: closure([copy(tree("array", tree("option", callbackCheckedRecordInterval)))], copy()) }
	, [qualified("callHostNested")]: { parameters: [host([copy()], copy(callbackCheckedRecordWeighted))], result: copy() }
	, [qualified("makeNestedClosure")]: { parameters: [copy()]
		, result: closure([copy(callbackCheckedRecordWeighted)], copy()) }
});

/** Closure makers take one seed argument; the compiler would otherwise curry the closure. */
export const callbackCheckedRecordArities = Object.freeze({
	[qualified("makeClosure")]: 1
	, [qualified("makeMixedClosure")]: 1
	, [qualified("makeContainerClosure")]: 1
	, [qualified("makeNestedClosure")]: 1
});

/**
 * Select constructors from ordinary source, or exports from reviewed IR.
 *
 * @param route - Ordinary source or reviewed IR.
 */
export const callbackCheckedRecordConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const base = { schemaVersion: 1, modules: [callbackCheckedRecordModule]
		, targets: { npm: { name: callbackCheckedRecordName, version: "1.0.0" } } };
	return route === "reviewed" ? base : {
		...base
		, exports: Object.keys(callbackCheckedRecordContracts)
		, arities: { ...callbackCheckedRecordArities }
		, contracts: structuredClone(callbackCheckedRecordContracts)
	};
};

/**
 * Replace extractor provenance with an independent reviewed-contract producer.
 *
 * @param ir - Ordinary source Binding IR used only to establish the review.
 */
export const callbackCheckedRecordReviewedIr = ir => {
	const result = structuredClone(ir);
	result.producers = [{ id: "review"
		, adapter: "independent-callback-checked-record-review"
		, adapterVersion: 1
		, tool: "Callback checked-record contract review"
		, toolVersion: "1", extensions: {} }];
	for(const item of [...result.declarations, ...result.types]) item.source.producer = "review";
	for(const declaration of result.declarations)
	{
		const refinements = declaration.source.extensions["lean-lang.org/refinements"];
		declaration.source.extensions = refinements ? { "lean-lang.org/refinements": refinements } : {};
	}
	return result;
};
