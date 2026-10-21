/**
 * Closed refinement trees checked against their erased transport types.
 *
 * @file
 */

/**
 * Match per-use predicate trees to erased transport types. Nominal choices need the
 * enclosing document's definitions; shared nominal extensions remain Fin-only.
 *
 * @param refinement - Compiler-owned predicate tree, or null for no constraint.
 * @param type - Matching public transport type reference.
 * @param depth - Bounded structural nesting; callers start at zero.
 * @param subtypeStructural - Whether this export site permits selected Subtype constructors.
 * @param types - Definitions used to authenticate selected record and variant members.
 * @param subtypeResult - Whether this is a copied export result produced by Lean.
 * @param ownedStructural - Whether an explicitly ownership-aware boundary may
 * traverse an owned nominal record or variant while authenticating its copied
 * refined leaves.
 */
export const assertRefinement = (refinement, type, depth = 0, subtypeStructural = depth === 0, types = [], subtypeResult = false, ownedStructural = false) => {
	const fail = () => { throw new TypeError("Refinement does not match its transport type"); };
	const definitions = new Map(types.map(definition => [definition.id, definition]));
	if(definitions.size !== types.length) fail();
	let nodes = 0;
	const closed = (value, keys) => {
		if(!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
			|| Reflect.ownKeys(value).length !== keys.length
			|| keys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"))) fail();
	};
	const array = (values, count) => {
		if(!Array.isArray(values) || values.length !== count || count > 1024) fail();
		for(let index = 0; index < count; index++)
			if(!Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail();
	};
	const dependentField = (value, transport, definition, index) => {
		closed(value, ["kind", "field"]);
		const dependency = definition?.fields?.findIndex((field, position) => position < index && field.name === value.field);
		if(value.kind !== "fin-field" || typeof value.field !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value.field)
			|| transport?.kind !== "primitive" || transport.name !== "nat" || !Number.isInteger(dependency) || dependency < 0
			|| definition.fields[dependency].type?.kind !== "primitive" || definition.fields[dependency].type.name !== "nat") fail();
		return true;
	};
	const visit = (value, transport, level, seen) => {
		if(++nodes > 4096 || level > 32) fail();
		if(value === null) return false;
		if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value ?? {}, "kind") ?? {}, "value")) fail();
		const definition = transport?.kind === "named" ? definitions.get(transport.id) : undefined;
		if(definition?.kind === "alias")
		{
			if(seen.has(transport.id) || (definition.representation !== "copied"
				&& !(ownedStructural && definition.representation === "owned"))) fail();
			return visit(value, definition.target, level + 1, new Set([...seen, transport.id]));
		}
		if(value.kind === "fin")
		{
			closed(value, ["kind", "bound"]);
			if(transport?.kind !== "primitive" || transport.name !== "nat" || typeof value.bound !== "string"
				|| !/^(?:0|[1-9][0-9]*)$(?![\s\S])/.test(value.bound)) fail();
			return true;
		}
		if(value.kind === "subtype")
		{
			closed(value, ["kind", "constructor"]);
			const projected = subtypeResult === true && value.constructor === null;
			if(!projected && (typeof value.constructor !== "string" || !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/.test(value.constructor))) fail();
			if(!subtypeStructural || transport?.kind !== "primitive") fail();
			return true;
		}
		if(value.kind === "checked-record")
		{
			const erased = definition?.source?.extensions?.["lean-lang.org/erased-proofs"];
			const erasedFields = Array.isArray(erased) ? erased : erased?.fields;
			const generic = definition?.source?.extensions?.["lean-lang.org/instantiation"] !== undefined;
			if(!subtypeStructural || transport?.kind !== "named" || definition?.kind !== "record"
				|| definition.representation !== "copied" || !Array.isArray(erasedFields) || !erasedFields.length) fail();
			const rich = Object.hasOwn(value, "fields") || Object.hasOwn(value, "name");
			if(!rich)
			{
				closed(value, ["kind", "constructor"]);
				if(level !== 0 || subtypeResult || typeof value.constructor !== "string"
					|| !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/.test(value.constructor)) fail();
				return true;
			}
			closed(value, ["kind", "name", "constructor", "fields"]);
			if((generic && level !== 0) || value.name !== definition.source?.declaration || !Array.isArray(value.fields)
				|| value.fields.length !== definition.fields.length) fail();
			if(subtypeResult ? value.constructor !== null
				: typeof value.constructor !== "string"
					|| !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/.test(value.constructor)) fail();
			for(const [index, field] of value.fields.entries())
			{
				closed(field, ["name", "refinement"]);
				if(field.name !== definition.fields[index].name) fail();
				if(field.refinement?.kind === "fin-field")
					dependentField(field.refinement, definition.fields[index].type, definition, index);
				else visit(field.refinement, definition.fields[index].type, level + 1, seen);
			}
			return true;
		}
		if(["record", "variant"].includes(value.kind))
		{
			const variant = value.kind === "variant";
			closed(value, ["kind", "name", variant ? "cases" : "fields"]);
			if(!subtypeStructural || !definition || definition.kind !== value.kind
				|| (definition.representation !== "copied" && !(ownedStructural && definition.representation === "owned"))
				|| definition.source?.declaration !== value.name || seen.has(transport.id)
				|| definition.source?.extensions?.["lean-lang.org/erased-proofs"] !== undefined) fail();
			const inner = new Set([...seen, transport.id]);
			const fields = (members, expected) => {
				array(members, expected.length);
				let constrained = false;
				for(const [index, member] of members.entries())
				{
					if(++nodes > 4096) fail();
					closed(member, ["name", "refinement"]);
					if(member.name !== expected[index].name) fail();
					constrained = visit(member.refinement, expected[index].type, level + 1, inner) || constrained;
				}
				return constrained;
			};
			let constrained = false;
			if(!variant) constrained = fields(value.fields, definition.fields);
			else
			{
				array(value.cases, definition.cases.length);
				for(const [index, branch] of value.cases.entries())
				{
					if(++nodes > 4096) fail();
					closed(branch, ["name", "fields"]);
					if(branch.name !== definition.cases[index].name) fail();
					constrained = fields(branch.fields, definition.cases[index].fields) || constrained;
				}
			}
			if(!constrained) fail();
			return true;
		}
		closed(value, ["kind", "arguments"]);
		const count = ["tuple", "result"].includes(value.kind) ? 2 : 1;
		if(!["array", "list", "option", "tuple", "result"].includes(value.kind)
			|| transport?.kind !== "apply" || transport.constructor !== value.kind || !Array.isArray(transport.arguments) || transport.arguments.length !== count) fail();
		array(value.arguments, count);
		let constrained = false;
		for(let index = 0; index < count; index++) constrained = visit(value.arguments[index], transport.arguments[index], level + 1, seen) || constrained;
		if(!constrained) fail();
		return true;
	};
	visit(refinement, type, depth, new Set());
};

