/**
 * Generate finite, iterative validators for copied host values.
 *
 * @file
 */
import { componentScalarTypes } from "../../abi/component-scalars.mjs";
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";

/**
 * Emit named validators sharing an explicit traversal stack and cycle checks.
 *
 * @param ir - Validated public Binding IR.
 * @param typeMap - Nominal definitions indexed by identity.
 * @param validatorName - Renderer shared with the public call wrappers.
 */
export const emitCopiedValidators = (ir, typeMap, validatorName) => {
	const table = new Map();
	const reference = type => {
		if(type.kind === "parameter") return null;
		const name = validatorName(type, typeMap);
		if(type.kind === "apply" && !table.has(name))
			table.set(name, { kind: type.constructor, arguments: type.arguments.map(reference) });
		return name;
	};
	const fields = values => values.map(field => [field.name, reference(field.type)]);
	for(const type of ir.types)
	{
		const name = `assert${type.name}`;
		if(type.kind === "record") table.set(name, { kind: "record", fields: fields(type.fields) });
		if(type.kind === "variant") table.set(name, { kind: "variant", cases: Object.fromEntries(type.cases.map(item => [item.name, fields(item.fields)])) });
		if(type.kind === "alias")
		{
			let target = type.target;
			const seen = new Set([type.id]);
			while(target.kind === "named" && typeMap.get(target.id)?.kind === "alias")
			{
				if(seen.has(target.id)) throw new TypeError("Cyclic copied alias");
				seen.add(target.id); target = typeMap.get(target.id).target;
			}
			table.set(name, { kind: "alias", target: reference(target) });
		}
	}
	for(const declaration of ir.declarations)
	{
		declaration.parameters.forEach(parameter => reference(parameter.type));
		reference(declaration.result.type);
	}
	const scalars = componentScalarTypes.map(name => validatorName({ kind: "primitive", name }, typeMap));
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
      if (frame.index === frame.count) { active.delete(frame.value); stack.pop(); continue; }
      const index = frame.index++, field = frame.sequence ? [index, frame.element ?? frame.children[index]] : frame.children[index];
      stack.push({ type: field[1], value: ownData(frame.value, field[0], frame.path, frame.sequence ? "dense data array" : "own data fields"), path: frame.path + "." + field[0], depth: frame.depth + 1 });
      continue;
    }
    if (frame.depth > ${componentRecursiveLimits.valueDepth}) throw new RangeError("Component recursive value depth exceeded");
    if (++nodes > ${componentRecursiveLimits.valueNodes}) throw new RangeError("Component recursive value node budget exceeded");
    let type = copiedTypes[frame.type];
    while (type?.kind === "alias") { frame.type = type.target; type = copiedTypes[frame.type]; }
    if (Object.hasOwn(scalarValidators, frame.type)) { scalarValidators[frame.type](frame.value, frame.path); stack.pop(); continue; }
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
`;
};
