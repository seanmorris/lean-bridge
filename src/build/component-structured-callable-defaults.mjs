/**
 * Construct finite, typed callback recovery values without assuming Inhabited.
 * Shared named definitions keep the generated source linear in the schema.
 *
 * @file
 */
import { snapshotComponentCopiedGraph } from "../abi/component-recursive.mjs";
import { sha256 } from "../capsule/node.mjs";

const primitive = { unit: "()", bool: "false", char: "(_root_.Char.ofNat 0)"
	, string: '""', bytes: "_root_.ByteArray.empty" };
const namedType = id => `_root_.${id.slice(5)}`;
const name = id => `callbackDefault_${sha256(id).slice(0, 20)}`;

/**
 * Resolve productive nominal definitions by a finite fixed point. A recursive
 * constructor is skipped until a finite branch exists; arrays and None provide
 * finite values without constructing their element types.
 *
 * @param types - Authenticated copied definitions, never callback identities.
 */
export const componentStructuredCallableDefaults = types => {
	const graph = snapshotComponentCopiedGraph({ schemaVersion: 1, root: { kind: "primitive", name: "unit" }, types });
	const known = new Map(), declarations = [], recipes = [];
	const expression = type => {
		if(type.kind === "primitive") return primitive[type.name] ?? "0";
		if(type.kind === "named") return known.get(type.id) ?? null;
		if(type.constructor === "array") return "#[]";
		if(type.constructor === "list") return "[]";
		if(type.constructor === "option") return "_root_.Option.none";
		const left = expression(type.arguments[0]);
		if(type.constructor === "result")
		{
			if(left !== null) return `(_root_.Except.ok (${left}))`;
			const right = expression(type.arguments[1]);
			return right === null ? null : `(_root_.Except.error (${right}))`;
		}
		const right = expression(type.arguments[1]);
		return left === null || right === null ? null : `(${left}, ${right})`;
	};
	const fields = values => {
		const result = values.map(field => expression(field.type));
		return result.includes(null) ? null : result;
	};
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const type of graph.types)
		{
			if(known.has(type.id)) continue;
			let body = null, branch = null;
			if(type.kind === "alias") body = expression(type.target);
			else if(type.kind === "record")
			{
				const values = fields(type.fields);
				if(values) body = `{ ${type.fields.map((field, index) => `«${field.name}» := ${values[index]}`).join(", ")} }`;
			}
			else
				for(const item of type.cases)
				{
					const values = fields(item.fields);
					if(values)
					{
						body = `${namedType(type.id)}.«${item.name}»${values.map(value => ` (${value})`).join("")}`;
						branch = item.name; break;
					}
				}
			if(body === null) continue;
			const symbol = name(type.id);
			declarations.push(`def ${symbol} : ${namedType(type.id)} := ${body}`, "");
			recipes.push(Object.freeze({ id: type.id, symbol, branch, body }));
			known.set(type.id, symbol); changed = true;
		}
	}
	return Object.freeze({
		declarations: Object.freeze(declarations), recipes: Object.freeze(recipes)
		, expression: type => {
			const root = snapshotComponentCopiedGraph({ schemaVersion: 1, root: type, types: graph.types }).root;
			const value = expression(root);
			if(value === null) throw new TypeError("Callback result has no finite recovery value");
			return value;
		}
	});
};
