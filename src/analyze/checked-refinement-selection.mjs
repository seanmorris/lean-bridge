/**
 * Author-selected constructors follow structural transport order, independently of Fin bounds.
 *
 * @file
 */
const arities = Object.freeze({ array: 1, list: 1, option: 1, tuple: 2, result: 2 });
const leanName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/;
const fail = () => { throw new TypeError("Invalid checked refinement selection"); };
const closed = (value, keys) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
		|| Reflect.ownKeys(value).length !== keys.length
		|| keys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"))) fail();
};

/**
 * Validate a nonempty constructor selection without authoring any predicate or bound.
 * A null child means that branch has no author-selected constructor, including a Fin-only branch.
 *
 * @param selection - A scalar constructor or a structural kind/arguments tree.
 */
export const validateCheckedRefinementSelection = selection => {
	let nodes = 0;
	const visit = (value, depth) => {
		if(++nodes > 4096 || depth > 32) fail();
		if(value === null) return false;
		if(Object.hasOwn(value ?? {}, "constructor"))
		{
			closed(value, ["constructor"]);
			if(typeof value.constructor !== "string" || !leanName.test(value.constructor)) fail();
			return true;
		}
		closed(value, ["kind", "arguments"]);
		if(!Object.hasOwn(arities, value.kind) || !Array.isArray(value.arguments)
			|| value.arguments.length !== arities[value.kind]) fail();
		let selected = false;
		for(let index = 0; index < value.arguments.length; index++)
		{
			if(!Object.hasOwn(value.arguments, index)) fail();
			// Visit every child, even after one constructor has been found.
			selected = visit(value.arguments[index], depth + 1) || selected;
		}
		if(!selected) fail();
		return true;
	};
	if(!visit(selection, 0)) fail();
	return selection;
};

/**
 * Derive constructor intent from a separately validated compiler/reviewed refinement tree.
 * Fin constraints stay in that tree; they are never converted into author decisions.
 * Empty structural branches collapse to null. Result arguments keep [success, error] order.
 *
 * @param refinement - Predicate tree already matched to its erased transport.
 */
export const checkedRefinementSelection = refinement => {
	let nodes = 0;
	const visit = (value, depth) => {
		if(++nodes > 4096 || depth > 32) fail();
		if(value === null) return null;
		if(value?.kind === "fin")
		{
			closed(value, ["kind", "bound"]);
			if(typeof value.bound !== "string" || !/^(?:0|[1-9][0-9]*)$(?![\s\S])/.test(value.bound)) fail();
			return null;
		}
		if(["subtype", "checked-record"].includes(value?.kind))
		{
			closed(value, ["kind", "constructor"]);
			if(value.kind === "checked-record" && depth !== 0) fail();
			return validateCheckedRefinementSelection({ constructor: value.constructor });
		}
		closed(value, ["kind", "arguments"]);
		if(!Object.hasOwn(arities, value.kind) || !Array.isArray(value.arguments)
			|| value.arguments.length !== arities[value.kind]) fail();
		const children = [];
		for(let index = 0; index < value.arguments.length; index++)
		{
			if(!Object.hasOwn(value.arguments, index)) fail();
			children.push(visit(value.arguments[index], depth + 1));
		}
		return children.every(child => child === null) ? null : { kind: value.kind, arguments: children };
	};
	return visit(refinement, 0);
};
