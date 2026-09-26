/**
 * Preserve copied data and retained identities in one finite ownership model.
 * This descriptor does not admit a backend or claim executable transport.
 *
 * @file
 */
import { validateOwnedAggregateBindingIr } from "../binding-ir/contract.mjs";
import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";

const freeze = value => {
	if(value && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.values(value).forEach(freeze); Object.freeze(value);
	}
	return value;
};
const fail = (code, message) => { throw Object.assign(new TypeError(message), { code }); };

/**
 * Compile concrete ownership sites and recursive shapes without erasing aliases.
 *
 * @param input - Complete v4 contract, independently reviewed or compiler-derived.
 */
export const compileOwnedAggregateModel = input => {
	const ir = structuredClone(input); validateOwnedAggregateBindingIr(ir);
	const builtinPolicy = ir.aggregatePolicy;
	if([...ir.types, ...ir.declarations].some(item => item.typeParameters.length))
		fail("owned-aggregate-specialization", "Owned aggregate transport requires concrete specializations");
	const definitions = new Map(ir.types.map(type => [type.id, type]));
	const pending = [], references = new Map(), nodes = new Map();
	const representation = ref => {
		if(ref.kind === "primitive") return "copied";
		if(ref.kind === "named") return definitions.get(ref.id).representation;
		if(ref.kind !== "apply") fail("owned-aggregate-specialization", "A runtime value cannot contain a type parameter");
		const children = [...ref.arguments];
		while(children.length)
		{
			const child = children.pop();
			if(child.kind === "apply") children.push(...child.arguments);
			else if(child.kind === "named" && definitions.get(child.id).representation !== "copied") return "owned";
			else if(child.kind === "parameter") fail("owned-aggregate-specialization", "A runtime value cannot contain a type parameter");
		}
		return "copied";
	};
	const enqueue = ref => {
		const id = ref.kind === "named" ? ref.id : ref.kind === "primitive" ? `primitive:${ref.name}`
			: `aggregate:${sha256Text(canonicalizeJsonValue(ref))}`;
		if(!references.has(id))
		{
			if(references.size === 4096) fail("owned-aggregate-type-limit", "Owned aggregate type graph exceeds 4096 nodes");
			references.set(id, ref); pending.push(id);
		}
		return id;
	};
	const site = item => ({ type: enqueue(item.type)
		, representation: representation(item.type)
		, ownership: item.ownership, lifetime: item.lifetime
		, ...(item.name === undefined ? {} : { name: item.name })
		, ...(item.optional === undefined ? {} : { optional: item.optional, default: item.default })
		, ...(item.mutability === undefined ? {} : { mutability: item.mutability }) });
	const fields = values => values.map(field => ({ name: field.name
		, type: enqueue(field.type)
		, retention: representation(field.type) === "copied" ? "copy" : "lease"
		, mutability: field.mutability }));
	const declarations = ir.declarations.map(declaration => ({ id: declaration.id
		, name: declaration.name
		, kind: declaration.kind, owner: declaration.owner
		, receiver: declaration.receiver && site(declaration.receiver)
		, parameters: declaration.parameters.map(site)
		, result: site(declaration.result)
		, effects: declaration.effects, failure: declaration.failure
		, resultMode: declaration.resultMode }));
	for(let cursor = 0; cursor < pending.length; ++cursor)
	{
		const id = pending[cursor], ref = references.get(id);
		const node = { id, representation: representation(ref) }; nodes.set(id, node);
		if(ref.kind === "primitive") Object.assign(node, { kind: "primitive", name: ref.name });
		else if(ref.kind === "apply") Object.assign(node, { kind: ref.constructor
			, arguments: ref.arguments.map(enqueue)
			, aggregate: node.representation === "owned" ? builtinPolicy : null });
		else
		{
			const type = definitions.get(ref.id);
			Object.assign(node, { kind: type.kind, name: type.name });
			if(type.kind === "record") Object.assign(node, { fields: fields(type.fields), aggregate: type.aggregate });
			else if(type.kind === "variant") Object.assign(node, {
				cases: type.cases.map(branch => ({ name: branch.name, fields: fields(branch.fields) }))
				, aggregate: type.aggregate });
			else if(type.kind === "alias") node.target = enqueue(type.target);
			else if(type.kind === "resource") node.resource = type.resource;
			else if(type.kind === "callback") node.callable = { ...type.callable
				, parameters: type.callable.parameters.map(site)
				, result: site(type.callable.result) };
		}
	}
	if(![...nodes.values()].some(node => node.representation === "owned"))
		fail("owned-aggregate-required", "This model requires at least one reachable owned aggregate");
	return freeze({ schemaVersion: 1, kind: "owned-aggregate-value-model"
		, bindingIr: ir, bindingIrSha256: sha256Text(canonicalizeJsonValue(ir))
		, component: ir.component, declarations
		, types: [...nodes.values()].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
		, limits: { depth: 128, visits: 262144, bytes: 16777216, retained: 4096 }
		, assurance: ir.assurance, assuranceScope: "original-lean-binding-ir"
	});
};
