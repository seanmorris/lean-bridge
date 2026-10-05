/**
 * Independent recursive C# declaration fixtures, without native metadata.
 *
 * @file
 */
import { recursiveReviewedIr } from "./recursive-fixture.mjs";

/** A record can close its own cycle through an optional nominal reference. */
export const dotnetLinkedGraphIr = () => {
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

/** Compile the maximum fixed structural depth as an actual public CLR field. */
export const dotnetDeepArrayGraphIr = () => {
	const ir = dotnetLinkedGraphIr();
	ir.component.id = "deep@1.0.0"; ir.component.name = "deep";
	let type = { kind: "primitive", name: "uint32" };
	for(let index = 0; index < 32; index++) type = { kind: "apply", constructor: "array", arguments: [type] };
	ir.types[0].id = "lean:Recursive.Box"; ir.types[0].name = "Box";
	ir.types[0].fields = [{ ...ir.types[0].fields[0], name: "value", type }];
	const root = { kind: "named", id: ir.types[0].id };
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};

/**
 * Structural aliases must fail before exponential CLR type text is allocated.
 *
 * @param count - Number of aliases in the finite source graph.
 * @param constructor - Structural constructor, or alias for a transparent chain.
 */
export const dotnetAliasGraphIr = (count, constructor = "tuple") => {
	const ir = recursiveReviewedIr(), alias = ir.types.find(type => type.kind === "alias");
	ir.component.id = "aliases@1.0.0"; ir.component.name = "aliases";
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.types = Array.from({ length: count }, (_, index) => ({
		...alias
		, id: named(index).id
		, name: `Alias${index}`
		, target: !index ? { kind: "primitive", name: "uint32" } : constructor === "alias" ? named(index - 1)
			: { kind: "apply", constructor, arguments: constructor === "tuple" ? [named(index - 1), named(index - 1)] : [named(index - 1)] } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(count - 1); ir.declarations[0].result.type = named(count - 1);
	return ir;
};
