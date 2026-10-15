/**
 * Independent nineteen-base constructor mutation targets for Rust acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";

/**
 * Exercise all nineteen named constructor sites and the independent Fin sibling.
 *
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeRustModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	const output = model => model.exports.find(item => item.name === "NominalPrimitiveSubtypes.produce").refinements.result.arguments[0];
	const input = model => model.exports.find(item => item.name === "NominalPrimitiveSubtypes.echoB").refinements.parameters[0];
	const mutations = [
		["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["wrong native word width", model => { model.pointerBits = 32; }]
		, ["changed output Fin bound", model => {
			const tree = output(model); assert.equal(tree.fields.at(-1), "digit");
			tree.arguments.at(-1).bound = "4";
		}]
	];
	for(const [index, field] of nominalPrimitiveSubtypeFields.entries())
	{
		mutations.push(["invented output constructor: " + field.name, model => {
			const tree = output(model); assert.equal(tree.fields[index], field.name);
			assert.equal(tree.arguments[index].constructor, null);
			tree.arguments[index].constructor = "NominalPrimitiveSubtypes." + field.constructor + "A";
		}]);
		if(mode === "full")
		{
			mutations.push(["replaced input constructor: " + field.name, model => {
				const tree = input(model); assert.equal(tree.fields[index], field.name);
				assert.equal(tree.arguments[index].constructor, "NominalPrimitiveSubtypes." + field.constructor + "B");
				tree.arguments[index].constructor = "NominalPrimitiveSubtypes." + field.constructor + "A";
			}]);
		}
	}
	return mutations;
};
