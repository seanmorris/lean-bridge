/**
 * Generate finite, iterative validators for copied host values.
 *
 * @file
 */
import { componentScalarTypes } from "../../abi/component-scalars.mjs";
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { nominalRefinementEntries, callbackDefinitionRefinement } from "../../abi/refinements.mjs";

/**
 * Emit named validators sharing an explicit traversal stack and cycle checks.
 *
 * @param ir - Validated public Binding IR.
 * @param typeMap - Nominal definitions indexed by identity.
 * @param validatorName - Renderer shared with the public call wrappers.
 */
export const emitCopiedValidators = (ir, typeMap, validatorName) => {
	const table = new Map();
	const constraints = new Map(nominalRefinementEntries(ir.types).map(entry => [entry.id, entry.refinement]));
	const refined = new Map();
	const reference = (type, refinement = null) => {
		if(type.kind === "parameter") return null;
		const name = validatorName(type, typeMap);
		if(type.kind === "apply" && !table.has(name))
			table.set(name, { kind: type.constructor, arguments: type.arguments.map(type => reference(type)) });
		if(refinement)
		{
			const key = JSON.stringify([name, refinement]);
			if(!refined.has(key))
			{
				const constrained = `$nominalFin${refined.size}`;
				refined.set(key, constrained);
				table.set(constrained, { kind: "alias", target: name, refinement });
			}
			return refined.get(key);
		}
		return name;
	};
	const fields = (values, refinements = []) => values.map((field, index) => [field.name, reference(field.type, refinements[index])]);
	for(const type of ir.types)
	{
		const name = `assert${type.name}`;
		const refinement = constraints.get(type.id);
		if(type.kind === "record") table.set(name, { kind: "record", fields: fields(type.fields, refinement?.fields) });
		if(type.kind === "variant") table.set(name, { kind: "variant", cases: Object.fromEntries(type.cases.map((item, index) => [item.name, fields(item.fields, refinement?.cases[index])])) });
		if(type.kind === "alias")
		{
			let target = type.target;
			const seen = new Set([type.id]);
			while(target.kind === "named" && typeMap.get(target.id)?.kind === "alias")
			{
				if(seen.has(target.id)) throw new TypeError("Cyclic copied alias");
				seen.add(target.id); target = typeMap.get(target.id).target;
			}
			table.set(name, { kind: "alias", target: reference(constraints.size ? type.target : target, refinement?.target) });
		}
	}
	for(const declaration of ir.declarations)
	{
		declaration.parameters.forEach(parameter => reference(parameter.type));
		reference(declaration.result.type);
	}
	const scalars = componentScalarTypes.map(name => validatorName({ kind: "primitive", name }, typeMap));
	const wrappers = ir.types.filter(type => type.kind === "callback" && (constraints.size || callbackDefinitionRefinement(type))).map(type => {
		const refinement = callbackDefinitionRefinement(type), call = type.callable;
		const checks = call.parameters.flatMap((parameter, index) => [
			`    ${reference(parameter.type)}(args[${index}], path + ".arg${index}");`
			, ...refinement?.parameters[index] ? [`    assertNestedFin(args[${index}], ${JSON.stringify(refinement.parameters[index])}, path + ".arg${index}");`] : []
		]);
		return [`export const wrap${type.name} = (value, path) => new Proxy(value, {`
			, "  apply(target, receiver, args) {"
			, `    if (args.length !== ${call.parameters.length}) throw new TypeError(path + " expects ${call.parameters.length} arguments");`
			, ...checks, "    const result = Reflect.apply(target, receiver, args);"
			, `    ${reference(call.result.type)}(result, path + ".result");`
			, ...refinement?.result ? [`    assertNestedFin(result, ${JSON.stringify(refinement.result)}, path + ".result");`] : []
			, "    return result;", "  }", "});"].join("\n");
	});
	const check = constraints.size ? "for (const refinement of frame.checks ?? []) assertNestedFin(frame.value, refinement, frame.path); " : "";
	return `const copiedTypes = ${JSON.stringify(Object.fromEntries(table))};
const scalarValidators = { ${scalars.join(", ")} };
const ownData = (value, key, path, expected = "own data fields") => {
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (!field || !Object.hasOwn(field, "value")) invalid(path, expected);
  return field.value;
};
const exactFields = (value, expected, path) => {
  const own = Reflect.ownKeys(value);
  if (own.length !== expected.length || own.some(key => !expected.includes(key)))
    throw new TypeError(path + " does not match the declared copied fields");
};
const copiedValue = (root, input, path) => {
  const active = new Set(), stack = [{ type: root, value: input, path, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const frame = stack.at(-1);
    if (frame.children) {
      if (frame.index === frame.count) { ${check}active.delete(frame.value); stack.pop(); continue; }
      const index = frame.index++, field = frame.sequence ? [index, frame.element ?? frame.children[index]] : frame.children[index];
      stack.push({ type: field[1], value: ownData(frame.value, field[0], frame.path, frame.sequence ? "dense data array" : "own data fields"), path: frame.path + "." + field[0], depth: frame.depth + 1 });
      continue;
    }
    if (frame.depth > ${componentRecursiveLimits.valueDepth}) throw new RangeError("Component recursive value depth exceeded");
    if (++nodes > ${componentRecursiveLimits.valueNodes}) throw new RangeError("Component recursive value node budget exceeded");
    let type = copiedTypes[frame.type];
    while (type?.kind === "alias") { ${constraints.size ? "if (type.refinement) (frame.checks ??= []).push(type.refinement); " : ""}frame.type = type.target; type = copiedTypes[frame.type]; }
    if (Object.hasOwn(scalarValidators, frame.type)) { scalarValidators[frame.type](frame.value, frame.path); ${check}stack.pop(); continue; }
    if (!type) invalid(frame.path, "a declared copied type");
    const value = frame.value, sequence = ["array", "list", "tuple"].includes(type.kind);
    if (!value || typeof value !== "object") invalid(frame.path, "plain " + type.kind);
    if (active.has(value)) throw new TypeError("Cyclic copied value");
    let children, element, count;
    if (sequence) {
      if (!Array.isArray(value) && !(type.kind === "array" && value instanceof Uint32Array)) invalid(frame.path, "array");
      count = value.length; children = type.arguments;
      if (count > ${componentRecursiveLimits.valueNodes} - nodes) throw new RangeError("Component recursive value node budget exceeded (bounded array)");
      if (type.kind === "tuple" && count !== children.length) invalid(frame.path, "exact data tuple");
      if (type.kind !== "tuple") element = children[0];
      if (Array.isArray(value) && Reflect.ownKeys(value).length !== count + 1) invalid(frame.path, "dense data array");
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(frame.path, "plain " + type.kind);
      let extra = [];
      if (type.kind === "record") children = type.fields;
      else if (type.kind === "variant") {
        const kind = ownData(value, "kind", frame.path);
        if (typeof kind !== "string" || !Object.hasOwn(type.cases, kind)) invalid(frame.path, "declared variant constructor");
        children = type.cases[kind]; extra = ["kind"];
      } else if (type.kind === "option") {
        const tag = ownData(value, "tag", frame.path);
        if (tag !== "none" && tag !== "some") invalid(frame.path, "Option tag");
        children = tag === "none" ? [] : [["value", type.arguments[0]]]; extra = ["tag"];
      } else {
        const error = Object.hasOwn(value, "error");
        children = [[error ? "error" : "ok", type.arguments[error ? 1 : 0]]];
      }
      exactFields(value, [...extra, ...children.map(field => field[0])], frame.path);
      count = children.length;
    }
    if (count > ${componentRecursiveLimits.valueNodes} - nodes) throw new RangeError("Component recursive value node budget exceeded");
    Object.assign(frame, { children, sequence, element, count, index: 0 }); active.add(value);
  }
  return input;
};
${[...table.keys()].map(name => `export const ${name} = (value, path) => copiedValue(${JSON.stringify(name)}, value, path);`).join("\n")}
${ir.types.filter(type => type.kind === "callback").map(type => `export const assert${type.name} = (value, path) => { if (typeof value !== "function") invalid(path, "function"); return value; };`).join("\n")}
${wrappers.length ? wrappers.join("\n") + "\n" : ""}\
`;
};
