/**
 * Closed refinement trees checked against their erased transport types.
 *
 * @file
 */

/**
 * Match per-use predicate trees to erased transport types. Nominal choices need the
 * enclosing document's definitions; shared nominal extensions remain Fin-only.
 *
 * @param refinement - Compiler-owned predicate tree, or null for no constraint.
 * @param type - Matching public transport type reference.
 * @param depth - Bounded structural nesting; callers start at zero.
 * @param subtypeStructural - Whether this export site permits selected Subtype constructors.
 * @param types - Definitions used to authenticate selected record and variant members.
 * @param subtypeResult - Whether this is a copied export result produced by Lean.
 */
export const assertRefinement = (refinement, type, depth = 0, subtypeStructural = depth === 0, types = [], subtypeResult = false) => {
	const fail = () => { throw new TypeError("Refinement does not match its transport type"); };
	const definitions = new Map(types.map(definition => [definition.id, definition]));
	if(definitions.size !== types.length) fail();
	let nodes = 0;
	const closed = (value, keys) => {
		if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
			|| Reflect.ownKeys(value).length !== keys.length
			|| keys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"))) fail();
	};
	const array = (values, count) => {
		if(!Array.isArray(values) || values.length !== count || count > 1024) fail();
		for(let index = 0; index < count; index++)
			if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail();
	};
	const visit = (value, transport, level, seen) => {
		if(++nodes > 4096 || level > 32) fail();
		if(value === null) return false;
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value ?? {}, "kind") ?? {}, "value")) fail();
		const definition = transport?.kind === "named" ? definitions.get(transport.id) : undefined;
		if(definition?.kind === "alias")
		{
			if(seen.has(transport.id) || definition.representation !== "copied") fail();
			return visit(value, definition.target, level + 1, new Set([...seen, transport.id]));
		}
		if(value.kind === "fin")
		{
			closed(value, ["kind", "bound"]);
			if(transport?.kind !== "primitive" || transport.name !== "nat" || typeof value.bound !== "string"
				|| !/^(?:0|[1-9][0-9]*)$(?![\s\S])/.test(value.bound)) fail();
			return true;
		}
		if(["subtype", "checked-record"].includes(value.kind))
		{
			closed(value, ["kind", "constructor"]);
			const projected = value.kind === "subtype" && subtypeResult === true && value.constructor === null;
			if(!projected && (typeof value.constructor !== "string" || !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/.test(value.constructor))) fail();
			if(value.kind === "subtype" ? !subtypeStructural || transport?.kind !== "primitive"
				: level !== 0 || transport?.kind !== "named") fail();
			return true;
		}
		if(["record", "variant"].includes(value.kind))
		{
			const variant = value.kind === "variant";
			closed(value, ["kind", "name", variant ? "cases" : "fields"]);
			if(!subtypeStructural || !definition || definition.kind !== value.kind || definition.representation !== "copied"
				|| definition.source?.declaration !== value.name || seen.has(transport.id)
				|| definition.source?.extensions?.["lean-lang.org/instantiation"] !== undefined
				|| definition.source?.extensions?.["lean-lang.org/erased-proofs"] !== undefined) fail();
			const inner = new Set([...seen, transport.id]);
			const fields = (members, expected) => {
				array(members, expected.length);
				let constrained = false;
				for(const [index, member] of members.entries())
				{
					if(++nodes > 4096) fail();
					closed(member, ["name", "refinement"]);
					if(member.name !== expected[index].name) fail();
					constrained = visit(member.refinement, expected[index].type, level + 1, inner) || constrained;
				}
				return constrained;
			};
			let constrained = false;
			if(!variant) constrained = fields(value.fields, definition.fields);
			else
			{
				array(value.cases, definition.cases.length);
				for(const [index, branch] of value.cases.entries())
				{
					if(++nodes > 4096) fail();
					closed(branch, ["name", "fields"]);
					if(branch.name !== definition.cases[index].name) fail();
					constrained = fields(branch.fields, definition.cases[index].fields) || constrained;
				}
			}
			if(!constrained) fail();
			return true;
		}
		closed(value, ["kind", "arguments"]);
		const count = ["tuple", "result"].includes(value.kind) ? 2 : 1;
		if(!["array", "list", "option", "tuple", "result"].includes(value.kind)
			|| transport?.kind !== "apply" || transport.constructor !== value.kind || !Array.isArray(transport.arguments) || transport.arguments.length !== count) fail();
		array(value.arguments, count);
		let constrained = false;
		for(let index = 0; index < count; index++) constrained = visit(value.arguments[index], transport.arguments[index], level + 1, seen) || constrained;
		if(!constrained) fail();
		return true;
	};
	visit(refinement, type, depth, new Set());
};

