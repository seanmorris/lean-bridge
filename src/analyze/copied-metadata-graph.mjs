/**
 * Validate finite compiler type tables without unfolding nominal recursion.
 * Native representation checks remain the responsibility of the supplied visitor.
 *
 * @file
 */
import { componentRecursiveLimits, snapshotComponentCopiedGraph } from "../abi/component-recursive.mjs";

const fail = message => { throw new TypeError(`Invalid copied metadata graph: ${message}`); };
const closed = (value, keys) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
		|| Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(key => !keys.includes(key))) fail("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value")) fail("descriptor accessors are unsupported");
};
const dense = (values, limit) => {
	if(!Array.isArray(values) || values.length > limit || Reflect.ownKeys(values).length !== values.length + 1) fail("expected a bounded dense table");
	for(let index = 0; index < values.length; index++)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail("table accessors or holes are unsupported");
};
const kindOf = value => {
	const kind = value && Object.getOwnPropertyDescriptor(value, "kind");
	if(!kind || !Object.hasOwn(kind, "value")) fail("missing data kind");
	return kind.value;
};

/**
 * Check table closure, copied semantics, syntax limits and contextual references.
 * Each nominal definition is visited once, with references resolved by identity.
 *
 * @param graph - Native or component compiler graph wrapper.
 * @param validate - Existing profile validator, given the closed nominal table.
 * @param native - Whether the report includes checked Lean/C representation facts.
 */
export const validateCopiedMetadataGraph = (graph, validate, native = false) => {
	closed(graph, ["kind", "root", "types", ...(native ? ["abi"] : [])]);
	if(graph.kind !== "graph") fail("expected a graph wrapper");
	dense(graph.types, componentRecursiveLimits.nominalTypes);
	if(!graph.types.length) fail("missing nominal definitions");
	let nodes = 0;
	const charge = depth => {
		if(depth > componentRecursiveLimits.schemaDepth || ++nodes > componentRecursiveLimits.typeNodes) fail("type nesting or node limit exceeded");
	};
	const keys = (value, fields, named = false) => closed(value, [...fields, ...(native ? [...(named ? ["lean"] : []), "abi"] : [])]);
	const reference = (type, depth = 0) => {
		charge(depth);
		const kind = kindOf(type);
		if(kind === "primitive" || kind === "reference")
		{
			keys(type, ["kind", "name"], true);
			if(typeof type.name !== "string") fail("expected a named identity");
			return kind === "primitive" ? { kind, name: type.name } : { kind: "named", id: `lean:${type.name}` };
		}
		if(["array", "list", "option"].includes(kind))
		{
			keys(type, ["kind", "element"]);
			return { kind: "apply", constructor: kind, arguments: [reference(type.element, depth + 1)] };
		}
		if(!["result", "tuple"].includes(kind)) fail("graph edges require copied references, not inline definitions or identities");
		keys(type, ["kind", "arguments"]); dense(type.arguments, 2);
		return { kind: "apply", constructor: kind, arguments: type.arguments.map(child => reference(child, depth + 1)) };
	};
	const fields = (values, record = false) => {
		dense(values, 1024);
		return values.map(field => {
			closed(field, ["name", "type", ...(native && record ? ["projection"] : [])]);
			return { name: field.name, type: reference(field.type) };
		});
	};
	const root = reference(graph.root);
	const types = graph.types.map(type => {
		charge(0);
		const kind = kindOf(type);
		if(!["alias", "record", "variant"].includes(kind)) fail("nominal table only admits aliases, records and variants");
		keys(type, ["kind", "name", kind === "alias" ? "target" : kind === "record" ? "fields" : "cases", ...(native && kind === "record" ? ["constructor"] : [])], true);
		if(typeof type.name !== "string") fail("expected a nominal identity");
		const id = `lean:${type.name}`;
		if(kind === "alias") return { kind, id, target: reference(type.target) };
		if(kind === "record") return { kind, id, fields: fields(type.fields, true) };
		dense(type.cases, 1024);
		const cases = type.cases.map(branch => {
			charge(0); closed(branch, ["name", "fields", ...(native ? ["constructor"] : [])]);
			return { name: branch.name, fields: fields(branch.fields) };
		});
		return { kind, id, cases };
	});
	const snapshot = snapshotComponentCopiedGraph({ schemaVersion: 1, root, types });
	const table = new Map(graph.types.map(type => [type.name, type]));
	validate(graph.root, table);
	for(const type of graph.types) validate(type, table);
	if(native && ["cType", "box", "unbox", "heap"].some(field => graph.abi[field] !== graph.root.abi[field])) fail("graph representation differs from its root");
	return snapshot;
};