/**
 * Authenticate one declaration's complete per-use refinement decision.
 * Ownership-aware callers must opt in explicitly; ordinary copied contracts
 * therefore retain their previous closed surface.
 *
 * @param declaration - Binding IR declaration with erased transport sites.
 * @param value - Complete parameter/result refinement trees.
 * @param types - Definitions referenced by nominal refinement trees.
 * @param options - Explicit transport capabilities.
 * @param options.ownedStructural - Admit owned nominal roots at this boundary.
 */
export const declarationRefinements = (declaration, value, types = [], { ownedStructural = false } = {}) => {
	const fail = () => { throw new TypeError("Invalid declaration refinement metadata"); };
	const direction = (tree, produced) => {
		if(tree === null || ["fin", "fin-field"].includes(tree.kind)) return;
		if(["subtype", "checked-record"].includes(tree.kind))
		{
			if(produced ? tree.constructor !== null : typeof tree.constructor !== "string") fail();
			if(tree.kind === "checked-record") tree.fields?.forEach(field => direction(field.refinement, produced));
			return;
		}
		if(tree.kind === "record") return tree.fields.forEach(field => direction(field.refinement, produced));
		if(tree.kind === "variant") return tree.cases.forEach(branch => branch.fields.forEach(field => direction(field.refinement, produced)));
		if(["array", "list", "option", "tuple", "result"].includes(tree.kind))
			return tree.arguments.forEach(child => direction(child, produced));
		fail();
	};
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).length !== 2 || !Object.hasOwn(value, "parameters") || !Object.hasOwn(value, "result")
		|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length) fail();
	for(const [index, refinement] of value.parameters.entries())
	{
		assertRefinement(refinement, declaration.parameters[index].type, 0, true, types, false, ownedStructural);
		direction(refinement, false);
	}
	assertRefinement(value.result, declaration.result.type, 0, true, types, true, ownedStructural);
	direction(value.result, true);
	if(value.result === null && value.parameters.every(refinement => refinement === null)) fail();
	return structuredClone(value);
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
	const check = (values, fields, dependent = false) => {
		if(!Array.isArray(values) || values.length !== fields.length) fail();
		for(const [index, refinement] of values.entries())
		{
			if(refinement?.kind !== "fin-field") assertRefinement(refinement, fields[index].type, 1);
			else
			{
				if(!dependent || !refinement || Object.keys(refinement).sort().join(",") !== "field,kind"
					|| typeof refinement.field !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(refinement.field)
					|| fields[index].type?.kind !== "primitive" || fields[index].type.name !== "nat") fail();
				const dependency = fields.findIndex((candidate, position) => position < index && candidate.name === refinement.field);
				if(dependency < 0 || fields[dependency].type?.kind !== "primitive" || fields[dependency].type.name !== "nat") fail();
			}
		}
	};
	if(field === "target") assertRefinement(value.target, definition.target, 1);
	else if(field === "fields") check(value.fields, definition.fields,
		definition.source?.extensions?.["lean-lang.org/erased-proofs"] !== undefined
			|| Array.isArray(definition.erased) && definition.erased.length > 0);
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
 * Require one callback site to agree with the direction in which its value crosses.
 * A produced Subtype is already proved by Lean and therefore carries no constructor;
 * a consumed Subtype must name the exact checked constructor. A checked record follows
 * the same rule: a Lean-produced record projects its payload with no constructor, a
 * host-produced record names the exact record constructor, and every payload field
 * keeps its own directional leaf below the record. Owned records and callbacks nested
 * inside callbacks stay outside this surface.
 *
 * @param refinement - A validated callback refinement tree.
 * @param produced - Whether Lean, rather than the host, produces this site.
 * @returns {boolean} Whether the tree contains a Subtype or checked-record leaf.
 */
