/**
 * Render compiler-authenticated Lean defaults as ordinary JavaScript values.
 * Omission detection remains the call wrapper's responsibility so explicit
 * `undefined` is never silently confused with an omitted argument.
 *
 * @file
 */

const BIGINT = new Set(["uint64", "int64", "nat", "int"]);

const resolve = (type, typeMap, seen = new Set()) => {
	if(type.kind !== "named") return type;
	if(seen.has(type.id)) throw new TypeError(`Cyclic default type alias: ${type.id}`);
	const definition = typeMap.get(type.id);
	if(definition?.kind !== "alias") throw new TypeError(`Default type is not an alias: ${type.id}`);
	return resolve(definition.target, typeMap, new Set([...seen, type.id]));
};

/**
 * Render one canonical Binding IR default as a side-effect-free expression.
 *
 * @param value - Canonical default value authenticated from Lean metadata.
 * @param type - Binding IR type of the parameter.
 * @param typeMap - Binding IR named definitions indexed by identity.
 * @returns {string} JavaScript source for the corresponding host value.
 */
export const renderJavaScriptDefault = (value, type, typeMap) => {
	const resolved = resolve(type, typeMap);
	if(value.kind === "unit") return "undefined";
	if(value.kind === "boolean") return String(value.value);
	if(value.kind === "integer")
		return resolved.kind === "primitive" && BIGINT.has(resolved.name)
			? `${value.value}n` : value.value;
	if(value.kind === "string" || value.kind === "char") return JSON.stringify(value.value);
	if(value.kind === "option-none") return 'Object.freeze({ tag: "none" })';
	if(value.kind === "option-some")
	{
		if(resolved.kind !== "apply" || resolved.constructor !== "option")
			throw new TypeError("Option.some default has no Option type");
		const child = renderJavaScriptDefault(value.value, resolved.arguments[0], typeMap);
		return `Object.freeze({ tag: "some", value: ${child} })`;
	}
	throw new TypeError(`Unsupported JavaScript default kind: ${value.kind}`);
};

/**
 * Emit omission guards before any parameter validation.
 *
 * @param output - Generated source lines.
 * @param parameters - Ordered Binding IR parameters.
 * @param typeMap - Binding IR named definitions indexed by identity.
 * @param indent - Wrapper-body indentation.
 */
export const emitJavaScriptDefaults = (output, parameters, typeMap, indent) => {
	parameters.forEach((parameter, index) => {
		if(!parameter.optional) return;
		const value = renderJavaScriptDefault(parameter.default, parameter.type, typeMap);
		output.push(`${indent}if (arguments.length <= ${index}) ${parameter.name} = ${value};`);
	});
};
