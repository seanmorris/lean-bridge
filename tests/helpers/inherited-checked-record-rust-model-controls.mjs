/**
 * Independent inherited checked-record compiler-model mutation targets for Rust acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";

// Every inherited export carries a refinement tree; keep the filter explicit anyway.
const refined = model => model.exports.flatMap(item => item.refinements ? [item.refinements] : []);
const replaceLeaf = (value, predicate, mutate) => {
	if(!value || typeof value !== "object") return false;
	if(predicate(value))
	{ mutate(value); return true; }
	return Object.values(value).some(child => replaceLeaf(child, predicate, mutate));
};

/**
 * Coordinated compiler-model mutations that every retained build must refuse.
 * Each mutation asserts that it found a leaf to change, so an unrefined model cannot pass vacuously.
 *
 * @param mode - Full or result-only API; only the full API carries parameter constructors.
 */
export const inheritedCheckedRecordRustModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	return [
		["wrong native word width", model => { model.pointerBits = 32; }]
		, ["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["changed Fin bound", model => { assert.ok(replaceLeaf(refined(model), item => item.kind === "fin", item => { item.bound = "9"; })); }]
		, ["invented result constructor", model => { assert.ok(replaceLeaf(refined(model).map(item => item.result), item => item.kind === "checked-record", item => { item.constructor = "InheritedCheckedRecords.mkTicket"; })); }]
		, ...mode === "full" ? [["unreviewed parameter constructor", model => { assert.ok(replaceLeaf(refined(model).map(item => item.parameters), item => item.kind === "subtype" && item.constructor !== null, item => { item.constructor = "InheritedCheckedRecords.unreviewed"; })); }]] : []
	];
};