export const assertCallbackRefinementDirection = (refinement, produced) => {
	if(refinement === null || ["fin", "fin-field"].includes(refinement.kind)) return false;
	if(refinement.kind === "subtype")
	{
		if(produced ? refinement.constructor !== null : typeof refinement.constructor !== "string")
			throw new TypeError("Callback refinement direction does not match its checked Subtype constructor");
		return true;
	}
	if(refinement.kind === "checked-record")
	{
		if(produced ? refinement.constructor !== null : typeof refinement.constructor !== "string")
			throw new TypeError("Callback refinement direction does not match its checked record constructor");
		for(const field of refinement.fields ?? [])
			assertCallbackRefinementDirection(field.refinement, produced);
		return true;
	}
	if(refinement.kind === "record")
		return refinement.fields.reduce((found, field) => assertCallbackRefinementDirection(field.refinement, produced) || found, false);
	if(refinement.kind === "variant")
		return refinement.cases.reduce((found, branch) => branch.fields.reduce((nested, field) =>
			assertCallbackRefinementDirection(field.refinement, produced) || nested, found), false);
	if(["array", "list", "option", "tuple", "result"].includes(refinement.kind))
		return refinement.arguments.reduce((found, child) => assertCallbackRefinementDirection(child, produced) || found, false);
	throw new TypeError("Invalid callback refinement metadata");
};

/**
 * Validate callback constraints against an erased callable signature. Copied
 * nominal trees require the enclosing document's type definitions. Host callbacks
 * receive Lean-produced parameters and return host-produced results; returned Lean
 * closures have the opposite direction.
 *
 * @param signature - Erased parameter and result type references.
 * @param value - Optional compiler-owned parameter/result refinement trees.
 * @param types - Definitions used to authenticate copied nominal trees.
 * @param direction - Known callback role, or undefined to infer and authenticate it.
 */
