/**
 * Recursive records, shared aliases and builtin-named Perl fields.
 *
 * @file
 */
import { recursiveReviewedIr } from "./recursive-fixture.mjs";

/** Recursive records with optional links and a scalar payload. */
export const perlLinkedGraphIr = () => {
	const ir = recursiveReviewedIr(), template = ir.types.find(type => type.kind === "record");
	const root = { kind: "named", id: "lean:Recursive.Link" };
	ir.component.id = "linked@1.0.0"; ir.component.name = "linked";
	ir.types = [{ ...template, id: root.id, name: "Link"
		, fields: [
			{ ...template.fields[0], name: "tail", type: { kind: "apply", constructor: "option", arguments: [root] } }
			, { ...template.fields[0], name: "value", type: { kind: "primitive", name: "uint32" } }
		]
	}];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};

/** Shared alias edges whose unfolding would grow exponentially. */
export const perlAliasGraphIr = () => {
	const ir = recursiveReviewedIr(), base = ir.types.find(type => type.kind === "alias");
	const named = index => ({ kind: "named", id: `lean:Recursive.Alias${index}` });
	ir.component.id = "deep@1.0.0"; ir.component.name = "deep";
	ir.types = Array.from({ length: 700 }, (_, index) => ({ ...base
		, id: named(index).id, name: `Alias${index}`
		, target: index ? { kind: "apply", constructor: "tuple", arguments: [named(index - 1), named(index - 1)] } : { kind: "primitive", name: "uint32" } }));
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = named(699); ir.declarations[0].result.type = named(699);
	return ir;
};

/** Ordinary field accessors must not replace Perl's constructor builtins. */
export const perlBuiltinGraphIr = () => {
	const ir = perlLinkedGraphIr(), scalar = ir.types[0].fields[1];
	ir.component.id = "builtins@1.0.0"; ir.component.name = "builtins";
	ir.types[0].fields.push(...["keys", "ref", "bless", "die", "shift", "splice", "exists", "defined", "grep", "length", "push", "map"]
		.map(name => ({ ...scalar, name })));
	return ir;
};
