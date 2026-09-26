/**
 * Validate compiler-owned native representations without coupling to a host generator.
 *
 * @file
 */
import { componentScalarTypes } from "../abi/component-scalars.mjs";
import { validateCopiedMetadataGraph } from "./copied-metadata-graph.mjs";
import { validateOwnedMetadataGraph } from "./owned-metadata-graph.mjs";
import { validateOwnedAggregatePolicy } from "./owned-aggregate-policy.mjs";

const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const fail = message => { throw new TypeError(`native-library-v1: ${message}`); };
const closed = (value, fields, label) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
		|| Reflect.ownKeys(value).length !== fields.length || Reflect.ownKeys(value).some(key => !fields.includes(key))
		|| fields.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"))) fail(`invalid ${label} fields`);
};

/**
 * Reject shapes before rendering either Lean or C source.
 *
 * @param type - Checked native type and compiler representation.
 * @param depth - Current recursive type-validation depth.
 * @param copied - Whether this position forbids retained identity.
 */
export const validateNativeType = (type, depth = 0, copied = false) => validate(type, depth, copied);

/**
 * Admit ownership-aware metadata only with an independently authorized policy.
 *
 * @param type - Compiler-owned native type.
 * @param policy - Explicit aggregate author decision.
 */
export const validateOwnedNativeType = (type, policy) => {
	validateOwnedAggregatePolicy(policy);
	return validate(type, 0, false, undefined, policy);
};

