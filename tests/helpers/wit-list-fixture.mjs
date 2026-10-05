/**
 * Independent Component Model shapes for copied list acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { listSignatures } from "./list-fixture.mjs";

const primitive = { unit: { enum: ["unit"] }, bool: "bool"
	, uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64"
	, int8: "s8", int16: "s16", int32: "s32", int64: "s64"
	, usize: "u64", isize: "s64", char: "char"
	, float32: "f32", float64: "f64", string: "string"
	, bytes: { list: "u8" }, nat: { list: "u32" }
	, int: { record: [{ name: "negative", type: "bool" }, { name: "limbs", type: { list: "u32" } }] } };
const expected = type => typeof type === "string" ? primitive[type] : type.option ? { option: expected(type.option) }
	: type.result ? { result: type.result.map(expected) } : type.tuple ? { tuple: type.tuple.map(expected) }
		: type.array || type.list ? { list: expected(type.array ?? type.list) }
			: { record: Object.entries(type.fields).map(([name, type]) => ({ name, type: expected(type) })) };

/**
 * Reconcile parsed WIT and compiled component signatures with the independent catalog.
 *
 * @param document - Parsed wasm-tools component wit --json output.
 */
export const validateWitListSignatures = document => {
	const value = ref => {
		if(typeof ref === "string") return ref;
		const kind = document.types[ref].kind;
		if(kind.type !== undefined) return value(kind.type);
		if(kind.list !== undefined) return { list: value(kind.list) };
		if(kind.option !== undefined) return { option: value(kind.option) };
		if(kind.result) return { result: [value(kind.result.ok), value(kind.result.err)] };
		if(kind.tuple) return { tuple: kind.tuple.types.map(value) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: value(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(item => item.name) };
		throw new Error(`Unexpected WIT type: ${JSON.stringify(kind)}`);
	};
	const signatures = listSignatures.map(fn => ({ name: fn.name.split(".").at(-1).replaceAll("_", "-")
		, parameters: fn.parameters.map(expected)
		, result: expected(fn.result) })).sort((a, b) => a.name.localeCompare(b.name));
	for(const name of ["api", "native"])
	{
		const iface = document.interfaces.find(iface => iface.name === name); assert.ok(iface);
		const actual = Object.entries(iface.functions).map(([name, fn]) => ({ name, parameters: fn.params.map(site => value(site.type)), result: value(fn.result) })).sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(actual, signatures);
	}
	return signatures;
};

/** Assemble public Wasmtime values without using the production converters. */
export const witListConsumer = async () => {
	const primitive = await readFile("tests/fixtures/callable-consumers/wit-component.c", "utf8");
	const start = primitive.indexOf("static void ok("), end = primitive.indexOf("static wasmtime_error_t *call(");
	assert.ok(start > 0 && end > start);
	const branches = `  case WASMTIME_COMPONENT_OPTION:
    CHECK((a->of.option == NULL) == (b->of.option == NULL));
    if (a->of.option) { CHECK(a->of.option != b->of.option); equal(a->of.option, b->of.option); } break;
  case WASMTIME_COMPONENT_RESULT:
    CHECK(a->of.result.is_ok == b->of.result.is_ok && a->of.result.val != b->of.result.val);
    equal(a->of.result.val, b->of.result.val); break;
  case WASMTIME_COMPONENT_TUPLE:
    CHECK(a->of.tuple.size == b->of.tuple.size && a->of.tuple.data != b->of.tuple.data);
    for (size_t i = 0; i < a->of.tuple.size; ++i) equal(&a->of.tuple.data[i], &b->of.tuple.data[i]);
    break;
  default: abort();
  }
}
`;
	const oracles = primitive.slice(start, end).replace("static wasmtime_component_val_t sample(", "static wasmtime_component_val_t base_sample(").replaceAll("assert(", "CHECK(").replace("  default: abort();\n  }\n}\n", branches);
	assert.ok(oracles.includes("case WASMTIME_COMPONENT_OPTION:"));
	return (await readFile("tests/fixtures/list-consumers/wit-wasi.c", "utf8")).replace("/* COPIED_ORACLES */", oracles);
};
