/**
 * Closed refinement trees checked against their erased transport types.
 *
 * @file
 */

/**
 * Admit scalar refinements and structural containers of Fin, never silently
 * discard a constraint on a nominal field or callable signature.
 *
 * @param refinement - Compiler-owned predicate tree, or null for no constraint.
 * @param type - Matching public transport type reference.
 * @param depth - Bounded structural nesting; callers start at zero.
 */
export const assertRefinement = (refinement, type, depth = 0) => {
	if(refinement === null) return;
	const fail = () => { throw new TypeError("Refinement does not match its transport type"); };
	if(depth > 32 || !refinement || typeof refinement !== "object" || Array.isArray(refinement)) fail();
	const keys = expected => {
		if(Object.keys(refinement).length !== expected.length || Object.keys(refinement).some(key => !expected.includes(key))) fail();
	};
	if(refinement.kind === "fin")
	{
		keys(["kind", "bound"]);
		if(type?.kind !== "primitive" || type.name !== "nat" || typeof refinement.bound !== "string"
			|| !/^(?:0|[1-9][0-9]*)$/.test(refinement.bound)) fail();
		return;
	}
	if(refinement.kind === "subtype")
	{
		keys(["kind", "constructor"]);
		if(depth !== 0 || type?.kind !== "primitive" || typeof refinement.constructor !== "string"
			|| !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(refinement.constructor)) fail();
		return;
	}
	if(refinement.kind === "checked-record")
	{
		// A site's checked constructor builds a record with erased proofs from its payload.
		keys(["kind", "constructor"]);
		if(depth !== 0 || type?.kind !== "named" || typeof refinement.constructor !== "string"
			|| !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(refinement.constructor)) fail();
		return;
	}
	keys(["kind", "arguments"]);
	const count = ["tuple", "result"].includes(refinement.kind) ? 2 : 1;
	if(!["array", "list", "option", "tuple", "result"].includes(refinement.kind)
		|| type?.kind !== "apply" || type.constructor !== refinement.kind || !Array.isArray(type.arguments) || type.arguments.length !== count
		|| !Array.isArray(refinement.arguments) || refinement.arguments.length !== count
		|| !refinement.arguments.some(value => value !== null)) fail();
	for(let index = 0; index < count; index++) assertRefinement(refinement.arguments[index], type.arguments[index], depth + 1);
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
