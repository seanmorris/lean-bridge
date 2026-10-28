/**
 * Validate compiler-owned native representations without coupling to a host generator.
 *
 * @file
 */
import { componentScalarTypes, isClosedValueIndex } from "../abi/component-scalars.mjs";
import { validateCopiedMetadataGraph } from "./copied-metadata-graph.mjs";
import { validateOwnedMetadataGraph } from "./owned-metadata-graph.mjs";
import { validateOwnedAggregatePolicy } from "./owned-aggregate-policy.mjs";

const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const fail = message => { throw new TypeError(`native-library-v1: ${message}`); };

const checkedRecordDefinition = (value, references) => {
	const seen = new Set();
	for(let depth = 0; depth <= 1024; depth++)
	{
		if(value?.kind === "reference")
		{
			if(typeof value.name !== "string" || seen.has(value.name) || !references?.has(value.name))
				fail("checked record refinements require a closed nominal base");
			seen.add(value.name); value = references.get(value.name); continue;
		}
		if(value?.kind === "alias")
		{
			if(typeof value.name !== "string") fail("checked record refinements require a named alias base");
			seen.add(value.name); value = value.target; continue;
		}
		return value;
	}
	fail("checked record alias chain exceeds the nominal type limit");
};
const closed = (value, fields, label) => {
	if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
		|| Reflect.ownKeys(value).length !== fields.length || Reflect.ownKeys(value).some(key => !fields.includes(key))
		|| fields.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"))) fail(`invalid ${label} fields`);
};

// Whether a copied type, or any table definition it references, has a node of one of these kinds.
const containsKind = (value, kinds, references, seen = new Set()) => {
	if(!value || typeof value !== "object") return false;
	if(Array.isArray(value)) return value.some(item => containsKind(item, kinds, references, seen));
	if(kinds.includes(value.kind)) return true;
	if(value.kind === "reference")
	{
		if(seen.has(value.name) || !references?.has(value.name)) return false;
		seen.add(value.name);
		return containsKind(references.get(value.name), kinds, references, seen);
	}
	return Object.entries(value).some(([key, child]) => key !== "abi" && key !== "predicate" && containsKind(child, kinds, references, seen));
};
// Every type carries one checked C representation.
const representation = type => {
	closed(type.abi, ["cType", "box", "unbox", "heap"], "native representation");
	if(!type.abi || !["lean_object*", "uint8_t", "uint16_t", "uint32_t", "uint64_t", "size_t", "float", "double"].includes(type.abi.cType)
	  || !/^lean_box(?:_uint32|_uint64|_usize|_float32|_float)?$/.test(type.abi.box)
	  || !/^lean_unbox(?:_uint32|_uint64|_usize|_float32|_float)?$/.test(type.abi.unbox)
	  || typeof type.abi.heap !== "boolean") fail("missing checked native representation");
	const suffix = { uint32_t: "_uint32", uint64_t: "_uint64", size_t: "_usize", float: "_float32", double: "_float" }[type.abi.cType] ?? "";
	if(type.abi.box !== `lean_box${suffix}` || type.abi.unbox !== `lean_unbox${suffix}`
	  || (type.abi.heap && type.abi.cType !== "lean_object*")) fail("inconsistent native representation");
};

/**
 * Reject shapes before rendering either Lean or C source.
 *
 * @param type - Checked native type and compiler representation.
 * @param depth - Current recursive type-validation depth.
 * @param copied - Whether this position forbids retained identity.
 * @param site - Top-level export site, "parameter" or "result", that fixes a callback's checked directions.
 */
// A top-level site names its role: a parameter's callback is the host's, whose arguments Lean produces;
// a result's callback is a Lean closure leased to the host, whose arguments are checked before it runs.
export const validateNativeType = (type, depth = 0, copied = false, site = undefined) => {
	if(site !== undefined && (!["parameter", "result"].includes(site) || depth !== 0 || copied)) fail("invalid native callback site");
	return validate(type, depth, copied, undefined, undefined, false, depth === 0 && !copied, site, depth === 0 && !copied, site === "result");
};

/**
 * Validate a proof-erased carrier after its source refinement tree passed site checks.
 *
 * @param type - Compiler-owned native representation.
 */
export const validateNativeRepresentation = type =>
	validate(type, 0, false, undefined, undefined, false, true, undefined, true, false, true);

/**
 * Admit ownership-aware metadata only with an independently authorized policy.
 *
 * @param type - Compiler-owned native type.
 * @param policy - Explicit aggregate author decision.
 * @param site - Known top-level direction for checked owned leaves.
 */
export const validateOwnedNativeType = (type, policy, site = undefined) => {
	validateOwnedAggregatePolicy(policy);
	if(site !== undefined && !["parameter", "result"].includes(site)) fail("invalid owned refinement site");
	return validate(type, 0, false, undefined, policy, false, true, site, site !== undefined, site === "result");
};

