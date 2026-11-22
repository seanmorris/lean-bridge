/**
 * Define independent contracts for exercising externally owned objects from Lean.
 *
 * @file
 */
import { alpha } from "../../poc/lean-link-spike/descriptors.mjs";

/**
 * Select one primitive by its Binding IR name.
 *
 * @param name - Primitive tag.
 */
export const primitiveRef = name => ({ kind: "primitive", name });
const copy = type => ({ type, ownership: "copy", lifetime: null });
/**
 * Describe a required, copied member argument.
 *
 * @param name - Member argument name.
 * @param type - Binding IR type reference.
 */
export const hostParameter = (name, type) => ({ name, ...copy(type), mutability: "immutable", optional: false, default: null });
/** Select the Alpha example's box as a host-owned object. */
export const hostFixture = () => {
	const ir = structuredClone(alpha.bindingIr);
	const box = ir.types.find(type => type.name === "Box");
	box.host = { targets: ["javascript", "python"], identity: "weak-canonical", dynamic: false };
	for(const declaration of ir.declarations.filter(item => item.owner === box.id))
		if(!declaration.effects.includes("host-call")) declaration.effects.push("host-call");
	return ir;
};

/**
 * Add a member without relying on the generator to select its types.
 *
 * @param ir - Contract under construction.
 * @param name - Public member name.
 * @param options - Explicit signature and ownership overrides.
 */
export const hostMember = (ir, name, options = {}) => {
	const original = ir.declarations.find(item => item.owner === "lean:Alpha.Box" && item.name === "read");
	const { id = name, ...overrides } = options;
	const member = { ...structuredClone(original), id: `lean:Alpha.${id}`, name
		, overloadKey: id, parameters: [], result: copy(primitiveRef("uint32")) };
	Object.assign(member, overrides);
	ir.declarations.push(member);
	return member;
};

/** Declare the mutable members exercised by the independent Python implementation. */
export const executableHostFixture = () => {
	const ir = hostFixture(), box = ir.types.find(type => type.name === "Box");
	box.mutability = "write";
	const value = hostParameter("value", primitiveRef("uint32"));
	const get = hostMember(ir, "level", { id: "getLevel", kind: "property" });
	const set = hostMember(ir, "level", {
		id: "setLevel", kind: "property", parameters: [value]
		, effects: ["writes-resource", "host-call", "fails"]
		, mutability: "write"
		, result: copy(primitiveRef("unit")) });
	set.receiver.mutability = "write";
	hostMember(ir, "scale", { parameters: [hostParameter("value", primitiveRef("float32"))], result: copy(primitiveRef("float32")) });
	const other = { ...hostParameter("other", { kind: "named", id: box.id }), ownership: "borrow", lifetime: { scope: "call", anchor: null } };
	hostMember(ir, "sameAs", { parameters: [other], result: copy(primitiveRef("bool")) });
	hostMember(ir, "finish", { receiver: { ...get.receiver, ownership: "transfer" } });
	hostMember(ir, "live", { kind: "static-method", receiver: null });
	return ir;
};