/**
 * Authenticate constraints at typed nominal constructors and projections.
 *
 * @param definition - A public or private copied nominal definition.
 * @param value - Its explicit constraints, or the public source extension.
 */
export const nominalRefinement = (definition, value = definition.source?.extensions?.["lean-lang.org/nominal-refinements"]) => {
	if(value === undefined) return null;
	const fail = () => { throw new TypeError("Invalid nominal refinement metadata"); };
	const field = definition.kind === "alias" ? "target" : definition.kind === "record" ? "fields" : definition.kind === "variant" ? "cases" : null;
	if(!field || !value || typeof value !== "object" || Array.isArray(value)
		|| value.kind !== definition.kind || Object.keys(value).length !== 2
		|| !Object.hasOwn(value, "kind") || !Object.hasOwn(value, field)) fail();
	const check = (values, fields) => {
		if(!Array.isArray(values) || values.length !== fields.length) fail();
		for(const [index, refinement] of values.entries()) assertRefinement(refinement, fields[index].type, 1);
	};
	if(field === "target") assertRefinement(value.target, definition.target, 1);
	else if(field === "fields") check(value.fields, definition.fields);
	else
	{
		if(!Array.isArray(value.cases) || value.cases.length !== definition.cases.length) fail();
		for(const [index, fields] of value.cases.entries()) check(fields, definition.cases[index].fields);
	}
	if(!(field === "target" ? value.target !== null
		: (field === "fields" ? value.fields : value.cases.flat()).some(child => child !== null))) fail();
	return value;
};

/**
 * Collect constraints without changing nominal identity or wire representation.
 *
 * @param types - Public Binding IR type definitions.
 */
export const nominalRefinementEntries = types => types.flatMap(definition => {
	const refinement = nominalRefinement(definition);
	return refinement === null ? [] : [{ id: definition.id, refinement }];
}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Validate Fin-only callback constraints against an erased callable signature.
 *
 * @param signature - Erased parameter and result type references.
 * @param value - Optional compiler-owned parameter/result refinement trees.
 */
export const callbackRefinement = (signature, value) => {
	if(value === undefined) return null;
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).length !== 2 || !Object.hasOwn(value, "parameters") || !Object.hasOwn(value, "result")
		|| !Array.isArray(value.parameters) || value.parameters.length !== signature.parameters.length)
		throw new TypeError("Invalid callback refinement metadata");
	for(const [index, refinement] of value.parameters.entries()) assertRefinement(refinement, signature.parameters[index], 1);
	assertRefinement(value.result, signature.result, 1);
	if(![...value.parameters, value.result].some(refinement => refinement !== null)) throw new TypeError("Empty callback refinement metadata");
	return value;
};

/**
 * Read optional constraints from a public callback definition.
 *
 * @param definition - Public Binding IR callback definition.
 */
export const callbackDefinitionRefinement = definition => callbackRefinement({
	parameters: definition.callable.parameters.map(parameter => parameter.type)
	, result: definition.callable.result.type
}, definition.source?.extensions?.["lean-lang.org/refinements"]);
