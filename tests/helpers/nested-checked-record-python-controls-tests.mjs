/**
 * Exercise the nested checked-record Python model mutations on synthetic compiler models.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nestedCheckedRecordPythonModelMutations } from "./nested-checked-record-python-controls.mjs";

const subtype = constructor => ({ kind: "subtype", constructor });
const fin = { kind: "fin", bound: "10" };
const packet = (constructor, word) => ({
	kind: "checked-record", definition: "NestedCheckedRecords.Packet", constructor
	, fields: ["digit", "word"], arguments: [structuredClone(fin), subtype(word)]
});
const produceOption = {
	name: "produceOption"
	, refinements: { parameters: [null], result: { kind: "option", arguments: [packet(null, null)] } }
};
const first = {
	name: "first"
	, refinements: {
		parameters: [packet("NestedCheckedRecords.mkPacket", "NestedCheckedRecords.mkWord")]
		, result: null
	}
};
const model = mode => ({
	pointerBits: 64
	, sourceIdentity: { extractorSha256: "a".repeat(64) }
	, exports: [structuredClone(produceOption), ...mode === "full" ? [structuredClone(first)] : []]
});

test("nested checked-record Python model mutations change refined exports and never pass vacuously", () => {
	for(const mode of ["full", "result-only"])
	{
		const mutations = nestedCheckedRecordPythonModelMutations(mode);
		assert.equal(mutations.length, mode === "full" ? 6 : 5);
		for(const [index, [label, mutate]] of mutations.entries())
		{
			const original = model(mode), changed = structuredClone(original);
			mutate(changed); assert.notDeepEqual(changed, original, `mutation ${index} ${label} ${mode}`);
		}
		const produced = structuredClone(model(mode));
		mutations[4][1](produced);
		assert.equal(produced.exports[0].refinements.result.arguments[0].constructor, "NestedCheckedRecords.mkPacket");
		mutations[3][1](produced);
		assert.equal(produced.exports[0].refinements.result.arguments[0].arguments[0].bound, "9");
	}
	// Without any refined export the leaf mutations refuse instead of passing vacuously.
	const unrefined = { pointerBits: 64, sourceIdentity: { extractorSha256: "a".repeat(64) }, exports: [{ name: "first" }] };
	for(const [, mutate] of nestedCheckedRecordPythonModelMutations("full").slice(3))
		assert.throws(() => mutate(structuredClone(unrefined)), { name: "AssertionError" });
	// Result-only models carry no selected parameter constructor to mutate.
	assert.throws(() => nestedCheckedRecordPythonModelMutations("full")[5][1](model("result-only")), { name: "AssertionError" });
});
