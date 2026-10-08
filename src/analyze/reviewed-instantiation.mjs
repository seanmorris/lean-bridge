/**
 * Validate an authored generic record instantiation before comparing it with compiler facts.
 * The instantiation is a compiler fact: a review may restate it, fresh Lean must agree,
 * and nothing here selects what Lean compiles.
 *
 * @file
 */
import { componentScalarTypes } from "../abi/component-scalars.mjs";

export const instantiationKey = "lean-lang.org/instantiation";
const refinementKeys = ["lean-lang.org/nominal-refinements", "lean-lang.org/refinements"];
const arities = { array: 1, list: 1, option: 1, result: 2, tuple: 2 };
const leanName = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(value);
const keys = (value, expected) => value !== null && typeof value === "object" && !Array.isArray(value)
	&& Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
/**
 * Admit the closed origin of one alias-named record. Arguments match the native provenance rules:
 * 1 to 16 closed copied types, with no callback, resource or Fin bound anywhere they reach.
 * The record's own fields stay unrefined, as native metadata keeps them non-structural.
 *
 * @param definition - Reviewed record carrying the extension.
 * @param value - Its lean-lang.org/instantiation extension.
 * @param types - Every reviewed type definition, by id.
 * @throws {TypeError} With the refused `path`: inside the extension, or at a field type.
 */
export const assertReviewedInstantiation = (definition, value, types) => {
	const base = `${definition.id}.source.extensions.${instantiationKey}`;
	const refuse = (path, reason) => { throw Object.assign(new TypeError(reason), { path }); };
	if(definition.kind !== "record") refuse(base, "only records carry an instantiation");
	if(!keys(value, ["structure", "arguments"])) refuse(base, "an instantiation has exactly structure and arguments");
	if(!leanName(value.structure) || value.structure === definition.source.declaration) refuse(`${base}.structure`, "the structure is a Lean name other than the record's alias");
	if(!Array.isArray(value.arguments) || !value.arguments.length || value.arguments.length > 16) refuse(`${base}.arguments`, "an instantiation has 1 to 16 arguments");
	if(refinementKeys.some(key => Object.hasOwn(definition.source.extensions, key))) refuse(base, "an instantiated generic record has no refined fields");
	// Each named definition is explored once and keeps its height, so a later, deeper reference
	// is still bounded; one still on the current path is a cycle. The record itself is on the path.
	const active = new Set([definition.id]), heights = new Map();
	// Returns the height below `type`; inside a named definition, refusals name the reference that entered it.
	const reach = (type, path, depth, bound, inside = false) => {
		if(depth > 32) refuse(path, "type nesting exceeds 32");
		if(type?.kind === "primitive" && keys(type, ["kind", "name"]) && componentScalarTypes.includes(type.name)) return 0;
		const applied = type?.kind === "apply" && keys(type, ["kind", "constructor", "arguments"]) && Object.hasOwn(arities, type.constructor)
			&& Array.isArray(type.arguments) && type.arguments.length === arities[type.constructor];
		if(applied) return 1 + Math.max(...type.arguments.map((argument, index) => reach(argument, inside ? path : `${path}.arguments[${index}]`, depth + 1, bound, inside)));
		if(type?.kind !== "named" || !keys(type, ["kind", "id"])) refuse(path, "arguments are primitives, closed applications or named definitions");
		const target = types.get(type.id);
		if(!target || !["alias", "record", "variant"].includes(target.kind)) refuse(path, "a named argument refers to a reviewed alias, record or variant");
		if(active.has(target.id)) refuse(path, "named definitions cannot form a cycle");
		if(!heights.has(target.id))
		{
			if(refinementKeys.some(key => Object.hasOwn(target.source.extensions, key))) refuse(path, bound);
			active.add(target.id);
			// A named record's own instantiation arguments are reached like its fields.
			const origin = target.kind === "record" ? target.source.extensions[instantiationKey]?.arguments : undefined;
			const own = target.kind === "alias" ? [target.target] : target.kind === "record" ? target.fields.map(field => field.type)
				: target.cases.flatMap(item => item.fields.map(field => field.type));
			const children = [...own, ...Array.isArray(origin) ? origin : []];
			heights.set(target.id, children.length ? 1 + Math.max(...children.map(child => reach(child, path, depth + 1, bound, true))) : 0);
			active.delete(target.id);
		}
		if(depth + heights.get(target.id) > 32) refuse(path, "type nesting exceeds 32");
		return heights.get(target.id);
	};
	value.arguments.forEach((argument, index) => reach(argument, `${base}.arguments[${index}]`, 0, "an instantiation argument cannot reach a Fin bound"));
	// Field types were checked as reviewed types; a bound hidden behind a named field remains.
	for(const field of definition.fields) reach(field.type, `${definition.id}.${field.name}.type`, 0, "an instantiated generic record has no refined fields");
};
