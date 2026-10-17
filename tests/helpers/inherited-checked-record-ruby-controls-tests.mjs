/**
 * Exercise inherited checked-record Ruby model mutations on synthetic compiler models.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	inheritedCheckedRecordRubyModelMutations
} from "./inherited-checked-record-ruby-controls.mjs";

const span = constructor => ({
	kind: "checked-record", definition: "InheritedCheckedRecords.Span"
	, constructor, fields: ["lo", "hi"], arguments: [null, null]
});
const ticket = (constructor, word) => ({
	kind: "checked-record", definition: "InheritedCheckedRecords.Ticket"
	, constructor, fields: ["toSpan", "word"]
	, arguments: [span(constructor), { kind: "subtype", constructor: word }]
});
const stamped = constructor => ({
	kind: "checked-record", definition: "InheritedCheckedRecords.Stamped"
	, constructor, fields: ["toTicket", "mark"]
	, arguments: [ticket(null, null), { kind: "fin", bound: "8" }]
});
const produced = {
	name: "produce"
	, refinements: { parameters: [null], result: ticket(null, null) }
};
const producedStamped = {
	name: "produceStamped"
	, refinements: { parameters: [null], result: stamped(null) }
};
const first = {
	name: "first"
	, refinements: {
		parameters: [ticket(
			"InheritedCheckedRecords.mkTicket"
			, "InheritedCheckedRecords.mkWord"
		)]
		, result: null
	}
};
const model = mode => ({
	pointerBits: 64
	, sourceIdentity: { extractorSha256: "a".repeat(64) }
	, exports: [structuredClone(produced), structuredClone(producedStamped)
		, ...mode === "full" ? [structuredClone(first)] : []]
});

test("inherited checked-record Ruby model mutations change refined exports and never pass vacuously", () => {
	for(const mode of ["full", "result-only"])
	{
		const mutations = inheritedCheckedRecordRubyModelMutations(mode);
		assert.equal(mutations.length, mode === "full" ? 6 : 5);
		for(const [index, [label, mutate]] of mutations.entries())
		{
			const original = model(mode), changed = structuredClone(original);
			mutate(changed);
			assert.notDeepEqual(changed, original
				, `mutation ${index} ${label} ${mode}`);
		}
		const changed = structuredClone(model(mode));
		mutations[4][1](changed);
		assert.equal(changed.exports[0].refinements.result.constructor
			, "InheritedCheckedRecords.mkTicket");
		mutations[3][1](changed);
		assert.equal(changed.exports[1].refinements.result.arguments[1].bound, "9");
	}
	const unrefined = {
		pointerBits: 64
		, sourceIdentity: { extractorSha256: "a".repeat(64) }
		, exports: [{ name: "first" }]
	};
	for(const [, mutate] of inheritedCheckedRecordRubyModelMutations("full").slice(3))
		assert.throws(() => mutate(structuredClone(unrefined))
			, { name: "AssertionError" });
	assert.throws(() => inheritedCheckedRecordRubyModelMutations("full")[5][1](
		model("result-only")
	), { name: "AssertionError" });
});
