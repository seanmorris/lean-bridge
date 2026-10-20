/**
 * Shared ordinary/reviewed selections for callback Subtype npm consumers.
 *
 * @file
 */
import assert from "node:assert/strict";

export const callbackSubtypeFixture
	= "tests/fixtures/onboarding/callback-subtypes";
export const callbackSubtypeModule = "CallbackSubtypes";
export const callbackSubtypeName = "callbacksubtypes";
const qualified = name => `${callbackSubtypeModule}.${name}`;
const copy = refinement => ({ ownership: "copy", lifetime: null
	, ...refinement ? { refinement } : {} });
const constructor = { constructor: qualified("checkedPositive") };
const host = { ownership: "borrow", lifetime: { scope: "call", anchor: null }
	, callable: { parameters: [copy()], result: copy(constructor) } };
const closure = { ownership: "lease"
	, lifetime: { scope: "explicit", anchor: null }
	, callable: { parameters: [copy(constructor)], result: copy() } };
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });

export const callbackSubtypeContracts = Object.freeze({
	[qualified("callHost")]: { parameters: [host] }
	, [qualified("makeClosure")]: { parameters: [copy()], result: closure }
	, [qualified("callHostMixed")]: { parameters: [{ ...host
		, callable: { parameters: [copy(), copy()], result: copy(constructor) } }] }
	, [qualified("makeMixedClosure")]: { parameters: [copy()]
		, result: { ...closure, callable: { parameters: [copy(), copy(constructor)], result: copy() } } }
	, [qualified("callHostContainer")]: { parameters: [{ ...host
		, callable: { parameters: [copy()]
			, result: copy(tree("result", tree("option", constructor), null)) } }] }
	, [qualified("makeContainerClosure")]: { parameters: [copy()]
		, result: { ...closure
			, callable: { parameters: [copy(tree("array", tree("option", constructor)))]
				, result: copy() } } }
});

/**
 * Select constructors from ordinary source, or exports from reviewed IR.
 *
 * @param route - Ordinary source or reviewed IR.
 */
export const callbackSubtypeConfiguration = route => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	const base = { schemaVersion: 1, modules: [callbackSubtypeModule]
		, targets: { npm: { name: callbackSubtypeName, version: "1.0.0" } } };
	return route === "reviewed" ? base : {
		...base
		, exports: Object.keys(callbackSubtypeContracts)
		, arities: {
			[qualified("makeClosure")]: 1
			, [qualified("makeMixedClosure")]: 1
			, [qualified("makeContainerClosure")]: 1
		}
		, contracts: callbackSubtypeContracts
	};
};
