/**
 * Independent variant declarations and signatures, not compiler-derived facts.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const p = name => ({ kind: "primitive", name });
const n = name => ({ kind: "named", id: `lean:Variants.${name}` });
const a = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const documentation = { summary: "Independent variant contract.", details: "" };
const fields = values => Object.entries(values).map(([name, type]) => ({ name, type, mutability: "immutable", documentation }));
const cases = values => Object.entries(values).map(([name, members]) => ({ name, fields: fields(members), documentation }));
const definition = (name, kind, values) => ({
	id: `lean:Variants.${name}`, name, kind, representation: "copied"
	, mutability: "immutable", typeParameters: []
	, fields: kind === "record" ? fields(values) : []
	, cases: kind === "variant" ? cases(values) : []
	, target: null, resource: null, callable: null, host: null, documentation
	, source: {
		producer: "corpusReview", declaration: `Variants.${name}`, extensions: {}
	}
	, assurance: []
});
export const variantScalarFields = {
	unit: "unit", bool: "bool", u8: "uint8", u16: "uint16", u32: "uint32"
	, u64: "uint64", i8: "int8", i16: "int16", i32: "int32", i64: "int64"
	, natural: "nat", integer: "int", f32: "float32", f64: "float64"
	, text: "string", bytes: "bytes", char: "char", word: "usize"
	, signedWord: "isize"
};
const signatures = [
	["echo", n("Signal"), n("Signal")], ["mode", n("Mode"), n("Mode")]
	, ["nested", n("Nested"), n("Nested")]
	, ["signals", a("array", a("list", n("Signal"))), a("array", a("list", n("Signal")))]
	, ["scalars", n("Scalars"), n("Scalars")]
	, ["anonymous", n("Anonymous"), n("Anonymous")], ["one", n("One"), n("One")]
	, ["next", n("Signal"), n("Signal")], ["code", n("Signal"), p("uint32")]
	, ["make", p("uint32"), n("Signal")], ["inspect", n("Scalars"), p("bool")]
	, ["duplicate", p("bytes"), n("Buffers")], ["produce", p("nat"), n("Buffers")]
];
export const variantSignatures = signatures.map(([name, parameter, result]) => ({ name: `Variants.${name}`, parameters: [parameter], result }));

/** Reviewed without generated metadata, C layouts or wire ordinals. */
export const variantReviewedIr = () => {
	const ir = corpusReviewedIr({ id: "variants" }, variantSignatures.map(item => ({ name: item.name, parameters: ["unit"], result: "unit" })));
	ir.declarations.forEach((item, index) => { item.parameters[0].type = structuredClone(signatures[index][1]); item.result.type = structuredClone(signatures[index][2]); });
	ir.types = [
		definition("Signal", "variant", { idle: {}, stopped: {}, data: { count: p("uint32"), label: p("string") }, marker: { value: p("unit") } })
		, definition("Mode", "variant", { first: {}, second: {}, third: {} })
		, definition("Packet", "record", { current: n("Signal"), events: a("list", n("Signal")), fallback: a("option", n("Signal")), modes: a("array", n("Mode")) })
		, definition("Nested", "variant", { empty: {}, packet: { value: n("Packet") }, outcome: { value: a("result", a("tuple", n("Signal"), n("Mode")), p("string")) } })
		, definition("Scalars", "variant", { absent: {}, all: Object.fromEntries(Object.entries(variantScalarFields).map(([name, type]) => [name, p(type)])) })
		, definition("Anonymous", "variant", { number: { arg0: p("uint32") }, pair: { arg0: p("uint32"), arg1: p("string") }, collision: { arg1: p("uint32"), arg1_: p("string") } })
		, definition("One", "variant", { only: { value: p("uint32") } })
		, definition("Buffers", "variant", { empty: {}, pair: { first: p("bytes"), second: p("bytes") } })
	].sort((left, right) => left.id.localeCompare(right.id));
	return ir;
};