export const callbackRefinement = (signature, value, types = [], direction = undefined) => {
	if(value === undefined) return null;
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| Object.keys(value).length !== 2 || !Object.hasOwn(value, "parameters") || !Object.hasOwn(value, "result")
		|| !Array.isArray(value.parameters) || value.parameters.length !== signature.parameters.length)
		throw new TypeError("Invalid callback refinement metadata");
	if(direction !== undefined && !["host", "closure"].includes(direction))
		throw new TypeError("Invalid callback refinement direction");
	const structural = true;
	const definitions = types.map(definition => definition.source ? definition : {
		...definition
		, representation: "copied"
		, source: { declaration: definition.id?.startsWith("lean:") ? definition.id.slice(5) : null, extensions: {} }
	});
	if(![...value.parameters, value.result].some(refinement => refinement !== null)) throw new TypeError("Empty callback refinement metadata");
	const containsSubtype = [...value.parameters, value.result].some(refinement => {
		const visit = child => child !== null && (["subtype", "checked-record"].includes(child.kind)
			|| (child.kind === "record" && child.fields.some(field => visit(field.refinement)))
			|| (child.kind === "variant" && child.cases.some(branch => branch.fields.some(field => visit(field.refinement))))
			|| (["array", "list", "option", "tuple", "result"].includes(child.kind) && child.arguments.some(visit)));
		return visit(refinement);
	});
	const validate = role => {
		const producedParameters = role === "host", producedResult = role === "closure";
		for(const [index, refinement] of value.parameters.entries())
		{
			assertCallbackRefinementDirection(refinement, producedParameters);
			assertRefinement(refinement, signature.parameters[index], 1, structural, definitions, producedParameters);
		}
		assertCallbackRefinementDirection(value.result, producedResult);
		assertRefinement(value.result, signature.result, 1, structural, definitions, producedResult);
	};
	if(direction !== undefined) validate(direction);
	else if(!containsSubtype) validate("host");
	else
	{
		const accepted = [];
		for(const role of ["host", "closure"])
		{
			try
			{ validate(role); accepted.push(role); }
			catch(error)
			{ void error; }
		}
		if(accepted.length !== 1) throw new TypeError("Callback refinement direction is inconsistent");
	}
	return value;
};

/**
 * Recover the unique Subtype or checked-record direction of a callback tree.
 * Fin-only trees carry no directional information and return null after
 * ordinary validation.
 *
 * @param signature - Erased parameter and result type references.
 * @param value - Compiler-owned callback refinement trees.
 * @param types - Definitions used to authenticate copied nominal trees.
 */
export const callbackSubtypeDirection = (signature, value, types = []) => {
	callbackRefinement(signature, value, types);
	if(value === undefined || value === null) return null;
	for(const role of ["host", "closure"])
	{
		try
		{
			callbackRefinement(signature, value, types, role);
			const leaves = [...value.parameters, value.result];
			if(leaves.some(refinement => {
				const visit = child => child !== null && (["subtype", "checked-record"].includes(child.kind)
					|| (child.kind === "record" && child.fields.some(field => visit(field.refinement)))
					|| (child.kind === "variant" && child.cases.some(branch => branch.fields.some(field => visit(field.refinement))))
					|| (["array", "list", "option", "tuple", "result"].includes(child.kind) && child.arguments.some(visit)));
				return visit(refinement);
			})) return role;
		}
		catch(error)
		{ void error; }
	}
	return null;
};

/**
 * Read optional constraints from a public callback definition.
 *
 * @param definition - Public Binding IR callback definition.
 * @param types - Definitions used to authenticate copied nominal trees.
 */
export const callbackDefinitionRefinement = (definition, types = []) => callbackRefinement({
	parameters: definition.callable.parameters.map(parameter => parameter.type)
	, result: definition.callable.result.type
}, definition.source?.extensions?.["lean-lang.org/refinements"], types);