/**
 * Require every consumed occurrence of a proof-carrying record in an owned graph to sit
 * under its checked-record refinement, directly or through aliases and structural
 * containers, including inside the fields of enclosing records and active variant cases.
 * Produced occurrences stay bare because Lean already holds their proofs. A recursive
 * back-edge inherits the constructor already selected on the finite path to it.
 *
 * @param graph - Structurally validated owned graph.
 * @param consumed - Whether the host produces this site's value.
 */
const assertOwnedCheckedRecordCoverage = (graph, consumed) => {
	if(!consumed) return;
	const table = new Map(graph.types.map(definition => [definition.name, definition]));
	const erased = definition => definition?.kind === "record" && Object.hasOwn(definition, "erased");
	const visit = (node, selected, seen) => {
		if(node?.kind === "refinement")
		{
			if(node.predicate?.kind === "checked-record") return visit(node.base, true, seen);
			return visit(node.base, false, seen);
		}
		if(node?.kind === "reference")
		{
			// A back-edge to a record already on this finite path inherits its selection.
			if(seen.has(node.name)) return;
			const definition = table.get(node.name), inner = new Set([...seen, node.name]);
			// A transparent alias keeps the selection made on the reference that names it.
			if(definition?.kind === "alias") return visit(definition.target, selected, inner);
			if(erased(definition) && !selected) fail("checked records require a structural native parameter constructor");
			return visitDefinition(definition, inner);
		}
		if(node?.kind === "alias") return visit(node.target, selected, seen);
		if(node?.kind === "record" && erased(node) && !selected) fail("checked records require a structural native parameter constructor");
		if(["array", "list", "option"].includes(node?.kind)) return visit(node.element, false, seen);
		if(["result", "tuple"].includes(node?.kind)) return node.arguments.forEach(child => visit(child, false, seen));
	};
	const visitDefinition = (definition, seen) => {
		if(definition?.kind === "alias") return visit(definition.target, false, seen);
		const fields = definition?.kind === "variant" ? definition.cases.flatMap(branch => branch.fields)
			: definition?.kind === "record" ? definition.fields : [];
		for(const field of fields) visit(field.type, false, seen);
	};
	visit(graph.root, false, new Set());
};

