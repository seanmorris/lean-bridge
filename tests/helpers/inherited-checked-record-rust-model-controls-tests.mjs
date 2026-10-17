/**
 * Exercise the inherited checked-record Rust model mutations on synthetic compiler models.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inheritedCheckedRecordRustModelMutations } from "./inherited-checked-record-rust-model-controls.mjs";

const subtype = constructor => ({ kind: "subtype", constructor });
const fin = { kind: "fin", bound: "8" };
const span = constructor => ({
	kind: "checked-record", definition: "InheritedCheckedRecords.Span", constructor
	, fields: ["lo", "hi"], arguments: [null, null]
});
const ticket = (constructor, parent, word) => ({
	kind: "checked-record"
	, definition: "InheritedCheckedRecords.Ticket", constructor
	, fields: ["toSpan", "word"], arguments: [span(parent), subtype(word)]
});
const stamped = (constructor, child, parent, word) => ({
	kind: "checked-record"
	, definition: "InheritedCheckedRecords.Stamped", constructor
	, fields: ["toTicket", "mark"]
	, arguments: [ticket(child, parent, word), structuredClone(fin)]
});
const produceStamped = {
	name: "produceStamped"
	, refinements: {
		parameters: [null], result: stamped(null, null, null, null)
	}
};
const first = {
	name: "first"
	, refinements: {
		parameters: [ticket("InheritedCheckedRecords.mkTicket"
			, "InheritedCheckedRecords.mkSpan", "InheritedCheckedRecords.mkWord")]
		, result: null
	}
};
const model = mode => ({
	pointerBits: 64
	, sourceIdentity: { extractorSha256: "a".repeat(64) }
	, exports: [structuredClone(produceStamped)
		, ...mode === "full" ? [structuredClone(first)] : []]
});

test("inherited checked-record Rust model mutations change refined exports and never pass vacuously", () => {
	for(const mode of ["full", "result-only"])
	{
		const mutations = inheritedCheckedRecordRustModelMutations(mode);
		assert.equal(mutations.length, mode === "full" ? 6 : 5);
		for(const [index, [label, mutate]] of mutations.entries())
		{
			const original = model(mode), changed = structuredClone(original);
			mutate(changed); assert.notDeepEqual(changed, original, `mutation ${index} ${label} ${mode}`);
		}
		const produced = structuredClone(model(mode));
		mutations[4][1](produced);
		assert.equal(produced.exports[0].refinements.result.constructor
			, "InheritedCheckedRecords.mkTicket");
		mutations[3][1](produced);
		assert.equal(produced.exports[0].refinements.result.arguments[1].bound, "9");
	}
	// Without any refined export the leaf mutations refuse instead of passing vacuously.
	const unrefined = { pointerBits: 64, sourceIdentity: { extractorSha256: "a".repeat(64) }, exports: [{ name: "first" }] };
	for(const [, mutate] of inheritedCheckedRecordRustModelMutations("full").slice(3))
		assert.throws(() => mutate(structuredClone(unrefined)), { name: "AssertionError" });
	// Result-only models carry no selected parameter constructor to mutate.
	assert.throws(() => inheritedCheckedRecordRustModelMutations("full")[5][1](model("result-only")), { name: "AssertionError" });
});
