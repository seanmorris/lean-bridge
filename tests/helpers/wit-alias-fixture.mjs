/**
 * Independent named WIT contracts for the shared copied-alias fixture.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { witListConsumer } from "./wit-list-fixture.mjs";

export const witAliasNames = { AUnit: "aunit", ABool: "abool", AU8: "au8"
	, AU16: "au16", AU32: "au32", AU64: "au64", AI8: "ai8", AI16: "ai16"
	, AI32: "ai32", AI64: "ai64", ANat: "anat", AInt: "aint", AF32: "af32"
	, AF64: "af64", AText: "atext", ABytes: "abytes", AChar: "achar"
	, AWord: "aword"
	, ASignedWord: "asigned-word", Count: "count"
	, OtherCount: "other-count", Rows: "rows", Maybe: "maybe", Outcome: "outcome"
	, PacketView: "packet-view", Packets: "packets", ScalarsView: "scalars-view" };
const names = { ...witAliasNames, Scalars: "scalars", Packet: "packet" };
const original = Object.fromEntries(Object.entries(names).map(([name, wit]) => [wit, name]));
const primitives = { unit: { enum: ["unit"] }, bool: "bool", uint8: "u8"
	, uint16: "u16", uint32: "u32", uint64: "u64", int8: "s8", int16: "s16"
	, int32: "s32", int64: "s64", usize: "u64", isize: "s64", char: "char"
	, float32: "f32", float64: "f64", string: "string"
	, bytes: { list: "u8" }, nat: { list: "u32" }
	, int: { record: [{ name: "negative", type: "bool" }, { name: "limbs", type: { list: "u32" } }] } };
const expected = ref => ref.kind === "primitive" ? primitives[ref.name]
	: ref.kind === "named" ? { named: ref.id.split(".").at(-1) }
		: ["list", "array"].includes(ref.constructor) ? { list: expected(ref.arguments[0]) }
			: ref.constructor === "option" ? { option: expected(ref.arguments[0]) }
				: { [ref.constructor]: ref.arguments.map(expected) };

/**
 * Check names and alias chains, not only their equivalent flattened shapes.
 *
 * @param document - Text WIT or compiled Component Model decoded by wasm-tools.
 * @param ir - Independently reviewed source contract.
 */
export const validateWitAliasSignatures = (document, ir = nativeAliasReviewedIr()) => {
	const reference = ref => {
		if(typeof ref === "string") return ref;
		const type = document.types[ref]; assert.ok(type, `Missing type ${ref}`);
		return original[type.name] ? { named: original[type.name] } : shape(type.kind);
	};
	const shape = kind => {
		if(kind.type !== undefined) return reference(kind.type);
		if(kind.list !== undefined) return { list: reference(kind.list) };
		if(kind.option !== undefined) return { option: reference(kind.option) };
		if(kind.result) return { result: [reference(kind.result.ok), reference(kind.result.err)] };
		if(kind.tuple) return { tuple: kind.tuple.types.map(reference) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: reference(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(item => item.name) };
		throw new Error(`Unexpected WIT alias target: ${JSON.stringify(kind)}`);
	};
	const signatures = ir.declarations.map(fn => ({ name: fn.name.replaceAll("_", "-")
		, parameters: fn.parameters.map(site => expected(site.type))
		, result: expected(fn.result.type) }))
		.sort((a, b) => a.name.localeCompare(b.name));
	for(const name of ["native", "api"])
	{
		const iface = document.interfaces.find(iface => iface.name === name); assert.ok(iface);
		const actual = Object.entries(iface.functions).map(([name, fn]) => ({ name
			, parameters: fn.params.map(site => reference(site.type))
			, result: reference(fn.result) }))
			.sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(actual, signatures, name + " original API contracts");
		for(const type of ir.types)
		{
			const index = iface.types[names[type.name]]; assert.ok(Number.isInteger(index), type.name);
			assert.deepEqual(reference(index), { named: type.name });
			if(name === "native") assert.deepEqual(shape(document.types[index].kind), type.kind === "alias"
				? expected(type.target) : { record: type.fields.map(field => ({ name: field.name.replaceAll("_", "-"), type: expected(field.type) })) }, type.name);
		}
	}
	return signatures;
};

/**
 * Check archived source contracts against the independent alias fixture.
 *
 * @param manifest - Packaged WIT binding manifest.
 * @param ir - Independently specified original contracts and captured site names.
 */
export const checkWitAliasManifest = (manifest, ir) => {
	const sort = items => [...items].sort((a, b) => a.id.localeCompare(b.id));
	assert.deepEqual(manifest.aliases.map(({ id, name, target, witName }) => ({ id, name, target, witName }))
		, sort(ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, witName: witAliasNames[name] }))));
	const mapped = ref => ref.kind === "named" ? names[ref.id.split(".").at(-1)] : primitives[ref.name];
	assert.deepEqual(manifest.contracts.declarations, ir.declarations.map(fn => ({ id: fn.id
		, parameters: fn.parameters.map(site => ({ name: site.name, type: site.type, witType: mapped(site.type) }))
		, result: { type: fn.result.type, witType: mapped(fn.result.type) } })));
	assert.deepEqual(sort(manifest.contracts.records), sort(ir.types.filter(type => type.kind === "record").map(type => ({ id: type.id
		, witName: names[type.name]
		, fields: type.fields.map(field => ({ name: field.name, type: field.type, witType: mapped(field.type) })) }))));
};

/** Reuse independent Wasmtime sample builders, never production converters. */
export const witAliasConsumer = async () => {
	const lists = await witListConsumer(), start = lists.indexOf("static void ok("), end = lists.indexOf("static value run(");
	assert.ok(start > 0 && end > start);
	return (await readFile("tests/fixtures/alias-consumers/wit-wasi.c", "utf8")).replace("/* COPIED_BUILDERS */", lists.slice(start, end));
};
