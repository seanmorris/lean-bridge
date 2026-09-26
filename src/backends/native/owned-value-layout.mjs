/**
 * Private native layouts that distinguish retained handles from copied payloads.
 * These are adapter inputs, not the downstream C package's public value API.
 *
 * @file
 */
import { compileOwnedAggregateModel } from "../../abi/owned-aggregate-model.mjs";
import { sha256 } from "../../capsule/node.mjs";

const scalars = { unit: "uint8_t", bool: "uint8_t", char: "uint32_t"
	, uint8: "uint8_t", uint16: "uint16_t", uint32: "uint32_t", uint64: "uint64_t"
	, int8: "int8_t", int16: "int16_t", int32: "int32_t", int64: "int64_t"
	, usize: "uint64_t", isize: "int64_t", float32: "float", float64: "double" };
const fail = message => { throw new TypeError(`Owned native values: ${message}`); };

/**
 * Keep the authenticated ownership model intact while selecting bounded storage.
 * Non-leaf fields use indirection, so recursive and shared nominal types cannot
 * expand a C struct exponentially. Transparent aliases do not consume value depth.
 *
 * @param ir - Explicit version-4 ownership contract.
 */
export const compileOwnedNativeValueLayout = ir => {
	const model = compileOwnedAggregateModel(ir);
	const prefix = `lbov_${model.bindingIrSha256.slice(0, 20)}`;
	const original = new Map(model.types.map(type => [type.id, type]));
	const resolved = new Map();
	const resolve = id => {
		const path = []; let current = id;
		while(original.get(current).kind === "alias" && !resolved.has(current))
		{
			if(path.includes(current)) fail("cyclic alias");
			path.push(current); current = original.get(current).target;
		}
		current = resolved.get(current) ?? current;
		for(const item of path) resolved.set(item, current);
		return current;
	};
	const nodes = model.types.filter(type => type.kind !== "alias").map((type, index) => ({
		...type, index
		, cName: scalars[type.name] && type.kind === "primitive" ? scalars[type.name]
			: `${prefix}_t${sha256(type.id).slice(0, 20)}`
		, walker: `${prefix}_v${sha256(type.id).slice(0, 20)}`
		, leaf: ["primitive", "resource", "callback"].includes(type.kind)
		, fields: [], cases: [], element: null
	}));
	const table = new Map(nodes.map(node => [node.id, node]));
	const fields = values => values.map((field, index) => ({
		sourceName: field.name, name: `f${index}`, type: resolve(field.type)
		, pointer: !table.get(resolve(field.type)).leaf
	}));
	for(const node of nodes)
	{
		const type = original.get(node.id);
		if(node.kind === "record") node.fields = fields(type.fields);
		else if(node.kind === "variant") node.cases = type.cases.map((branch, index) => ({
			sourceName: branch.name, name: `c${index}`, fields: fields(branch.fields)
		}));
		else if(["array", "list"].includes(node.kind)) node.element = resolve(type.arguments[0]);
		else if(["tuple", "option", "result"].includes(node.kind))
			node.fields = fields(type.arguments.map((child, index) => ({ name: String(index), type: child })));
		else if(node.kind === "resource") node.identityKind = type.resource.kindId;
		else if(node.kind === "callback") node.identityKind = `callable:${model.component.id}:${type.id}`;
	}
	const site = (value, result = false) => {
		const copied = value.representation === "copied";
		if(value.optional || value.default != null || value.ownership !== (copied ? "copy" : result ? "lease" : "borrow")
			|| (copied ? value.lifetime !== null : value.lifetime?.scope !== (result ? "explicit" : "call") || value.lifetime?.anchor !== null))
			fail("this transport requires copied values, call-scoped input borrows and explicit output leases");
		return resolve(value.type);
	};
	const functions = model.declarations.map(declaration => {
		if(declaration.kind !== "function" || declaration.receiver || declaration.resultMode !== "value")
			fail("only synchronous function exports are supported");
		return { id: declaration.id, name: declaration.name
			, symbol: `${prefix}_f${sha256(declaration.id).slice(0, 20)}`
			, parameters: declaration.parameters.map(value => site(value))
			, result: site(declaration.result, true) };
	});
	const callbacks = nodes.filter(node => node.kind === "callback").map(node => ({
		id: node.id
		, symbol: `${node.walker}_apply`
		, parameters: [node.id, ...node.callable.parameters.map(value => site(value))]
		, result: site(node.callable.result, true)
	}));
	const aliases = model.types.filter(type => type.kind === "alias").map(type => ({
		id: type.id, target: resolve(type.id)
		, cName: `${prefix}_t${sha256(type.id).slice(0, 20)}`
	}));
	const header = ["#pragma once", "#include <stdint.h>", "#include <stddef.h>"
		, "/* Private generated adapter values. Host APIs keep resource tokens opaque. */"];
	const structures = nodes.filter(node => node.kind !== "primitive" || !scalars[node.name]);
	for(const node of structures) header.push(`typedef struct ${node.cName} ${node.cName};`);
	const emitField = field => `  ${field.pointer ? "const " : ""}${table.get(field.type).cName}${field.pointer ? " *" : " "}${field.name};`;
	for(const node of [...structures.filter(node => node.leaf), ...structures.filter(node => !node.leaf)])
	{
		header.push(`struct ${node.cName} {`);
		if(node.kind === "primitive")
		{
			header.push(`  const ${{ string: "char", bytes: "uint8_t", nat: "uint32_t", int: "uint32_t" }[node.name]} *data;`, "  size_t length;");
			if(node.name === "int") header.push("  uint8_t negative;");
		}
		else if(["resource", "callback"].includes(node.kind)) header.push("  uint64_t token;");
		else if(node.element) header.push(`  const ${table.get(node.element).cName} *data;`, "  size_t length;");
		else if(node.kind === "variant")
		{
			header.push("  uint32_t tag;", "  union {");
			for(const branch of node.cases) header.push("    struct {"
				, ...branch.fields.length ? branch.fields.map(field => "    " + emitField(field)) : ["      uint8_t empty;"]
				, `    } ${branch.name};`);
			header.push("  } cases;");
		}
		else
		{
			if(["option", "result"].includes(node.kind)) header.push("  uint8_t tag;");
			if(node.kind === "record" && !node.fields.length) header.push("  uint8_t empty;");
			header.push(...node.fields.map(emitField));
		}
		header.push("};");
	}
	for(const alias of aliases) header.push(`typedef ${table.get(alias.target).cName} ${alias.cName};`);
	return { model, prefix, nodes, aliases, functions, callbacks, header: header.join("\n") + "\n" };
};
