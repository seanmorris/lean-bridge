/**
 * Exercise the nineteen-base WIT model mutations on synthetic compiler models, including the
 * unrefined word width export that stopped the first producer launch's controls phase.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nominalPrimitiveSubtypeWitModelMutations } from "./nominal-primitive-subtype-wit-controls.mjs";

const subtype = constructor => ({ kind: "subtype", constructor });
const fin = { kind: "fin", bound: "3" };
const packet = constructor => ({ kind: "record", definition: "NominalPrimitiveSubtypes.Packet", fields: ["natValue", "digit"], arguments: [subtype(constructor), fin] });
const model = mode => ({
	pointerBits: 64
	, sourceIdentity: { extractorSha256: "a".repeat(64) }
	, exports: [
		{ name: "wordBits" }
		, { name: "produce", refinements: { parameters: [null], result: { kind: "option", arguments: [packet(null)] } } }
		, ...mode === "full" ? [{ name: "echoA", refinements: { parameters: [packet("NominalPrimitiveSubtypes.natA")], result: packet(null) } }] : []
	]
});

test("primitive-base WIT model mutations change refined exports and skip the unrefined word width", () => {
	for(const mode of ["full", "result-only"])
	{
		const mutations = nominalPrimitiveSubtypeWitModelMutations(mode);
		assert.equal(mutations.length, mode === "full" ? 6 : 5);
		for(const [index, mutate] of mutations.entries())
		{
			const original = model(mode), changed = structuredClone(original);
			mutate(changed); assert.notDeepEqual(changed, original, `mutation ${index} ${mode}`);
			assert.deepEqual(changed.exports[0], { name: "wordBits" }, "the unrefined export stays untouched");
		}
		const produce = model(mode), mutated = structuredClone(produce);
		mutations[4](mutated);
		assert.equal(mutated.exports[1].refinements.result.arguments[0].arguments[0].constructor, "NominalPrimitiveSubtypes.natA");
		mutations[3](mutated);
		assert.equal(mutated.exports[1].refinements.result.arguments[0].arguments[1].bound, "4");
	}
	// Without any refined export the leaf mutations refuse instead of passing vacuously.
	const unrefined = { pointerBits: 64, sourceIdentity: { extractorSha256: "a".repeat(64) }, exports: [{ name: "wordBits" }] };
	for(const mutate of nominalPrimitiveSubtypeWitModelMutations("full").slice(3))
		assert.throws(() => mutate(structuredClone(unrefined)), { name: "AssertionError" });
	// Result-only models carry no selected parameter constructor to mutate.
	assert.throws(() => nominalPrimitiveSubtypeWitModelMutations("full")[5](model("result-only")), { name: "AssertionError" });
});
