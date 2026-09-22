/**
 * Finite copied-type graphs and independent limits for their runtime values.
 * This representation does not by itself admit recursive compiled exports.
 *
 * @file
 */
import { componentScalarTypes, scalarCopyLimit } from "./component-scalars.mjs";
import { createComponentCopyBudget } from "./component-copied.mjs";

export const componentRecursiveLimits = Object.freeze({ schemaDepth: 32, typeNodes: 4096, nominalTypes: 1024, valueDepth: 128, valueNodes: 262144 });
const nominal = /^lean:[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/;
const name = /^[A-Za-z_][A-Za-z0-9_]*$/;
const budgets = new WeakSet();
const invalid = message => { throw new TypeError(`Invalid component copied graph: ${message}`); };
const closed = (value, keys) => {
	if(!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid("expected a plain descriptor");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) invalid("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) invalid("accessors are unsupported");
};
const dataKind = value => {
	const descriptor = value && Object.getOwnPropertyDescriptor(value, "kind");
	if(!descriptor || !Object.hasOwn(descriptor, "value")) invalid("missing data kind");
	return descriptor.value;
};
const dense = (values, limit) => {
	if(!Array.isArray(values) || values.length > limit || Reflect.ownKeys(values).length !== values.length + 1) invalid("expected a bounded dense table");
	for(let index = 0; index < values.length; index++)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) invalid("table accessors or holes are unsupported");
};

/**
 * Copy a closed descriptor without expanding named references. Nominal cycles
 * describe recursive data; alias-only cycles, including through containers, reject.
 * No executable accessors, identity types or JavaScript object cycles are admitted.
 *
 * @param descriptor - Version one graph with a root reference and nominal types.
 */
export const snapshotComponentCopiedGraph = descriptor => {
	closed(descriptor, ["schemaVersion", "root", "types"]);
	if(descriptor.schemaVersion !== 1) invalid("unsupported graph version");
	dense(descriptor.types, componentRecursiveLimits.nominalTypes);
	let nodes = 0;
	const active = new Set(), references = new Set(), ids = new Set();
	const charge = depth => {
		if(depth > componentRecursiveLimits.schemaDepth || ++nodes > componentRecursiveLimits.typeNodes) invalid("type nesting or node limit exceeded");
	};
	const reference = (value, depth = 0) => {
		charge(depth);
		if(active.has(value)) invalid("cyclic JavaScript descriptor; use named references");
		const kind = dataKind(value);
		if(kind === "primitive")
		{
			closed(value, ["kind", "name"]);
			if(!componentScalarTypes.includes(value.name)) invalid("unknown primitive");
			return Object.freeze({ kind, name: value.name });
		}
		if(kind === "named")
		{
			closed(value, ["kind", "id"]);
			if(typeof value.id !== "string" || !nominal.test(value.id)) invalid("invalid nominal identity");
			references.add(value.id);
			return Object.freeze({ kind, id: value.id });
		}
		closed(value, ["kind", "constructor", "arguments"]);
		if(kind !== "apply" || !["array", "list", "option", "result", "tuple"].includes(value.constructor)) invalid("unsupported copied constructor");
		dense(value.arguments, 2);
		if(value.arguments.length !== (["tuple", "result"].includes(value.constructor) ? 2 : 1)) invalid("constructor arity mismatch");
		active.add(value);
		try
		{ return Object.freeze({ kind, constructor: value.constructor, arguments: Object.freeze(value.arguments.map(child => reference(child, depth + 1))) }); }
		finally
		{ active.delete(value); }
	};
	const fields = (values, variant = false) => {
		dense(values, 1024);
		const names = new Set();
		return Object.freeze(values.map(field => {
			closed(field, ["name", "type"]);
			if(typeof field.name !== "string" || !name.test(field.name) || names.has(field.name)
				|| ["__proto__", "prototype", "constructor"].includes(field.name) || variant && field.name === "kind") invalid("invalid or duplicate field name");
			names.add(field.name);
			return Object.freeze({ name: field.name, type: reference(field.type) });
		}));
	};
	const root = reference(descriptor.root);
	const types = descriptor.types.map(value => {
		charge(0);
		const kind = dataKind(value);
		if(!["alias", "record", "variant"].includes(kind)) invalid("identity and unknown nominal kinds require another representation");
		closed(value, ["kind", "id", kind === "alias" ? "target" : kind === "record" ? "fields" : "cases"]);
		if(typeof value.id !== "string" || !nominal.test(value.id) || ids.has(value.id)) invalid("invalid or duplicate nominal identity");
		ids.add(value.id);
		if(kind === "alias") return Object.freeze({ kind, id: value.id, target: reference(value.target) });
		if(kind === "record") return Object.freeze({ kind, id: value.id, fields: fields(value.fields) });
		dense(value.cases, 1024);
		if(!value.cases.length) invalid("variants require a constructor");
		const names = new Set();
		const cases = Object.freeze(value.cases.map(item => {
			charge(0);
			closed(item, ["name", "fields"]);
			if(typeof item.name !== "string" || !name.test(item.name) || names.has(item.name)) invalid("invalid or duplicate constructor name");
			names.add(item.name);
			return Object.freeze({ name: item.name, fields: fields(item.fields, true) });
		}));
		return Object.freeze({ kind, id: value.id, cases });
	}).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
	for(const id of references) if(!ids.has(id)) invalid(`unknown nominal identity ${id}`);
	const table = new Map(types.map(type => [type.id, type])), edges = new Map();
	// Containers do not make an alias cycle nominal. Stop only at records or variants.
	for(const type of types.filter(type => type.kind === "alias"))
	{
		const pending = [type.target], targets = new Set();
		while(pending.length)
		{
			const ref = pending.pop();
			if(ref.kind === "apply") pending.push(...ref.arguments);
			else if(ref.kind === "named" && table.get(ref.id).kind === "alias") targets.add(ref.id);
		}
		edges.set(type.id, [...targets]);
	}
	const done = new Set();
	for(const id of edges.keys())
	{
		if(done.has(id)) continue;
		const stack = [{ id, index: 0 }]; active.add(id);
		while(stack.length)
		{
			const frame = stack.at(-1), children = edges.get(frame.id);
			if(frame.index === children.length)
			{ active.delete(frame.id); done.add(frame.id); stack.pop(); continue; }
			const child = children[frame.index++];
			if(active.has(child)) invalid(`cyclic alias ${child}`);
			if(!done.has(child))
			{ active.add(child); stack.push({ id: child, index: 0 }); }
		}
	}
	return Object.freeze({ schemaVersion: 1, root, types: Object.freeze(types) });
};

/**
 * Resolve only transparent aliases, retaining nominal recursion as finite edges.
 * The private cache cannot be mutated through the returned immutable graph.
 *
 * @param descriptor - Closed copied-type graph.
 */
export const compileComponentCopiedGraph = descriptor => {
	const graph = snapshotComponentCopiedGraph(descriptor), table = new Map(graph.types.map(type => [type.id, type])), resolved = new Map();
	const resolve = reference => {
		let type = reference;
		const aliases = [];
		while(type.kind === "named")
		{
			if(resolved.has(type.id))
			{ type = resolved.get(type.id); break; }
			const id = type.id;
			type = table.get(id);
			if(!type) invalid(`unknown nominal identity ${id}`);
			aliases.push(id);
			if(type.kind !== "alias") break;
			type = type.target;
		}
		for(const id of aliases) resolved.set(id, type);
		return type;
	};
	return Object.freeze({ graph, resolve });
};

/**
 * Share byte and value-node limits across arguments and the returned value.
 * Schema edges and transparent aliases are not additional runtime values.
 *
 * @param byteLimit - Caller may lower, but not raise, the copied byte allowance.
 * @param nodeLimit - Caller may lower, but not raise, the value-node allowance.
 */
export const createComponentRecursiveBudget = (byteLimit = scalarCopyLimit, nodeLimit = componentRecursiveLimits.valueNodes) => {
	const bytes = createComponentCopyBudget(byteLimit);
	if(!Number.isSafeInteger(nodeLimit) || nodeLimit < 0 || nodeLimit > componentRecursiveLimits.valueNodes) throw new RangeError("Invalid recursive value node budget");
	let nodes = 0;
	const budget = Object.freeze(Object.defineProperties({
		charge: bytes.charge
		, reserve: count => {
			if(!Number.isSafeInteger(count) || count < 0 || count > nodeLimit - nodes) throw new RangeError("Component recursive value node budget exceeded");
			nodes += count;
		}
	}, {
		used: { enumerable: true, get: () => bytes.used }
		, nodes: { enumerable: true, get: () => nodes }
	}));
	budgets.add(budget);
	return budget;
};

/**
 * Do not let a replacement counter bypass hard transport limits.
 *
 * @param budget - Counter returned by createComponentRecursiveBudget.
 */
export const assertComponentRecursiveBudget = budget => {
	if(!budgets.has(budget)) throw new TypeError("Expected an authentic recursive copy budget");
};
