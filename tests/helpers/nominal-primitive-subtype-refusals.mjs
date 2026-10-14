/**
 * Author type-correct Lean functions with deliberately invalid constructor selections.
 * Every base receives a wrong-input-type and an exact-predicate-mismatch control.
 *
 * @file
 */
import { nominalPrimitiveSubtypeFields, nominalPrimitiveSubtypeModule, nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";

const types = ["Unit", "Bool", "UInt8", "UInt16", "UInt32", "UInt64", "Int8", "Int16", "Int32", "Int64", "Nat", "Int", "Float32", "Float", "String", "ByteArray", "Char", "USize", "ISize"];
export const nominalPrimitiveRefusalModule = "NominalPrimitiveRefusals";

/**
 * Produce independently authored ordinary/reviewed negative APIs and safe Lean constructor definitions.
 */
export const nominalPrimitiveSubtypeRefusals = () => {
	const original = nominalPrimitiveSubtypeConfiguration("ordinary", ["c"]).contracts[`${nominalPrimitiveSubtypeModule}.echoA`];
	const review = nominalPrimitiveSubtypeReview(), declaration = review.declarations.find(item => item.name === "echoA");
	const declarations = [], contracts = {}, controls = [], lines = [`import ${nominalPrimitiveSubtypeModule}`, `namespace ${nominalPrimitiveRefusalModule}`];
	for(const [index, field] of nominalPrimitiveSubtypeFields.entries())
	{
		const bad = `wrongPredicate_${field.primitive}`;
		lines.push(`def ${bad} (_ : ${types[index]}) : Option (Subtype (fun _ : ${types[index]} => False)) := none`);
		for(const kind of ["input", "predicate"])
		{
			const name = `${kind}_${field.primitive}`, identity = `${nominalPrimitiveRefusalModule}.${name}`;
			lines.push(`def ${name} (value : ${nominalPrimitiveSubtypeModule}.Packet) : ${nominalPrimitiveSubtypeModule}.Packet := value`);
			const constructor = kind === "input" ? `${nominalPrimitiveSubtypeModule}.${field.primitive === "bool" ? "unitA" : "boolA"}` : `${nominalPrimitiveRefusalModule}.${bad}`;
			const contract = structuredClone(original);
			contract.parameters[0].refinement.fields[index].refinement.constructor = constructor;
			contracts[identity] = contract;
			const selected = structuredClone(declaration);
			selected.id = `lean:${identity}`; selected.name = name; selected.overloadKey = identity; selected.source.declaration = identity;
			selected.source.extensions["lean-lang.org/refinements"].parameters[0].fields[index].refinement.constructor = constructor;
			declarations.push(selected); controls.push({ identity, kind, primitive: field.primitive, field: field.name, constructor });
		}
	}
	lines.push(`end ${nominalPrimitiveRefusalModule}`);
	return { source: lines.join("\n") + "\n", contracts, controls, review: { ...review, declarations } };
};
