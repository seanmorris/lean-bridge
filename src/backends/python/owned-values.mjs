/**
 * Python values for explicit ownership graphs, without package admission.
 *
 * @file
 */
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { pythonCompoundNames, pythonCompoundPublic } from "./compounds.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const reserved = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type list tuple str bytes bytearray int float bool object dict set frozenset len range super property staticmethod classmethod isinstance getattr setattr dataclass abs ord chr sum min max enumerate callable BaseException Exception RuntimeError TypeError ValueError MemoryError ImportError LeanBridgeError Some Option Ok Err Result WithRecovery with_recovery".split(" "));
const primitive = {
	unit: "None", bool: "bool", char: "str", string: "str", bytes: "bytes"
	, nat: "int", int: "int", usize: "int", isize: "int"
	, float32: "float", float64: "float"
	, uint8: "int", uint16: "int", uint32: "int", uint64: "int"
	, int8: "int", int16: "int", int32: "int", int64: "int"
};

/**
 * Keep resource identity separate from immutable value storage. Named records,
 * constructors and aliases remain public; containers have finite alias bounds.
 *
 * @param ir - Validated concrete ownership contract.
 * @param options - Explicit C transport capabilities.
 * @param options.transferredInputs - Admit consuming resource-containing inputs.
 */
export const generateOwnedPythonValues = (ir, { transferredInputs = false } = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks: true, transferredInputs });
	const occupied = new Set(reserved), names = new Map();
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || name.includes("__") || occupied.has(name))
			throw new TypeError(`Owned Python name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	const functions = c.functions.map(fn => ({ ...fn, publicName: claim(fn.cName.slice(c.prefix.length + 1)) }));
	for(const node of c.nodes) if(node.kind !== "primitive" && node.name) names.set(node.id, claim(node.name));
	const definitions = new Map(ir.types.map(node => [node.id, node]));
	for(const alias of c.native.aliases) names.set(alias.id, claim(definitions.get(alias.id).name));
	const members = (fields, variant = false) => {
		const seen = new Set();
		return fields.map(field => {
			const name = cIdentifier(field.sourceName);
			const publicName = reserved.has(name) || variant && name === "kind" ? `${name}_` : name;
			if(seen.has(publicName)) throw new TypeError(`Owned Python field name collides: ${publicName}`);
			seen.add(publicName); return { ...field, publicName };
		});
	};
	const types = c.nodes.map((node, index) => ({ ...node, index
		, publicType: node.kind === "primitive" ? primitive[node.name] : names.get(node.id) ?? `_Value${index}`
		, inputType: node.kind === "primitive" ? primitive[node.name] : names.get(node.id) ?? `_Input${index}`
		, fields: members(node.fields)
		, cases: node.cases.map(branch => ({ ...branch
			, publicName: claim(names.get(node.id) + branch.name.split("_").map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join(""))
			, fields: members(branch.fields, true) }))
	}));
	const table = new Map(types.map(node => [node.id, node])), containers = [], visiting = new Set(), visited = new Set();
	const visit = node => {
		if(visited.has(node.id) || node.name) return;
		if(visiting.has(node.id)) throw new TypeError("Owned Python container recursion requires a nominal boundary");
		visiting.add(node.id);
		for(const id of [node.element, ...node.fields.map(field => field.type)].filter(Boolean)) visit(table.get(id));
		visiting.delete(node.id); visited.add(node.id); containers.push(node);
	};
	for(const node of types) visit(node);
	const compoundModel = { surface: { copies: types.map(node => ({ compound: node.kind })) } };
	const exports = [...pythonCompoundNames(compoundModel)
		, ...types.filter(node => names.has(node.id)).flatMap(node => [node.publicType, ...node.cases.map(branch => branch.publicName)])
		, ...c.native.aliases.map(alias => names.get(alias.id)), "LeanBridgeError"
		, ...c.callbacks.length ? ["WithRecovery", "with_recovery"] : []
		, ...functions.map(fn => fn.publicName)];
	const parameterType = (fn, i) => c.hostArgument(fn, i)
		? `_CallbackInput${table.get(fn.parameters[i]).index}` : table.get(fn.parameters[i]).inputType;
	const annotation = (field, original) => original?.type.kind === "named" && names.has(original.type.id)
		? names.get(original.type.id) : table.get(field.type).inputType;
	const fields = (node, branch) => {
		const definition = definitions.get(node.id);
		const original = branch ? definition.cases.find(item => item.name === branch.sourceName).fields : definition.fields;
		return (branch ?? node).fields.map((field, index) => `    ${field.publicName}: ${annotation(field, original[index])}`);
	};
	const containerType = (node, input) => {
		const child = id => table.get(id)[input ? "inputType" : "publicType"];
		if(node.element) return `tuple[${child(node.element)}, ...]${input ? ` | list[${child(node.element)}]` : ""}`;
		return `${{ option: "Option", result: "Result", tuple: "tuple" }[node.kind]}[${node.fields.map(field => child(field.type)).join(", ")}]`;
	};
	const render = stub => {
		const lines = ["from __future__ import annotations"
			, "from dataclasses import dataclass as _dataclass"
			, "from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias, Never as _Never"
			, ...stub ? [] : ["from ._owned import _OwnedResource, LeanBridgeError", ""
				, ...containers.length ? ["try:", "    from typing import TypeAliasType as _TypeAliasType", "except ImportError:", "    from typing_extensions import TypeAliasType as _TypeAliasType"] : []]
			, ""
			, `__all__ = (${exports.map(name => JSON.stringify(name)).join(", ")}${exports.length ? "," : ""})`
			, ""
			, pythonCompoundPublic(compoundModel)];
		if(stub) lines.push("class LeanBridgeError(RuntimeError):", "    status: int"
			, "    def __init__(self, status: int, message: str | None = None) -> None: ...", "");
		if(c.callbacks.length) lines.push("from typing import Callable as _Callable, Generic as _Generic, ParamSpec as _ParamSpec, TypeVar as _TypeVar"
			, '_CallbackArgs = _ParamSpec("_CallbackArgs")', '_CallbackReturn = _TypeVar("_CallbackReturn")', ""
			, "@_dataclass(frozen=True, slots=True)"
			, "class WithRecovery(_Generic[_CallbackArgs, _CallbackReturn]):"
			, "    function: _Callable[_CallbackArgs, _CallbackReturn]", "    recovery: _CallbackReturn", ""
			, "def with_recovery(function: _Callable[_CallbackArgs, _CallbackReturn], recovery: _CallbackReturn) -> WithRecovery[_CallbackArgs, _CallbackReturn]:"
			, stub ? "    ..." : "    return WithRecovery(function, recovery)", "");
		for(const node of types)
		{
			if(node.identity)
			{
				lines.push(`class ${node.publicType}${stub ? "" : "(_OwnedResource)"}:`
					, "    __slots__ = ()"
					, ...stub ? ["    def __init__(self, _forbidden: _Never) -> None: ..."
						, "    @property", "    def is_closed(self) -> bool: ..."
						, "    def close(self) -> None: ..."
						, `    def __enter__(self) -> ${node.publicType}: ...`
						, "    def __exit__(self, *args: object) -> None: ..."] : []
					, `    def retain(self) -> ${node.publicType}:`
					, stub ? "        ..." : `        from . import _native\n        return _native._retain${node.index}(self)`);
				if(node.kind === "callback")
				{
					const fn = c.callbacks.find(fn => fn.id === node.id), parameters = fn.parameters.slice(1).map(id => table.get(id));
					lines.push(`    def __call__(self${parameters.map((_, i) => `, arg${i}: ${parameterType(fn, i + 1)}`).join("")}) -> ${table.get(fn.result).publicType}:`
						, stub ? "        ..." : `        from . import _native\n        return _native._invoke${node.index}(self${parameters.map((_, i) => `, arg${i}`).join("")})`);
				}
				lines.push("");
			}
			else if(node.kind === "record") lines.push("@_dataclass(frozen=True, slots=True)", `class ${node.publicType}:`
				, ...node.fields.length ? fields(node) : ["    pass"], "");
			else if(node.kind === "variant") for(const branch of node.cases)
				lines.push("@_dataclass(frozen=True, slots=True)", `class ${branch.publicName}:`
					, `    kind: _ClassVar[_Literal[${JSON.stringify(branch.sourceName)}]] = ${JSON.stringify(branch.sourceName)}`
					, ...fields(node, branch), "");
		}
		for(const node of types.filter(node => node.kind === "variant"))
			lines.push(`${node.publicType}: _TypeAlias = ${node.cases.map(branch => branch.publicName).join(" | ") || "_Never"}`);
		for(const node of containers) for(const input of [false, true])
		{
			const name = node[input ? "inputType" : "publicType"], expression = containerType(node, input);
			lines.push(stub ? `${name}: _TypeAlias = ${expression}` : `${name} = _TypeAliasType(${JSON.stringify(name)}, ${expression})`);
		}
		for(const alias of c.native.aliases) lines.push(`${names.get(alias.id)}: _TypeAlias = ${table.get(alias.target).publicType}`);
		for(const callback of c.callbacks)
		{
			const node = table.get(callback.id), result = table.get(callback.result);
			const parameters = callback.parameters.slice(1).map((_, i) => JSON.stringify(parameterType(callback, i + 1))).join(", ");
			const automatic = ownedCallbackRecovery(c.native.model, node, id => id) !== null;
			lines.push(`_CallbackInput${node.index}: _TypeAlias = ${node.publicType}${automatic ? ` | _Callable[[${parameters}], ${result.publicType}]` : ""} | WithRecovery[[${parameters}], ${result.publicType}]`);
		}
		for(const [index, fn] of functions.entries()) lines.push(""
			, `def ${fn.publicName}(${fn.parameters.map((_, i) => `arg${i}: ${parameterType(fn, i)}`).join(", ")}) -> ${table.get(fn.result).publicType}:`
			, ...fn.transfers?.length ? [`    """Consume resource leases in ${fn.transfers.map(i => `arg${i}`).join(", ")} at the Lean call boundary.

    Shared aliases close at handoff; independently retained owners stay usable.
    Validation and preparation failures preserve ownership. Failures after
    handoff leave inputs consumed. Callback borrows must be retained first.
    """`] : []
			, stub ? "    ..." : `    from . import _native\n    return _native._call${index}(${fn.parameters.map((_, i) => `arg${i}`).join(", ")})`);
		return lines.join("\n") + "\n";
	};
	return { c, types, functions, exports, packageDir: `lean_${c.prefix}`
		, source: render(false), stub: render(true) };
};
