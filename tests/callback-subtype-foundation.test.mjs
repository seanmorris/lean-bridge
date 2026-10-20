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
import { reviewedSubtypeContracts } from "../src/analyze/reviewed-subtypes.mjs";
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

test("reviewed callback Subtypes become exact compiler callback contracts", () => {
	const primitive = { kind: "primitive", name: "nat" };
	const copied = { type: primitive, ownership: "copy", lifetime: null };
	const callback = (id, refinements) => ({
		id, kind: "callback"
		, callable: { parameters: [copied], result: copied }
		, source: { declaration: id.slice(7)
			, extensions: { "lean-lang.org/refinements": refinements } }
	});
	const hostDefinition = callback("bridge:Host", {
		parameters: [projected], result: selected("Callbacks.checkedReply")
	});
	const closureDefinition = callback("bridge:Closure", {
		parameters: [selected("Callbacks.checkedArgument")], result: projected
	});
	const named = id => ({ kind: "named", id });
	const declarations = [
		{
			source: { declaration: "Callbacks.call", extensions: {} }
			, parameters: [{ type: named(hostDefinition.id), ownership: "borrow"
				, lifetime: { scope: "call", anchor: null } }]
			, result: copied
		}
		, {
			source: { declaration: "Callbacks.make", extensions: {} }
			, parameters: [copied]
			, result: { type: named(closureDefinition.id), ownership: "lease"
				, lifetime: { scope: "explicit", anchor: null } }
		}
	];
	const contracts = reviewedSubtypeContracts({ declarations
		, types: [hostDefinition, closureDefinition] });
	assert.deepEqual(contracts, {
		"Callbacks.call": {
			parameters: [{ ownership: "borrow"
				, lifetime: { scope: "call", anchor: null }
				, callable: { parameters: [{ ownership: "copy", lifetime: null }]
					, result: { ownership: "copy", lifetime: null
						, refinement: { constructor: "Callbacks.checkedReply" } } } }]
			, result: { ownership: "copy", lifetime: null }
		}
		, "Callbacks.make": {
			parameters: [{ ownership: "copy", lifetime: null }]
			, result: { ownership: "lease"
				, lifetime: { scope: "explicit", anchor: null }
				, callable: { parameters: [{ ownership: "copy", lifetime: null
					, refinement: { constructor: "Callbacks.checkedArgument" } }]
					, result: { ownership: "copy", lifetime: null } } }
		}
	});
});
