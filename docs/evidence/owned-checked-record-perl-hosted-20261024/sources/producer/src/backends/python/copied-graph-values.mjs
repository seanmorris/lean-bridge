/**
 * Finite public Python declarations for copied graphs. Runtime conversion and
 * installed wheel acceptance are separate from generating these value types.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { pythonCompoundNames, pythonCompoundPublic } from "./compounds.mjs";
import { cIdentifier } from "../c/generate.mjs";

const reserved = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type list tuple str bytes bytearray int float bool object dict set frozenset len range super property staticmethod classmethod isinstance getattr setattr dataclass abs ord chr sum min max enumerate callable BaseException Exception RuntimeError TypeError ValueError MemoryError ImportError LeanBridgeError LeanClosure Some Option Ok Err Result invoke dispatch handle token".split(" "));
const primitive = {
	unit: "None", bool: "bool", char: "str", string: "str", bytes: "bytes"
	, nat: "int", int: "int", usize: "int", isize: "int"
	, float32: "float", float64: "float"
	, uint8: "int", uint16: "int", uint32: "int", uint64: "int"
	, int8: "int", int16: "int", int32: "int", int64: "int"
};

/**
 * Preserve nominal names and finite recursive edges. Private TypeAliasType
 * boundaries prevent runtime hints from exponentially unfolding shared types.
 * Stubs use precise ordinary aliases for static checkers on Python 3.11+.
 *
 * @param ir - Concrete pure copied Binding IR.
 */
