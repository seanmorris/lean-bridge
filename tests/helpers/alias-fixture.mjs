/**
 * Independently specified names, targets and signatures for copied aliases.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const aliasPrimitives = {
	AUnit: "unit", ABool: "bool", AU8: "uint8", AU16: "uint16"
	, AU32: "uint32", AU64: "uint64", AI8: "int8", AI16: "int16"
	, AI32: "int32", AI64: "int64", ANat: "nat", AInt: "int"
	, AF32: "float32", AF64: "float64", AText: "string", ABytes: "bytes"
	, AChar: "char", AWord: "usize", ASignedWord: "isize"
};
const p = name => ({ kind: "primitive", name });
const n = name => ({ kind: "named", id: `lean:Aliases.${name}` });
const a = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const documentation = { summary: "Independent alias contract.", details: "" };
const fields = values => Object.entries(values).map(([name, type]) => ({ name, type, mutability: "immutable", documentation }));
const definition = (name, kind, value) => ({
	id: `lean:Aliases.${name}`, name, kind, representation: "copied"
	, mutability: "immutable", typeParameters: []
	, fields: kind === "record" ? fields(value) : []
	, cases: kind === "variant" ? Object.entries(value).map(([name, value]) => ({ name, fields: fields(value), documentation })) : []
	, target: kind === "alias" ? value : null
	, resource: null, callable: null, host: null, documentation
	, source: { producer: "corpusReview", declaration: `Aliases.${name}`, extensions: {} }
	, assurance: []
});
export const aliasSignatures = [
	...Object.entries(aliasPrimitives).map(([name, primitive]) => [`echo_${primitive}`, [n(name)], n(name)])
	, ["scalars", [n("ScalarsView")], n("ScalarsView")]
	, ["inspect", [n("ScalarsView")], p("bool")]
	, ["increment", [n("Count")], n("OtherCount")]
	, ["make", [], n("Count")], ["label", [], n("AText")]
	, ...["PacketView", "Packets", "Rows", "Maybe", "Outcome", "ModeView"].map((name, index) => [["packet", "packets", "rows", "maybe", "outcome", "mode"][index], [n(name)], n(name)])
	, ["duplicate", [n("ABytes")], n("Outcome")]
	, ["produce", [n("ANat")], n("ABytes")]
].map(([name, parameters, result]) => ({ name: `Aliases.${name}`, parameters, result }));

/** Declare each alias target without deriving it from compiler output. */
export const aliasReviewedIr = () => {
	const ir = corpusReviewedIr({ id: "aliases" }, aliasSignatures.map(item => ({ name: item.name, parameters: item.parameters.map(() => "unit"), result: "unit" })));
	ir.declarations.forEach((item, index) => {
		item.parameters.forEach((parameter, i) => { parameter.type = structuredClone(aliasSignatures[index].parameters[i]); });
		item.result.type = structuredClone(aliasSignatures[index].result);
	});
	ir.types = [
		...Object.entries(aliasPrimitives).map(([name, primitive]) => definition(name, "alias", p(primitive)))
		, definition("Scalars", "record", Object.fromEntries(Object.entries(aliasPrimitives).map(([name, primitive]) => [`v_${primitive}`, n(name)])))
		, definition("ScalarsView", "alias", n("Scalars"))
		, definition("Count", "alias", n("AU32"))
		, definition("OtherCount", "alias", p("uint32"))
		, definition("Rows", "alias", a("array", a("list", n("Count"))))
		, definition("Maybe", "alias", a("option", a("option", n("AUnit"))))
		, definition("Outcome", "alias", a("result", a("tuple", n("Count"), n("ABytes")), n("AText")))
		, definition("Packet", "record", { count: n("Count"), text: n("AText"), rows: n("Rows"), maybe: n("Maybe"), outcome: n("Outcome") })
		, definition("PacketView", "alias", n("Packet"))
		, definition("Packets", "alias", a("list", n("PacketView")))
		, definition("Mode", "variant", { first: {}, second: { count: n("Count") } })
		, definition("ModeView", "alias", n("Mode"))
	].sort((left, right) => left.id.localeCompare(right.id));
	return ir;
};
