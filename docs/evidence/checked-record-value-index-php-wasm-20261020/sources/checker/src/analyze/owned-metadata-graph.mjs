/**
 * Validate finite resource-bearing compiler graphs under an explicit policy.
 * Copied graph admission and callback retention remain separate contracts.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { componentRecursiveLimits } from "../abi/component-recursive.mjs";
import { validateOwnedAggregatePolicy } from "./owned-aggregate-policy.mjs";

const fail = message => { throw new TypeError(`Invalid owned metadata graph: ${message}`); };
const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/;
const closed = (value, keys) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
		|| Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(key => !keys.includes(key))) fail("descriptor fields must be closed");
	for(const key of keys) if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value")) fail("descriptor accessors are unsupported");
};
const dense = (values, limit) => {
	if(!Array.isArray(values) || values.length > limit || Reflect.ownKeys(values).length !== values.length + 1) fail("expected a bounded dense table");
	for(let index = 0; index < values.length; ++index)
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail("table accessors or holes are unsupported");
};
const kindOf = value => {
	const kind = value && Object.getOwnPropertyDescriptor(value, "kind");
	if(!kind || !Object.hasOwn(kind, "value")) fail("missing data kind");
	return kind.value;
};
const name = value => {
	if(typeof value !== "string" || !identifier.test(value)) fail("invalid nominal identifier");
};

/**
 * Check topology and author policy before inspecting native representations.
 * Resource edges retain their identity; they never enter the copied graph codec.
 *
 * @param graph - Ownership-aware native compiler report.
 * @param policy - Independently retained author decision from the request.
 * @param validate - Native representation validator with a closed nominal table.
 */
export const validateOwnedMetadataGraph = (graph, policy, validate) => {
	closed(graph, ["kind", "root", "types", "policy", "abi"]);
	if(graph.kind !== "owned-graph") fail("expected an owned graph wrapper");
	validateOwnedAggregatePolicy(policy); validateOwnedAggregatePolicy(graph.policy);
	if(canonicalJson(graph.policy) !== canonicalJson(policy)) fail("ownership policy differs from the authorized request");
	dense(graph.types, componentRecursiveLimits.nominalTypes);
	let nodes = 0;
	const charge = depth => {
		if(depth > componentRecursiveLimits.schemaDepth || ++nodes > componentRecursiveLimits.typeNodes) fail("type nesting or node limit exceeded");
	};
	const keys = (value, fields) => {
		closed(value, [...fields, "abi"]);
		closed(value.abi, ["cType", "box", "unbox", "heap"]);
	};
	closed(graph.abi, ["cType", "box", "unbox", "heap"]);
	const edges = new Map(), resources = new Map(), table = new Map();
	const edge = (value, references, depth = 0) => {
		charge(depth);
		const kind = kindOf(value);
		if(["primitive", "reference", "resource"].includes(kind))
		{
			keys(value, ["kind", "name", "lean", ...(kind === "resource" ? ["module"] : [])]);
			name(value.name); name(value.lean);
			if(kind === "reference") references.add(value.name);
			if(kind === "resource")
			{
				name(value.module);
				if(resources.has(value.name) && canonicalJson(resources.get(value.name)) !== canonicalJson(value)) fail("conflicting resource identity");
				resources.set(value.name, value);
			}
			return;
		}
		if(["array", "list", "option"].includes(kind))
		{
			keys(value, ["kind", "element"]); edge(value.element, references, depth + 1); return;
		}
		if(!["tuple", "result"].includes(kind)) fail("edges require values or resources; inline definitions, nested graphs and retained callbacks are unsupported");
		keys(value, ["kind", "arguments"]); dense(value.arguments, 2);
		if(value.arguments.length !== 2) fail("products and results require two arguments");
		value.arguments.forEach(child => edge(child, references, depth + 1));
	};
	const fields = (values, references, record = false) => {
		dense(values, 1024);
		for(const field of values)
		{
			closed(field, ["name", "type", ...(record ? ["projection"] : [])]);
			name(field.name); if(record) name(field.projection);
			edge(field.type, references);
		}
	};
	const rootReferences = new Set(); edge(graph.root, rootReferences);
	if(["primitive", "resource"].includes(graph.root.kind)) fail("an owned graph must describe an aggregate");
	for(const type of graph.types)
	{
		charge(0);
		const kind = kindOf(type);
		if(!["alias", "record", "variant"].includes(kind)) fail("nominal table only admits aliases, records and variants");
		keys(type, ["kind", "name", "lean", kind === "alias" ? "target" : kind === "record" ? "fields" : "cases", ...(kind === "record" ? ["constructor"] : [])]);
		name(type.name); name(type.lean);
		if(table.has(type.name)) fail("duplicate nominal definition");
		table.set(type.name, type);
		const references = new Set(); edges.set(type.name, references);
		if(kind === "alias") edge(type.target, references);
		else if(kind === "record")
		{ name(type.constructor); fields(type.fields, references, true); }
		else
		{
			dense(type.cases, 1024);
			for(const branch of type.cases)
			{
				charge(0); closed(branch, ["name", "constructor", "fields"]);
				name(branch.name); name(branch.constructor); fields(branch.fields, references);
			}
		}
	}
	if(!resources.size) fail("owned aggregates must contain a resource identity");
	for(const resource of resources.keys()) if(table.has(resource)) fail("resource identity conflicts with a value definition");
	for(const references of [rootReferences, ...edges.values()])
		for(const reference of references) if(!table.has(reference)) fail(`missing nominal definition ${reference}`);
	const reachable = new Set(), pending = [...rootReferences];
	while(pending.length)
	{
		const reference = pending.pop();
		if(reachable.has(reference)) continue;
		reachable.add(reference); pending.push(...edges.get(reference));
	}
	if(reachable.size !== table.size) fail("unreachable nominal definitions");
	const aliases = new Map([...table].filter(([, type]) => type.kind === "alias").map(([id]) => [id
		, [...edges.get(id)].filter(child => table.get(child).kind === "alias")]));
	const done = new Set(), active = new Set();
	for(const id of aliases.keys())
	{
		if(done.has(id)) continue;
		const stack = [{ id, index: 0 }]; active.add(id);
		while(stack.length)
		{
			const frame = stack.at(-1), children = aliases.get(frame.id);
			if(frame.index === children.length)
			{ active.delete(frame.id); done.add(frame.id); stack.pop(); continue; }
			const child = children[frame.index++];
			if(active.has(child)) fail(`cyclic alias ${child}`);
			if(!done.has(child))
			{ active.add(child); stack.push({ id: child, index: 0 }); }
		}
	}
	validate(graph.root, table);
	for(const type of graph.types) validate(type, table);
	if(["cType", "box", "unbox", "heap"].some(field => graph.abi[field] !== graph.root.abi[field])) fail("graph representation differs from its root");
	return graph;
};
