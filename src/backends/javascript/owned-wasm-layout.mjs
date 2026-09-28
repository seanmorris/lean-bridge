/**
 * Private wasm32 storage for JavaScript's resource-bearing value transport.
 * Compile the emitted assertions with the generated native header before use.
 *
 * @file
 */
import { compileOwnedNativeValueLayout } from "../native/owned-value-layout.mjs";

const align = (size, alignment) => Math.ceil(size / alignment) * alignment;
const pointer = Object.freeze({ size: 4, alignment: 4 });
const word64 = Object.freeze({ size: 8, alignment: 8 });
const scalarSizes = Object.freeze({
	unit: 1, bool: 1, uint8: 1, int8: 1, uint16: 2, int16: 2
	, char: 4, uint32: 4, int32: 4, usize: 4, isize: 4, float32: 4
	, uint64: 8, int64: 8, float64: 8
});

const structure = fields => {
	let size = 0, alignment = 1;
	const members = fields.map(field => {
		alignment = Math.max(alignment, field.alignment);
		const offset = align(size, field.alignment);
		size = offset + field.size;
		return { ...field, offset };
	});
	return { size: align(size, alignment), alignment, members };
};

const freeze = value => {
	if(value && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.values(value).forEach(freeze); Object.freeze(value);
	}
	return value;
};

/**
 * Resolve only C storage, never Lean object layouts or public host identities.
 * Recursive non-leaf fields use the pointers already selected by the shared
 * native ownership layout. Resource and callback tokens remain 64-bit.
 *
 * @param ir - Explicit version-4 ownership contract.
 */
export const compileOwnedJavaScriptWasmLayout = ir => {
	const native = compileOwnedNativeValueLayout(ir, { wordBits: 32 });
	const nodes = new Map(native.nodes.map(node => [node.id, node]));
	const storage = new Map();
	const fieldStorage = field => field.pointer ? pointer : storage.get(field.type);
	const fields = values => values.map(field => {
		const value = fieldStorage(field);
		if(!value) throw new TypeError("Owned JavaScript layout requires a finite native leaf layout");
		return { path: field.name, size: value.size, alignment: value.alignment };
	});
	for(const node of native.nodes.filter(item => item.leaf))
	{
		let value;
		if(node.kind === "resource" || node.kind === "callback")
			value = structure([{ path: "token", ...word64 }]);
		else if(Object.hasOwn(scalarSizes, node.name))
			value = { size: scalarSizes[node.name], alignment: scalarSizes[node.name], members: [] };
		else
		{
			if(!["string", "bytes", "nat", "int"].includes(node.name))
				throw new TypeError(`Unknown owned JavaScript primitive ${node.name}`);
			value = structure([{ path: "data", ...pointer }
				, { path: "length", ...pointer }
				, ...node.name === "int" ? [{ path: "negative", size: 1, alignment: 1 }] : []]);
		}
		storage.set(node.id, value);
	}
	for(const node of native.nodes.filter(item => !item.leaf))
	{
		let value;
		if(node.element)
			value = structure([{ path: "data", ...pointer }, { path: "length", ...pointer }]);
		else if(node.kind === "variant")
		{
			const branches = node.cases.map(branch => ({ ...branch
				, storage: structure(branch.fields.length ? fields(branch.fields) : [{ path: "empty", size: 1, alignment: 1 }]) }));
			const alignment = Math.max(...branches.map(branch => branch.storage.alignment));
			const size = align(Math.max(...branches.map(branch => branch.storage.size)), alignment);
			value = structure([{ path: "tag", size: 4, alignment: 4 }, { path: "cases", size, alignment }]);
			const offset = value.members[1].offset;
			value.members.push(...branches.flatMap(branch => [
				{ path: `cases.${branch.name}`, offset, size: branch.storage.size, alignment: branch.storage.alignment }
				, ...branch.storage.members.map(member => ({ ...member
					, path: `cases.${branch.name}.${member.path}`
					, offset: offset + member.offset }))
			]));
		}
		else
		{
			const members = fields(node.fields);
			if(["option", "result"].includes(node.kind)) members.unshift({ path: "tag", size: 1, alignment: 1 });
			if(node.kind === "record" && !members.length) members.push({ path: "empty", size: 1, alignment: 1 });
			value = structure(members);
		}
		storage.set(node.id, value);
	}
	const types = native.nodes.map(node => ({ ...node, ...storage.get(node.id)
		, fields: node.fields.map(field => ({ ...field, offset: storage.get(node.id).members.find(member => member.path === field.name).offset }))
		, cases: node.cases.map(branch => ({ ...branch
			, fields: branch.fields.map(field => ({ ...field, offset: storage.get(node.id).members.find(member => member.path === `cases.${branch.name}.${field.name}`).offset })) }))
		, elementSize: node.element ? storage.get(node.element).size : null
	}));
	const assertions = ["#pragma once", '#include "owned-values.h"'
		, '_Static_assert(sizeof(void *) == 4 && sizeof(size_t) == 4, "Owned JavaScript requires wasm32");'
		, '#ifndef __wasm32__'
		, '#error "Owned JavaScript requires the wasm32 target"'
		, "#endif"];
	for(const type of types)
	{
		assertions.push(`_Static_assert(sizeof(${type.cName}) == ${type.size}, "Owned JavaScript size: ${type.index}");`
			, `_Static_assert(_Alignof(${type.cName}) == ${type.alignment}, "Owned JavaScript alignment: ${type.index}");`);
		for(const member of type.members)
			assertions.push(`_Static_assert(offsetof(${type.cName}, ${member.path}) == ${member.offset}, "Owned JavaScript field: ${type.index}.${member.path}");`
				, `_Static_assert(sizeof(((${type.cName} *)0)->${member.path}) == ${member.size}, "Owned JavaScript member size: ${type.index}.${member.path}");`);
	}
	for(const alias of native.aliases)
	{
		const target = nodes.get(alias.target);
		assertions.push(`_Static_assert(sizeof(${alias.cName}) == sizeof(${target.cName}), "Owned JavaScript alias size");`
			, `_Static_assert(_Alignof(${alias.cName}) == _Alignof(${target.cName}), "Owned JavaScript alias alignment");`);
	}
	return freeze({ schemaVersion: 1, kind: "owned-javascript-wasm32-layout"
		, native, types, assertions: assertions.join("\n") + "\n" });
};