export const generateCopiedPythonGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir), names = new Map(), occupied = new Set(reserved);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name.includes("__") || occupied.has(name))
			throw new TypeError(`Python graph value name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	const definitions = [...ir.types].sort((a, b) => a.id.localeCompare(b.id));
	for(const definition of definitions) names.set(definition.id, claim(definition.name));
	const members = (fields, variant = false) => {
		const seen = new Set();
		return fields.map(field => {
			const publicName = reserved.has(field.name) || variant && field.name === "kind" ? `${field.name}_` : field.name;
			if(seen.has(publicName)) throw new TypeError(`Python graph field name collides: ${publicName}`);
			seen.add(publicName); return { ...field, publicName };
		});
	};
	const models = layout.nodes.map((node, index) => ({
		...node, index
		, publicType: node.ref.kind === "named" ? names.get(node.ref.id) : node.kind === "primitive" ? primitive[node.ref.name] : `_Value${index}`
		, inputType: node.ref.kind === "apply" ? `_Input${index}` : node.ref.kind === "named" ? names.get(node.ref.id) : primitive[node.ref.name]
		, fields: members(node.fields)
		, cases: node.cases.map(branch => ({ ...branch
			, publicName: claim(names.get(node.ref.id) + branch.name.split("_").map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join(""))
			, fields: members(branch.fields, true) }))
	}));
	const nodes = new Map(models.map(node => [node.id, node]));
	const functions = layout.roots.map(root => {
		const declaration = ir.declarations.find(item => item.id === root.bindingId), publicName = claim(root.name.slice(layout.prefix.length + 1));
		const seen = new Set();
		const parameters = declaration.parameters.map(parameter => {
			const name = cIdentifier(parameter.name);
			if(reserved.has(name) || seen.has(name)) throw new TypeError(`Python graph parameter name is reserved or duplicated: ${name}`);
			seen.add(name); return name;
		});
		return { ...root, publicName, parameters, declaration };
	});
	const compoundModel = { surface: { copies: models.map(node => ({ compound: node.kind })) } };
	const nominalExports = definitions.flatMap(definition => {
		const node = models.find(item => item.ref.kind === "named" && item.ref.id === definition.id);
		return [definition.name, ...(node?.cases ?? []).map(branch => branch.publicName)];
	});
	const exports = [...pythonCompoundNames(compoundModel), ...nominalExports];
	const aliases = new Map(layout.aliases.map(alias => [alias.id, alias]));
	const publicType = (ref, input = false) => {
		if(ref.kind === "named")
		{
			const alias = aliases.get(ref.id), name = names.get(ref.id);
			if(!input || !alias) return name;
			const target = nodes.get(alias.target);
			return target.inputType === target.publicType ? name : `${name} | ${target.inputType}`;
		}
		if(ref.kind === "primitive") return primitive[ref.name];
		// Source container aliases have already been resolved in the finite layout.
		// Field/root models provide their exact node identity to the renderer.
		throw new TypeError("Python graph container annotations require a resolved node");
	};
	const sourceFields = (definition, branch) => definition.kind === "variant"
		? definition.cases.find(item => item.name === branch.sourceName).fields : definition.fields;
	const fields = (definition, model) => model.fields.map((field, index) => {
		const ref = sourceFields(definition, model)[index].type;
		return `    ${field.publicName}: ${ref.kind === "apply" ? nodes.get(field.type).inputType : publicType(ref, true)}`;
	});
	const containers = [], visited = new Set();
	for(const node of models.filter(item => item.ref.kind === "apply"))
	{
		const pending = [{ id: node.id, done: false }];
		while(pending.length)
		{
			const item = pending.pop();
			if(visited.has(item.id)) continue;
			const value = nodes.get(item.id);
			if(item.done)
			{ containers.push(value); visited.add(item.id); continue; }
			pending.push({ id: item.id, done: true });
			for(const child of [value.element, ...value.fields.map(field => field.type)].filter(Boolean))
				if(nodes.get(child).ref.kind === "apply" && !visited.has(child)) pending.push({ id: child, done: false });
		}
	}
	const containerType = (node, input) => {
		const child = id => nodes.get(id)[input ? "inputType" : "publicType"];
		if(node.element) return `tuple[${child(node.element)}, ...]${input ? ` | list[${child(node.element)}]` : ""}`;
		return `${{ option: "Option", result: "Result", tuple: "tuple" }[node.kind]}[${node.fields.map(field => child(field.type)).join(", ")}]`;
	};
	const render = stub => {
		const lines = ["from __future__ import annotations"
			, "from dataclasses import dataclass as _dataclass"
			, "from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias"
			, ...containers.length && !stub ? ["", "try:"
				, "    from typing import TypeAliasType as _TypeAliasType"
				, "except ImportError:"
				, "    from typing_extensions import TypeAliasType as _TypeAliasType"] : []
			, ""
			, `__all__ = (${exports.map(name => JSON.stringify(name)).join(", ")}${exports.length ? "," : ""})`
			, ""
			, pythonCompoundPublic(compoundModel)];
		for(const definition of definitions.filter(item => item.kind !== "alias"))
		{
			const node = models.find(item => item.ref.kind === "named" && item.ref.id === definition.id);
			if(definition.kind === "record") lines.push("@_dataclass(frozen=True, slots=True)", `class ${definition.name}:`
				, ...node.fields.length ? fields(definition, node) : ["    pass"], "");
			else for(const branch of node.cases) lines.push("@_dataclass(frozen=True, slots=True)", `class ${branch.publicName}:`
				, `    kind: _ClassVar[_Literal[${JSON.stringify(branch.sourceName)}]] = ${JSON.stringify(branch.sourceName)}`
				, ...fields(definition, branch), "");
		}
		for(const node of models.filter(item => item.kind === "variant"))
			lines.push(`${node.publicType}: _TypeAlias = ${node.cases.map(branch => branch.publicName).join(" | ")}`);
		for(const node of containers) for(const input of [false, true])
		{
			const name = node[input ? "inputType" : "publicType"], expression = containerType(node, input);
			lines.push(stub ? `${name}: _TypeAlias = ${expression}` : `${name} = _TypeAliasType(${JSON.stringify(name)}, ${expression})`);
		}
		const pending = definitions.filter(item => item.kind === "alias"), emitted = new Set();
		while(pending.length)
		{
			const index = pending.findIndex(alias => !aliases.has(alias.target.id) || emitted.has(alias.target.id));
			if(index < 0) throw new TypeError("Python graph alias cycle");
			const [alias] = pending.splice(index, 1), target = nodes.get(aliases.get(alias.id).target);
			lines.push(`${alias.name}: _TypeAlias = ${alias.target.kind === "named" ? names.get(alias.target.id) : target.publicType}`);
			emitted.add(alias.id);
		}
		return lines.join("\n") + "\n";
	};
	return { layout, types: models, functions, exports
		, packageDir: `lean_${layout.prefix}`
		, requiresTypeAliases: containers.length > 0
		, source: render(false), stub: render(true) };
};
