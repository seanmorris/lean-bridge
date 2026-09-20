/**
 * Staged copied-slot shapes. Compiler and package admission remain separate.
 *
 * @file
 */
import { componentScalarTypes, scalarCopyLimit } from "./component-scalars.mjs";

// Leave space for additional primitive tags without renumbering scalar ABI 2.
export const componentCopiedTags = Object.freeze({ array: 32, tuple: 33, option: 34, result: 35 });
export const componentCopiedDepth = 32;
const maximumTypeNodes = 4096;

const invalid = message => { throw new TypeError(`Invalid component copied type: ${message}`); };
const fields = (value, keys) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid("expected a plain descriptor");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) invalid("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) invalid("accessors are unsupported");
};

/**
 * Snapshot a bounded semantic type tree without trusting names or host coercions.
 * Named records, variants, identity types and recursive descriptors are deferred.
 *
 * @param type - Semantic primitive or applied Binding IR type reference.
 */
export const snapshotComponentCopiedType = type => {
	let nodes = 0;
	const active = new Set();
	const visit = (value, depth) => {
		if(depth > componentCopiedDepth || ++nodes > maximumTypeNodes) invalid("type nesting or node limit exceeded");
		if(active.has(value)) invalid("cyclic type descriptor");
		const kind = value && Object.getOwnPropertyDescriptor(value, "kind");
		if(!kind || !Object.hasOwn(kind, "value")) invalid("missing data kind");
		if(kind.value === "primitive")
		{
			fields(value, ["kind", "name"]);
			if(!componentScalarTypes.includes(value.name)) invalid("unknown primitive");
			return Object.freeze({ kind: "primitive", name: value.name });
		}
		fields(value, ["kind", "constructor", "arguments"]);
		if(kind.value !== "apply" || !Object.hasOwn(componentCopiedTags, value.constructor)) invalid("unsupported constructor");
		const args = value.arguments;
		if(!Array.isArray(args) || args.length > 32 || Reflect.ownKeys(args).length !== args.length + 1) invalid("invalid type arguments");
		const count = value.constructor === "tuple" ? args.length : value.constructor === "result" ? 2 : 1;
		if(args.length !== count || (value.constructor === "tuple" && count < 2)) invalid("constructor arity mismatch");
		active.add(value);
		try
		{
			const children = [];
			for(let index = 0; index < count; index++)
			{
				const child = Object.getOwnPropertyDescriptor(args, index);
				if(!child || !Object.hasOwn(child, "value")) invalid("type arguments must be dense data values");
				children.push(visit(child.value, depth + 1));
			}
			return Object.freeze({ kind: "apply", constructor: value.constructor, arguments: Object.freeze(children) });
		} finally
		{ active.delete(value); }
	};
	return visit(type, 0);
};

/**
 * Share one copy allowance across arguments and the result, including slot storage.
 * A caller may lower the limit, but cannot raise the transport's 16 MiB ceiling.
 *
 * @param limit - Maximum copied bytes for this call.
 */
export const createComponentCopyBudget = (limit = scalarCopyLimit) => {
	if(!Number.isSafeInteger(limit) || limit < 0 || limit > scalarCopyLimit) throw new RangeError("Invalid component copy budget");
	let used = 0;
	return Object.freeze({
		/** Bytes charged across all values in the owning call. */
		get used() { return used; }
		, charge: bytes => {
			if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit - used) throw new RangeError("Component copy budget exceeded");
			used += bytes;
		}
	});
};
