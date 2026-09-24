/**
 * Independent recursive Java declaration fixtures with no native ABI metadata.
 *
 * @file
 */
import { recursiveReviewedIr } from "./recursive-fixture.mjs";

/** Optional nominal edges permit finite linked values without type unfolding. */
export const jvmLinkedGraphIr = () => {
	const ir = recursiveReviewedIr(), record = ir.types.find(type => type.kind === "record");
	ir.component.id = "linked@1.0.0"; ir.component.name = "linked";
	const root = { kind: "named", id: "lean:Recursive.Link" };
	ir.types = [{ ...record, id: root.id, name: "Link"
		, fields: [
			{ ...record.fields[0], name: "tail", type: { kind: "apply", constructor: "option", arguments: [root] } }
			, { ...record.fields[0], name: "value", type: { kind: "primitive", name: "uint32" } }
		]
	}];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};

/**
 * Compact alias graphs exercise expansion bounds before Java source allocation.
 *
 * @param count - Number of source aliases.
 * @param constructor - Structural constructor, or a transparent alias chain.
 */
export const jvmAliasGraphIr = (count, constructor = "tuple") => {
	const ir = recursiveReviewedIr(), alias = ir.types.find(type => type.kind === "alias");
	ir.component.id = "aliases@1.0.0"; ir.component.name = "aliases";
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.types = Array.from({ length: count }, (_, index) => ({ ...alias
		, id: named(index).id
		, name: `Alias${index}`
		, target: !index ? { kind: "primitive", name: "uint32" } : constructor === "alias" ? named(index - 1)
			: { kind: "apply", constructor, arguments: constructor === "tuple" ? [named(index - 1), named(index - 1)] : [named(index - 1)] } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(count - 1); ir.declarations[0].result.type = named(count - 1);
	return ir;
};

/** The maximum structural depth must compile in an actual nominal field. */
export const jvmDeepArrayGraphIr = () => {
	const ir = jvmLinkedGraphIr(); ir.component.id = "deep@1.0.0"; ir.component.name = "deep";
	let type = { kind: "primitive", name: "uint32" };
	for(let index = 0; index < 32; index++) type = { kind: "apply", constructor: "array", arguments: [type] };
	ir.types[0].fields = [{ ...ir.types[0].fields[0], name: "value", type }];
	return ir;
};

/** Public names may match private traversal classes without changing identity. */
export const jvmGraphNamingIr = () => {
	const ir = jvmLinkedGraphIr(); ir.component.id = "names@1.0.0"; ir.component.name = "names";
	ir.types[0].name = "Frame";
	for(const name of ["Entry", "Cursor"])
		ir.types.push({ ...structuredClone(ir.types[0]), id: `lean:Recursive.${name}`, name, fields: [] });
	const field = { ...ir.types[0].fields[1], type: { kind: "primitive", name: "uint32" } };
	for(const count of [127, 128])
		ir.types.push({ ...structuredClone(ir.types[0])
			, id: `lean:Recursive.Slots${count * 2}`
			, name: `Slots${count * 2}`
			, fields: Array.from({ length: count }, (_, index) => ({ ...field, name: `item${index}` })) });
	return ir;
};
