/**
 * Directional Subtype metadata for host callbacks and returned Lean closures.
 * These controls stay source-level; target runtimes prove execution separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { callbackRefinement } from "../src/abi/refinements.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { assertReviewedSubtypeCallback } from "../src/analyze/reviewed-refinements.mjs";
import "./helpers/callback-subtype-foundation-source-history-tests.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false };
const nativeNat = { kind: "primitive", name: "nat", lean: "Nat", abi };
const subtype = constructor => ({
	kind: "refinement", base: nativeNat
	, predicate: { kind: "subtype", constructor }, abi
});
const callback = (parameter, result) => ({ kind: "callback", parameters: [parameter], result, abi });
const transport = { kind: "primitive", name: "nat" };
const selected = constructor => ({ kind: "subtype", constructor });
const projected = { kind: "subtype", constructor: null };
const refinements = (parameter, result) => ({ parameters: [parameter], result });

test("native callback Subtypes retain opposite checked directions", () => {
	const host = callback(subtype(null), subtype("Callbacks.checkedReply"));
	const closure = callback(subtype("Callbacks.checkedArgument"), subtype(null));
	assert.equal(validateNativeType(host, 0, false, "parameter"), host);
	assert.equal(validateNativeType(closure, 0, false, "result"), closure);
	for(const [value, site] of [[host, "result"], [closure, "parameter"]])
		assert.throws(() => validateNativeType(value, 0, false, site), /invalid Subtype refinement/u);
	assert.throws(() => validateNativeType(host), /Subtype refinements require/u);
});

test("callback refinement trees authenticate exactly one Subtype direction", () => {
	const signature = { parameters: [transport], result: transport };
	const host = refinements(projected, selected("Callbacks.checkedReply"));
	const closure = refinements(selected("Callbacks.checkedArgument"), projected);
	assert.deepEqual(callbackRefinement(signature, host, [], "host"), host);
	assert.deepEqual(callbackRefinement(signature, closure, [], "closure"), closure);
	assert.deepEqual(callbackRefinement(signature, host), host);
	assert.deepEqual(callbackRefinement(signature, closure), closure);
	assert.throws(() => callbackRefinement(signature, host, [], "closure"), /direction/u);
	assert.throws(() => callbackRefinement(signature, closure, [], "host"), /direction/u);
	assert.throws(() => callbackRefinement(signature,
		refinements(selected("Callbacks.checkedArgument"), selected("Callbacks.checkedReply"))), /direction/u);
	assert.throws(() => callbackRefinement(signature,
		refinements(projected, projected)), /direction/u);
});

test("reviewed callback Subtypes preserve their directional identity", () => {
	const definition = {
		kind: "callback"
		, callable: { parameters: [{ type: transport }], result: { type: transport } }
		, source: { extensions: { "lean-lang.org/refinements": refinements(projected, selected("Callbacks.checkedReply")) } }
	};
	assert.equal(assertReviewedSubtypeCallback(definition), "host");
	definition.source.extensions["lean-lang.org/refinements"] = refinements(selected("Callbacks.checkedArgument"), projected);
	assert.equal(assertReviewedSubtypeCallback(definition), "closure");
	definition.source.extensions["lean-lang.org/refinements"] = refinements(projected, selected("Callbacks.otherReply"));
	assert.equal(assertReviewedSubtypeCallback(definition), "host");
	definition.source.extensions["lean-lang.org/refinements"].result.constructor = null;
	assert.throws(() => assertReviewedSubtypeCallback(definition), /direction/u);
});