const validate = (type, depth, copied, references, policy, owned = false) => {
	if(!type || depth > 32) fail("type nesting exceeds 32");
	if(!Object.hasOwn(Object.getOwnPropertyDescriptor(type, "kind") ?? {}, "value")) fail("type kind must be a data field");
	if(type.kind === "owned-graph")
	{
		if(!policy || references || copied) fail("owned aggregates require a separately authorized graph boundary");
		return validateOwnedMetadataGraph(type, policy, (value, table) => validate(value, 0, true, table, policy, true));
	}
	const fields = { primitive: ["kind", "name", "lean", "abi"]
		, graph: ["kind", "root", "types", "abi"]
		, reference: ["kind", "name", "lean", "abi"]
		, alias: ["kind", "name", "lean", "target", "abi"]
		, array: ["kind", "element", "abi"]
		, list: ["kind", "element", "abi"]
		, option: ["kind", "element", "abi"]
		, result: ["kind", "arguments", "abi"]
		, tuple: ["kind", "arguments", "abi"]
		, record: ["kind", "name", "lean", "constructor", "fields", "abi"]
		, variant: ["kind", "name", "lean", "cases", "abi"]
		, resource: ["kind", "name", "lean", "module", "abi"]
		, callback: ["kind", "parameters", "result", "abi"] }[type.kind];
	if(!fields) fail("unknown native type");
	closed(type, fields, "native type");
	closed(type.abi, ["cType", "box", "unbox", "heap"], "native representation");
	if(!type.abi || !["lean_object*", "uint8_t", "uint16_t", "uint32_t", "uint64_t", "size_t", "float", "double"].includes(type.abi.cType)
	  || !/^lean_box(?:_uint32|_uint64|_usize|_float32|_float)?$/.test(type.abi.box)
	  || !/^lean_unbox(?:_uint32|_uint64|_usize|_float32|_float)?$/.test(type.abi.unbox)
	  || typeof type.abi.heap !== "boolean") fail("missing checked native representation");
	const suffix = { uint32_t: "_uint32", uint64_t: "_uint64", size_t: "_usize", float: "_float32", double: "_float" }[type.abi.cType] ?? "";
	if(type.abi.box !== `lean_box${suffix}` || type.abi.unbox !== `lean_unbox${suffix}`
	  || (type.abi.heap && type.abi.cType !== "lean_object*")) fail("inconsistent native representation");
	const recurse = (child, copy = copied) => validate(child, depth + 1, copy, references, policy, owned);
	if(type.kind === "graph")
	{
		if(references) fail("nested copied graph");
		validateCopiedMetadataGraph(type, (value, table) => validate(value, 0, true, table), true);
	} else if(type.kind === "reference")
	{
		if(typeof type.name !== "string" || !identifier.test(type.name) || type.name !== type.lean || !references?.has(type.name)) fail("reference requires a matching nominal definition in its graph");
		const target = references.get(type.name);
		if(["cType", "box", "unbox", "heap"].some(field => type.abi[field] !== target.abi[field])) fail("reference representation differs from its definition");
	} else if(type.kind === "primitive")
	{
		const spellings = ["Unit", "Bool", "UInt8", "UInt16", "UInt32", "UInt64", "Int8", "Int16", "Int32", "Int64", "Nat", "Int", "Float32", "Float", "String", "ByteArray", "Char", "USize", "ISize"];
		if(spellings[componentScalarTypes.indexOf(type.name)] !== type.lean) fail("unknown primitive spelling");
		if(["usize", "isize"].includes(type.name) && (type.abi.cType !== "size_t" || type.abi.heap)) fail("platform integer requires the compiler's size_t representation");
		if(type.abi.cType === "size_t" && !["usize", "isize"].includes(type.name)) fail("size_t is not a fixed-width primitive representation");
	} else if(type.kind === "alias")
	{
		if(typeof type.name !== "string" || !identifier.test(type.name) || type.name !== type.lean) fail("invalid alias identity");
		recurse(type.target, true);
		if(["cType", "box", "unbox", "heap"].some(field => type.abi[field] !== type.target.abi[field])) fail("alias representation differs from its target");
	} else if(["array", "list", "option"].includes(type.kind)) recurse(type.element, true);
	else if(["result", "tuple"].includes(type.kind))
	{
		if(!Array.isArray(type.arguments) || type.arguments.length !== 2 || !Object.hasOwn(type.arguments, 0) || !Object.hasOwn(type.arguments, 1)) fail("native results and products require two arguments");
		type.arguments.forEach(child => recurse(child, true));
	}
	else if(type.kind === "record")
	{
		if(!identifier.test(type.name) || type.name !== type.lean || !identifier.test(type.constructor)) fail("invalid record identity");
		if(!Array.isArray(type.fields) || new Set(type.fields.map(field => field.name)).size !== type.fields.length) fail("invalid record fields");
		for(const field of type.fields)
		{
			closed(field, ["name", "projection", "type"], "record field");
			if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name) || !identifier.test(field.projection)
	      || ["new", "DESTROY", "CLONE", "CLONE_SKIP"].includes(field.name)) fail("invalid or reserved record field");
			recurse(field.type, true);
		}
	} else if(type.kind === "variant")
	{
		if(typeof type.name !== "string" || !identifier.test(type.name) || type.name !== type.lean) fail("invalid variant identity");
		if(!Array.isArray(type.cases) || !type.cases.length || type.cases.length > 1024
			|| new Set(type.cases.map(item => item.name)).size !== type.cases.length) fail("invalid variant cases");
		for(const item of type.cases)
		{
			closed(item, ["name", "constructor", "fields"], "variant case");
			if(typeof item.name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.name) || item.constructor !== `${type.name}.${item.name}`) fail("invalid variant constructor");
			if(!Array.isArray(item.fields) || item.fields.length > 1024
				|| new Set(item.fields.map(field => field.name)).size !== item.fields.length) fail("invalid variant fields");
			for(const field of item.fields)
			{
				closed(field, ["name", "type"], "variant field");
				if(typeof field.name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name)
					|| ["kind", "new", "DESTROY", "CLONE", "CLONE_SKIP"].includes(field.name)) fail("invalid or reserved variant field");
				recurse(field.type, true);
			}
		}
	} else if(type.kind === "resource")
	{
		if(copied && !owned) fail("identity resources inside copied values require an ownership policy");
		if(!identifier.test(type.name) || type.name !== type.lean || !identifier.test(type.module) || !type.abi.heap) fail("invalid resource identity");
	} else if(type.kind === "callback")
	{
		if(copied) fail("callbacks inside copied values require a retention policy");
		if(!Array.isArray(type.parameters) || !type.parameters.length || type.parameters.length > 16) fail("callback arity must be 1 through 16");
		type.parameters.forEach(parameter => recurse(parameter)); recurse(type.result);
	} else fail(`unsupported type kind ${type.kind}`);
	return type;
};
