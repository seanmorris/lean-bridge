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
	keys(["kind", "arguments"]);
	const count = ["tuple", "result"].includes(refinement.kind) ? 2 : 1;
	if(!["array", "list", "option", "tuple", "result"].includes(refinement.kind)
		|| type?.kind !== "apply" || type.constructor !== refinement.kind || !Array.isArray(type.arguments) || type.arguments.length !== count
		|| !Array.isArray(refinement.arguments) || refinement.arguments.length !== count
		|| !refinement.arguments.some(value => value !== null)) fail();
	for(let index = 0; index < count; index++) assertRefinement(refinement.arguments[index], type.arguments[index], depth + 1);
};
