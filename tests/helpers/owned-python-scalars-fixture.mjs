/**
 * Independent ownership and scalar signatures for the authored Lean packet.
 *
 * @file
 */
import { ownedAggregateReviewedIr } from "./owned-aggregate-fixture.mjs";

/** Describe all nineteen primitives without using compiler metadata. */
export const ownedPythonScalarsReviewedIr = () => {
	const ir = ownedAggregateReviewedIr(), primitive = name => ({ kind: "primitive", name });
	const named = name => ({ kind: "named", id: `lean:Owned.${name}` });
	const apply = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
	const copied = ir.types.find(type => type.name === "Payload"), owned = ir.types.find(type => type.name === "Bundle");
	const field = (name, type) => ({ ...copied.fields[0], name, type });
	const definition = (base, name, fields) => ({ ...base
		, id: named(name).id, name, fields
		, source: { ...base.source, declaration: `Owned.${name}` } });
	ir.types = [ir.types.find(type => type.name === "Ticket")
		, definition(copied, "Scalars", [
			["unit", "unit"], ["flag", "bool"], ["char", "char"]
			, ["natural", "nat"], ["integer", "int"]
			, ["u8", "uint8"], ["u16", "uint16"], ["u32", "uint32"], ["u64", "uint64"]
			, ["i8", "int8"], ["i16", "int16"], ["i32", "int32"], ["i64", "int64"]
			, ["word", "usize"], ["signedWord", "isize"]
			, ["f32", "float32"], ["f64", "float64"]
			, ["text", "string"], ["bytes", "bytes"]
		].map(([name, kind]) => field(name, primitive(kind))))
		, definition(copied, "Empty", [])
		, definition(owned, "Packet", [field("ticket", named("Ticket"))
			, field("scalars", named("Scalars"))
			, field("optional", apply("option", apply("option", primitive("unit"))))
			, field("empty", named("Empty"))])];
	const signatures = [
		["newTicket", [primitive("nat"), primitive("string")], named("Ticket")]
		, ["echo", [named("Packet")], named("Packet")]
		, ["makePacket", [named("Ticket")], named("Packet")]
		, ["inspect", [named("Packet")], primitive("bool")]
		, ["optionCase", [named("Packet")], primitive("uint8")]
		, ["bits32", [named("Packet")], primitive("uint32")]
		, ["bits64", [named("Packet")], primitive("uint64")]
		, ["units", [apply("list", primitive("unit"))], apply("list", primitive("unit"))]
	];
	const template = ir.declarations[0], identity = type => type.kind === "named" && ["Ticket", "Packet"].includes(type.id.split(".").at(-1));
	const site = (type, result = false) => ({ type
		, ownership: identity(type) ? result ? "lease" : "borrow" : "copy"
		, lifetime: identity(type) ? { scope: result ? "explicit" : "call", anchor: null } : null });
	ir.declarations = signatures.map(([name, parameters, result]) => ({ ...template
		, id: `lean:Owned.${name}`, name, overloadKey: `Owned.${name}`
		, parameters: parameters.map((type, index) => ({ name: `arg${index}`
			, ...site(type)
			, mutability: "immutable", optional: false, default: null }))
		, result: site(result, true)
		, effects: [...parameters.some(identity) ? ["reads-resource"] : []
			, ...identity(result) ? ["allocates"] : []]
		, source: { ...template.source, declaration: `Owned.${name}` } }));
	ir.errors = [];
	return ir;
};
