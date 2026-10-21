/**
 * Author-selected constructors follow transport order, independently of Fin bounds.
 *
 * @file
 */
const arities = Object.freeze({ array: 1, list: 1, option: 1, tuple: 2, result: 2 });
const leanName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/;
const memberName = /^[A-Za-z][A-Za-z0-9_]*$(?![\s\S])/;
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
 * @param selection - A scalar constructor, structural arguments or named nominal fields/cases.
 */
export const validateCheckedRefinementSelection = selection => {
	let nodes = 0;
	const visit = (value, depth) => {
		if(++nodes > 4096 || depth > 32) fail();
		if(value === null) return false;
		if(Object.hasOwn(value ?? {}, "constructor"))
		{
			if(value.kind === "checked-record")
			{
				closed(value, ["kind", "name", "constructor", "fields"]);
				if(typeof value.name !== "string" || !leanName.test(value.name)
					|| typeof value.constructor !== "string" || !leanName.test(value.constructor)
					|| !Array.isArray(value.fields) || value.fields.length > 1024) fail();
				const names = new Set();
				for(const field of value.fields)
				{
					closed(field, ["name", "refinement"]);
					if(typeof field.name !== "string" || !memberName.test(field.name) || names.has(field.name)) fail();
					names.add(field.name); visit(field.refinement, depth + 1);
				}
				return true;
			}
			closed(value, ["constructor"]);
			if(typeof value.constructor !== "string" || !leanName.test(value.constructor)) fail();
			return true;
		}
		if(["record", "variant"].includes(Object.getOwnPropertyDescriptor(value ?? {}, "kind")?.value))
		{
			const variant = value.kind === "variant";
			closed(value, ["kind", "name", variant ? "cases" : "fields"]);
			if(typeof value.name !== "string" || !leanName.test(value.name)) fail();
			const members = (values, keys, inspect, empty) => {
				if(!Array.isArray(values) || values.length > 1024 || (!empty && values.length === 0)) fail();
				const names = new Set();
				let selected = false;
				for(let index = 0; index < values.length; index++)
				{
					if(++nodes > 4096 || !Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail();
					const member = values[index];
					closed(member, ["name", ...keys]);
					if(typeof member.name !== "string" || !memberName.test(member.name) || names.has(member.name)) fail();
					names.add(member.name);
					selected = inspect(member) || selected;
				}
				return selected;
			};
			const fields = values => members(values, ["refinement"], field => visit(field.refinement, depth + 1), true);
			const selected = variant ? members(value.cases, ["fields"], branch => fields(branch.fields), false) : fields(value.fields);
			if(!selected) fail();
			return true;
		}
		closed(value, ["kind", "arguments"]);
		if(typeof value.kind !== "string" || !Object.hasOwn(arities, value.kind) || !Array.isArray(value.arguments)
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
		if(value?.kind === "checked-record" && Object.hasOwn(value, "fields"))
		{
			closed(value, ["kind", "name", "constructor", "fields"]);
			if(typeof value.name !== "string" || !leanName.test(value.name) || !Array.isArray(value.fields)
				|| value.constructor !== null && (typeof value.constructor !== "string" || !leanName.test(value.constructor))) fail();
			if(value.constructor === null) return null;
			const fields = value.fields.map(field => {
				closed(field, ["name", "refinement"]);
				if(typeof field.name !== "string" || !memberName.test(field.name)) fail();
				return { name: field.name, refinement: visit(field.refinement, depth + 1) };
			});
			return validateCheckedRefinementSelection({
				kind: "checked-record", name: value.name
				, constructor: value.constructor, fields
			});
		}
		if(["subtype", "checked-record"].includes(value?.kind))
		{
			closed(value, ["kind", "constructor"]);
			if(value.kind === "checked-record" && depth !== 0) fail();
			if(value.kind === "subtype" && value.constructor === null) return null;
			return validateCheckedRefinementSelection({ constructor: value.constructor });
		}
		if(["record", "variant"].includes(Object.getOwnPropertyDescriptor(value ?? {}, "kind")?.value))
		{
			const variant = value.kind === "variant";
			closed(value, ["kind", "name", variant ? "cases" : "fields"]);
			if(typeof value.name !== "string" || !leanName.test(value.name)) fail();
			let selected = false;
			const members = (values, keys, project, empty) => {
				if(!Array.isArray(values) || values.length > 1024 || (!empty && values.length === 0)) fail();
				const names = new Set(), result = [];
				for(let index = 0; index < values.length; index++)
				{
					if(++nodes > 4096 || !Object.hasOwn(Object.getOwnPropertyDescriptor(values, index) ?? {}, "value")) fail();
					const member = values[index];
					closed(member, ["name", ...keys]);
					if(typeof member.name !== "string" || !memberName.test(member.name) || names.has(member.name)) fail();
					names.add(member.name);
					result.push(project(member));
				}
				return result;
			};
			const fields = values => members(values, ["refinement"], field => {
				const refinement = visit(field.refinement, depth + 1);
				selected ||= refinement !== null;
				return { name: field.name, refinement };
			}, true);
			const result = variant ? { kind: value.kind, name: value.name, cases: members(value.cases, ["fields"], branch => ({ name: branch.name, fields: fields(branch.fields) }), false) }
				: { kind: value.kind, name: value.name, fields: fields(value.fields) };
			return selected ? result : null;
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

/**
 * Recover only constructor choices from a separately validated compiler projection.
 * Bounds and source types remain compiler facts, outside the author selection.
 *
 * @param type - Fresh compiler metadata type, before transport erasure.
 */
export const projectionCheckedSelection = type => {
	let nodes = 0;
	const resolveCheckedRecord = (value, definitions) => {
		const names = new Set();
		for(let depth = 0; depth <= 1024; depth++)
		{
			if(++nodes > 4096) fail();
			if(value?.kind === "reference")
			{
				if(typeof value.name !== "string" || names.has(value.name) || !definitions.has(value.name)) fail();
				names.add(value.name); value = definitions.get(value.name); continue;
			}
			if(value?.kind === "alias")
			{
				if(typeof value.name !== "string") fail();
				names.add(value.name); value = value.target; continue;
			}
			return { definition: value, names };
		}
		fail();
	};
	const visit = (value, depth, definitions = new Map(), seen = new Set()) => {
		if(++nodes > 4096 || depth > 32) fail();
		if(["graph", "owned-graph"].includes(value.kind))
		{
			if(!Array.isArray(value.types) || !value.types.length || value.types.length > 1024) fail();
			const table = new Map();
			for(const definition of value.types)
			{
				if(typeof definition?.name !== "string" || table.has(definition.name)) fail();
				table.set(definition.name, definition);
			}
			return visit(value.root, depth, table, new Set());
		}
		if(value.kind === "reference")
		{
			if(typeof value.name !== "string" || !definitions.has(value.name)) fail();
			if(seen.has(value.name)) return null;
			return visit(definitions.get(value.name), depth, definitions, new Set([...seen, value.name]));
		}
		if(value.kind === "alias") return visit(value.target, depth, definitions, seen);
		if(value.kind === "refinement")
		{
			if(!["subtype", "checked-record"].includes(value.predicate.kind) || value.predicate.constructor === null) return null;
			if(value.predicate.kind !== "checked-record") return { constructor: value.predicate.constructor };
			const reference = value.base?.kind === "reference" ? value.base.name : null;
			const resolved = resolveCheckedRecord(value.base, definitions), base = resolved.definition;
			if(base?.kind !== "record" || !Object.hasOwn(base, "erased")) fail();
			const inner = new Set([...seen, ...resolved.names, base.name]);
			let selected = false;
			const fields = base.fields.map(field => {
				const refinement = visit(field.type, depth + 1, definitions, inner);
				selected ||= refinement !== null;
				return { name: field.name, refinement };
			});
			if(depth > 0 || reference !== null || selected)
			{
				return {
					kind: "checked-record", name: base.name
					, constructor: value.predicate.constructor, fields
				};
			}
			return { constructor: value.predicate.constructor };
		}
		if(["record", "variant"].includes(value.kind))
		{
			let selected = false;
			const fields = values => values.map(field => {
				const refinement = visit(field.type, depth + 1, definitions, seen);
				selected ||= refinement !== null;
				return { name: field.name, refinement };
			});
			const result = value.kind === "record" ? { kind: value.kind, name: value.name, fields: fields(value.fields) }
				: { kind: value.kind, name: value.name, cases: value.cases.map(branch => ({ name: branch.name, fields: fields(branch.fields) })) };
			return selected ? result : null;
		}
		if(!Object.hasOwn(arities, value.kind)) return null;
		const arguments_ = ["array", "list", "option"].includes(value.kind) ? [value.element] : value.arguments;
		const children = arguments_.map(child => visit(child, depth + 1, definitions, seen));
		return children.every(child => child === null) ? null : { kind: value.kind, arguments: children };
	};
	return visit(type, 0);
};
