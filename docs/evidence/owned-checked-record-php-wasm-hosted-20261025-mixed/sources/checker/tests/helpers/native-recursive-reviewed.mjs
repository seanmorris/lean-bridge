/**
 * Independent contract for the native recursive stress source's extra exports.
 *
 * @file
 */
import { recursiveReviewedIr } from "./recursive-fixture.mjs";

/** Describe native word bounds, wide recursion and empty constructors. */
export const nativeRecursiveReviewedIr = () => {
	const ir = recursiveReviewedIr(), record = ir.types.find(type => type.name === "Scalars"), variant = ir.types.find(type => type.name === "Spine");
	const primitive = name => ({ kind: "primitive", name }), named = name => ({ kind: "named", id: `lean:Recursive.${name}` });
	const field = (name, type) => ({ name, type, mutability: "immutable", documentation: record.documentation });
	const make = (template, name, fields, cases) => ({ ...structuredClone(template)
		, id: `lean:Recursive.${name}`, name, fields, cases
		, source: { ...template.source, declaration: `Recursive.${name}` } });
	const branch = (name, fields) => ({ name, fields, documentation: variant.documentation });
	ir.types.push(make(variant, "Wide", [], [
		branch("next", [...Array.from({ length: 255 }, (_, i) => field(`field${i}`, primitive("uint16"))), field("child", named("Wide"))])
		, branch("leaf", [field("value", primitive("uint32"))])
	]), make(variant, "Marker", [], [branch("empty", []), branch("unit", [field("value", primitive("unit"))]), branch("next", [field("value", named("Marker"))])]
	), make(record, "EmptyRecord", [], []));
	const template = ir.declarations.find(item => item.name === "spine");
	for(const [name, parameter, result] of [
		["wide", named("Wide"), named("Wide")]
		, ["units", { kind: "apply", constructor: "array", arguments: [primitive("unit")] }, { kind: "apply", constructor: "array", arguments: [primitive("unit")] }]
		, ["wordMax", primitive("usize"), primitive("bool")]
		, ["signedMin", primitive("isize"), primitive("bool")]
		, ["marker", named("Marker"), named("Marker")]
		, ["emptyRecord", named("EmptyRecord"), named("EmptyRecord")]
	]) ir.declarations.push({ ...structuredClone(template)
		, id: `lean:Recursive.${name}`, name
		, overloadKey: `Recursive.${name}`
		, parameters: [{ ...template.parameters[0], type: parameter }]
		, result: { ...template.result, type: result }
		, source: { ...template.source, declaration: `Recursive.${name}` } });
	return ir;
};