// `structural` stays true while only arrays, lists, options, products, results and aliases separate a
// position from its top-level parameter or result.
const validate = (type, depth, copied, references, policy, owned = false, structural = true, site = undefined, subtypeStructural = false, subtypeResult = false, erasedTransport = false) => {
	if(!type || depth > 32) fail("type nesting exceeds 32");
	if(!Object.hasOwn(Object.getOwnPropertyDescriptor(type, "kind") ?? {}, "value")) fail("type kind must be a data field");
	if(type.kind === "owned-graph")
	{
		if(!policy || references || copied) fail("owned aggregates require a separately authorized graph boundary");
		validateOwnedMetadataGraph(type, policy, (value, table, context) => validate(value, 0, true, table, policy, true
			, true, site, subtypeStructural, subtypeResult, erasedTransport || context?.definition === true));
		// Definitions validate as nominal transports, so per-use constructor coverage is a
		// separate pass over the occurrences reachable from this site's root.
		// The direction bit, not the site label, decides coverage: inside a directional
		// callback the site is cleared while subtypeResult carries who produces the value.
		if(!erasedTransport) assertOwnedCheckedRecordCoverage(type, !subtypeResult);
		return type;
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
		, record: ["kind", "name", "lean", "constructor", ...["provenance"].filter(key => Object.hasOwn(type, key)), "fields", ...["erased"].filter(key => Object.hasOwn(type, key)), "abi"]
		, variant: ["kind", "name", "lean", "cases", "abi"]
		, resource: ["kind", "name", "lean", "module", "abi"]
		, callback: ["kind", "parameters", "result", "abi"]
		, refinement: ["kind", "base", "predicate", "abi"] }[type.kind];
	if(!fields) fail("unknown native type");
	closed(type, fields, "native type");
	representation(type);
	const recurse = (child, copy = copied, inner = structural, subtype = subtypeStructural, produced = subtypeResult) =>
		validate(child, depth + 1, copy, references, policy, owned, inner, undefined, subtype, produced, erasedTransport);
	if(type.kind === "graph")
	{
		if(references) fail("nested copied graph");
		validateCopiedMetadataGraph(type, (value, table, context) => validate(value, 0, true, table, policy, owned, true, site, true, subtypeResult
			, erasedTransport || context.definition), true);
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
	} else if(type.kind === "refinement")
	{
		// Bounds stay decimal text; checked adapters exist only at top-level sites and inside structural containers.
		if(!structural && !(type.predicate?.kind === "subtype" && subtypeStructural)) fail(type.predicate?.kind === "subtype"
			? "Subtype refinements require a top-level or directional callback site"
			: "Fin refinements require a top-level native parameter or result, or an array, list, option, product, Except, plain record or variant of one");
		if(type.predicate?.kind === "checked-record")
		{
			// Only a structural input path may invoke the selected constructor. Produced records cross
			// bare below because Lean already owns their proof fields.
			if(!subtypeStructural || subtypeResult) fail("checked records require a structural native parameter constructor");
			closed(type.predicate, ["kind", "constructor"], "refinement predicate");
			if(typeof type.predicate.constructor !== "string" || !identifier.test(type.predicate.constructor)) fail("invalid checked record constructor");
			const base = checkedRecordDefinition(type.base, references);
			if(base?.kind !== "record" || !Object.hasOwn(base, "erased")) fail("checked record refinements require a record with erased proofs");
			validate(type.base, depth, copied, references, policy, owned, structural, "checked-record", true, false, erasedTransport);
		}
		else if(type.predicate?.kind === "subtype")
		{
			// Copied plain records and variants retain a constructor at each use, not on the shared type.
			if(!subtypeStructural) fail("Subtype refinements require a top-level or structural-container native parameter or result, including copied plain and generic records and variants but excluding callbacks");
			closed(type.predicate, ["kind", "constructor"], "refinement predicate");
			if(subtypeResult ? type.predicate.constructor !== null
				: typeof type.predicate.constructor !== "string" || !identifier.test(type.predicate.constructor)) fail("invalid Subtype refinement");
			recurse(type.base, true);
			if(type.base.kind !== "primitive") fail("Subtype refinements require a primitive base");
		}
		else if(type.predicate?.kind === "fin-parameter")
		{
			closed(type.predicate, ["kind", "parameter"], "refinement predicate");
			if(!Number.isSafeInteger(type.predicate.parameter) || type.predicate.parameter < 0 || type.predicate.parameter > 1023)
				fail("invalid dependent Fin refinement");
			recurse(type.base, true);
			if(type.base.kind !== "primitive" || type.base.name !== "nat") fail("dependent Fin refinements require a Nat base");
		}
		else
		{
			closed(type.predicate, ["kind", "bound"], "refinement predicate");
			if(type.predicate.kind !== "fin" || typeof type.predicate.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(type.predicate.bound)) fail("invalid Fin refinement");
			recurse(type.base, true);
			if(type.base.kind !== "primitive" || type.base.name !== "nat") fail("Fin refinements require a Nat base");
		}
		if(["cType", "box", "unbox", "heap"].some(field => type.abi[field] !== type.base.abi[field])) fail("refinement representation differs from its base");
	} else if(type.kind === "alias")
	{
		if(typeof type.name !== "string" || !identifier.test(type.name) || type.name !== type.lean) fail("invalid alias identity");
		// Transparent alias spelling cannot discard the checked constructor that guards its
		// underlying proof-backed record. Other top-level site labels intentionally stop here:
		// only the checked-record marker describes the already validated inner conversion.
		validate(type.target, depth + 1, true, references, policy, owned, structural
			, site === "checked-record" ? site : undefined
			, subtypeStructural, subtypeResult, erasedTransport);
		if(["cType", "box", "unbox", "heap"].some(field => type.abi[field] !== type.target.abi[field])) fail("alias representation differs from its target");
	} else if(["array", "list", "option"].includes(type.kind)) recurse(type.element, true);
	else if(["result", "tuple"].includes(type.kind))
	{
		if(!Array.isArray(type.arguments) || type.arguments.length !== 2 || !Object.hasOwn(type.arguments, 0) || !Object.hasOwn(type.arguments, 1)) fail("native results and products require two arguments");
		// Both components and both branches are structural; the adapters check only the active branch.
		type.arguments.forEach(child => recurse(child, true));
	}
	else if(type.kind === "record")
	{
		if(!identifier.test(type.name) || type.name !== type.lean || !identifier.test(type.constructor)) fail("invalid record identity");
		if(!Array.isArray(type.fields) || new Set(type.fields.map(field => field.name)).size !== type.fields.length) fail("invalid record fields");
		// An instantiated generic structure keeps its origin: the structure and the closed type arguments
		// the compiler resolved, each a copied shape or a nominal reference. The alias stays the identity.
		if(Object.hasOwn(type, "provenance"))
		{
			closed(type.provenance, ["structure", "arguments"], "record provenance");
			if(!identifier.test(type.provenance.structure) || type.provenance.structure === type.name
				|| !type.constructor.startsWith(`${type.provenance.structure}.`)) fail("invalid record provenance");
			if(!Array.isArray(type.provenance.arguments) || !type.provenance.arguments.length || type.provenance.arguments.length > 16) fail("invalid record provenance arguments");
			// Arguments are copied types validated like field types: inline definitions in the inline form,
			// references in the graph form. Nothing inside an argument is an identity, a callback or a refinement.
			for(const child of type.provenance.arguments)
			{
				// A value index is closed instantiation provenance, never a host type.
				if(child?.kind === "value")
				{
					closed(child, ["kind", "type", "value"], "record value argument");
					recurse(child.type, true, false, false, false);
					if(child.type.kind !== "primitive" || !isClosedValueIndex(child.type.name, child.value)) fail("invalid record value argument");
					continue;
				}
				recurse(child, true, false, false, false);
				if(containsKind(child, ["resource", "callback", "refinement"], references)) fail("record provenance arguments cannot carry resource, callback or refinement types");
			}
		}
		// Erased proof fields never cross. A record carrying them crosses only as a Lean-produced
		// result or as the base of a parameter's checked-record refinement.
		if(Object.hasOwn(type, "erased"))
		{
			// A bare one at a parameter would bypass the constructor; representation checks pass no site.
			if(site !== "checked-record" && !subtypeResult && !erasedTransport) fail("checked records cross only through a parameter constructor or as a result");
			if(Object.hasOwn(type, "provenance") && (depth !== 0 || copied))
				fail("nested generic checked records require another representation");
			if(!Array.isArray(type.erased) || !type.erased.length || type.erased.length > 1024 || new Set(type.erased).size !== type.erased.length
				|| type.erased.some(name => typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_']*$/.test(name))
				|| type.fields.some(field => type.erased.includes(field.name))) fail("invalid erased proof fields");
		}
		for(const [index, field] of type.fields.entries())
		{
			closed(field, ["name", "projection", "type"], "record field");
			if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name) || !identifier.test(field.projection)
	      || ["new", "DESTROY", "CLONE", "CLONE_SKIP"].includes(field.name)) fail("invalid or reserved record field");
			// Generic fields may carry a per-use Subtype constructor, but remain
			// non-structural for Fin and every other nested refinement.
			const refinable = !Object.hasOwn(type, "erased")
				|| site === "checked-record" || subtypeResult || erasedTransport;
			const generic = Object.hasOwn(type, "provenance");
			// A dependent Fin payload is transported as Nat and may name only an earlier
			// retained Nat field of this proof-backed record. Its enclosing checked-record
			// constructor, rather than a standalone static bound, validates the relationship.
			if(field.type?.kind === "refinement" && field.type.predicate?.kind === "fin-field")
			{
				if(!Object.hasOwn(type, "erased") || !refinable || generic) fail("dependent Fin fields require a checked record");
				closed(field.type, ["kind", "base", "predicate", "abi"], "native type");
				representation(field.type);
				closed(field.type.predicate, ["kind", "field"], "refinement predicate");
				const dependency = type.fields.findIndex((candidate, position) => position < index && candidate.name === field.type.predicate.field);
				if(typeof field.type.predicate.field !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field.type.predicate.field)
					|| dependency < 0 || type.fields[dependency].type?.kind !== "primitive" || type.fields[dependency].type.name !== "nat")
					fail("dependent Fin field must reference an earlier retained Nat field");
				recurse(field.type.base, true, true, false, false);
				if(field.type.base.kind !== "primitive" || field.type.base.name !== "nat"
					|| ["cType", "box", "unbox", "heap"].some(name => field.type.abi[name] !== field.type.base.abi[name]))
					fail("dependent Fin fields require a Nat transport");
			}
			else recurse(field.type, true, !generic, subtypeStructural && refinable
				, subtypeResult && refinable);
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
				recurse(field.type, true, true, subtypeStructural);
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
		// A top-level parameter is a host callback: Lean produces its arguments and the host
		// produces its reply. A top-level result is a leased Lean closure with the opposite
		// direction. Checked records follow that direction: a Lean-produced record crosses
		// bare, and a host-produced one wraps its selected constructor. Nested callbacks
		// retain the established no-refinement boundary, which the record rules below refuse.
		if(site === undefined)
		{
			type.parameters.forEach(parameter => recurse(parameter, copied, false, false, false));
			recurse(type.result, copied, false, false, false);
		}
		else
		{
			const host = site === "parameter";
			for(const parameter of type.parameters)
				validate(parameter, depth + 1, copied, references, policy, owned, true, undefined, true, host, erasedTransport);
			validate(type.result, depth + 1, copied, references, policy, owned, true, undefined, true, !host, erasedTransport);
		}
	} else fail(`unsupported type kind ${type.kind}`);
	return type;
};
