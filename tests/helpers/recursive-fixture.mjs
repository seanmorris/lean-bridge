/**
 * Independently authored recursive public contract, not extracted metadata.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const p = name => ({ kind: "primitive", name });
const n = name => ({ kind: "named", id: `lean:Recursive.${name}` });
const a = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const documentation = { summary: "Independent recursive contract.", details: "" };
const fields = values => Object.entries(values).map(([name, type]) => ({ name, type, mutability: "immutable", documentation }));
const definition = (name, kind, values) => ({
	id: `lean:Recursive.${name}`, name, kind, representation: "copied"
	, mutability: "immutable", typeParameters: []
	, fields: kind === "record" ? fields(values) : []
	, cases: kind === "variant" ? Object.entries(values).map(([name, values]) => ({ name, fields: fields(values), documentation })) : []
	, target: kind === "alias" ? values : null
	, resource: null, callable: null, host: null, documentation
	, source: { producer: "corpusReview", declaration: `Recursive.${name}`, extensions: {} }
	, assurance: []
});
export const recursiveScalarFields = {
	unit: "unit", bool: "bool", u8: "uint8", u16: "uint16", u32: "uint32"
	, u64: "uint64", i8: "int8", i16: "int16", i32: "int32", i64: "int64"
	, natural: "nat", integer: "int", f32: "float32", f64: "float64"
	, text: "string", bytes: "bytes", char: "char", word: "usize"
	, signedWord: "isize"
};
export const recursiveSignatures = [
	...["Tree", "Forest", "Envelope", "Scalars", "LeftTree", "RightTree", "Never", "Spine"].map((name, index) => ({
		name: `Recursive.${["tree", "forest", "envelope", "scalars", "left", "right", "never", "spine"][index]}`
		, parameters: [n(name)], result: n(name) }))
	, { name: "Recursive.grow", parameters: [n("Spine")], result: n("Spine") }
	, { name: "Recursive.empty", parameters: [], result: n("Tree") }
	, { name: "Recursive.joinTrees", parameters: [n("Tree"), n("Tree")], result: n("Tree") }
	, { name: "Recursive.inspect", parameters: [n("Scalars")], result: p("bool") }
];

/** Build an independent reviewed IR without compiler facts or wire tags. */
export const recursiveReviewedIr = () => {
	const ir = corpusReviewedIr({ id: "recursive" }, recursiveSignatures.map(item => ({ name: item.name, parameters: item.parameters.map(() => "unit"), result: "unit" })));
	ir.declarations.forEach((item, index) => {
		item.parameters.forEach((parameter, offset) => { parameter.type = structuredClone(recursiveSignatures[index].parameters[offset]); });
		item.result.type = structuredClone(recursiveSignatures[index].result);
	});
	ir.types = [
		definition("Scalars", "record", Object.fromEntries(Object.entries(recursiveScalarFields).map(([name, type]) => [name, p(type)])))
		, definition("Tree", "variant", { branch: { children: a("list", n("Tree")) }, leaf: { payload: n("Scalars") } })
		, definition("LeftTree", "variant", { next: { right: n("RightTree") }, leaf: { value: p("uint32") } })
		, definition("RightTree", "variant", { many: { lefts: a("array", n("LeftTree")) } })
		, definition("Forest", "alias", a("list", n("Tree")))
		, definition("TreeAlias", "alias", n("Tree"))
		, definition("Envelope", "record", { tree: n("TreeAlias"), alternatives: a("array", n("Forest")), fallback: a("option", n("Tree")), outcome: a("result", a("tuple", n("Tree"), n("Tree")), p("string")), marker: a("option", a("option", p("unit"))) })
		, definition("Never", "variant", { again: { value: n("Never") } })
		, definition("Spine", "variant", { next: { value: n("Spine") }, leaf: { value: p("uint32") } })
	].sort((left, right) => left.id.localeCompare(right.id));
	return ir;
};
