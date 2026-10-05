/**
 * Independent WIT signatures and public Wasmtime collection callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { collectionSignatures } from "./collection-fixture.mjs";
import { witListConsumer } from "./wit-list-fixture.mjs";

const primitive = { unit: { enum: ["unit"] }, bool: "bool"
	, uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64"
	, int8: "s8", int16: "s16", int32: "s32", int64: "s64"
	, usize: "u64", isize: "s64", char: "char"
	, float32: "f32", float64: "f64", string: "string"
	, bytes: { list: "u8" }, nat: { list: "u32" }
	, int: { record: [{ name: "negative", type: "bool" }, { name: "limbs", type: { list: "u32" } }] } };
const expected = type => typeof type === "string" ? primitive[type]
	: type.array ? { list: expected(type.array) }
		: Object.keys(type.fields).length ? { record: Object.entries(type.fields).map(([name, type]) => ({ name, type: expected(type) })) }
			: { enum: ["empty"] };

/**
 * Check both parsed declarations and executable component types against source contracts.
 *
 * @param document - Parsed wasm-tools component wit --json output.
 */
export const validateWitCollectionSignatures = document => {
	const value = ref => {
		if(typeof ref === "string") return ref;
		const kind = document.types[ref].kind;
		if(kind.type !== undefined) return value(kind.type);
		if(kind.list !== undefined) return { list: value(kind.list) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: value(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(item => item.name) };
		throw new Error(`Unexpected WIT collection type: ${JSON.stringify(kind)}`);
	};
	const signatures = collectionSignatures.map(fn => ({
		name: fn.name.split(".").at(-1).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
		, parameters: fn.parameters.map(expected), result: expected(fn.result)
	})).sort((a, b) => a.name.localeCompare(b.name));
	for(const name of ["api", "native"])
	{
		const iface = document.interfaces.find(iface => iface.name === name); assert.ok(iface);
		const actual = Object.entries(iface.functions).map(([name, fn]) => ({ name, parameters: fn.params.map(site => value(site.type)), result: value(fn.result) })).sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(actual, signatures);
	}
	return signatures;
};

/** Reuse independent primitive oracles, never generated layouts or expected results. */
export const witCollectionConsumer = async () => {
	const lists = await witListConsumer(), end = lists.indexOf("static value none(void)");
	assert.ok(end > 0);
	const helpers = lists.slice(0, end).replaceAll("lists_wasmtime", "collections_wasmtime");
	const source = await readFile("tests/fixtures/collection-consumers/wit-wasi.c", "utf8");
	assert.ok(source.startsWith("/* COPIED_ORACLES */\n"));
	return source.replace("/* COPIED_ORACLES */\n", helpers);
};
