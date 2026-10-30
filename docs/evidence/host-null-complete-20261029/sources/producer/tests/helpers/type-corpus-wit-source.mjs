/**
 * Independent WIT values, signatures and public Wasmtime callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const scalar = { bool: ["BOOL", "boolean"], uint8: ["U8", "u8"], uint16: ["U16", "u16"], uint32: ["U32", "u32"], uint64: ["U64", "u64"], int8: ["S8", "s8"], int16: ["S16", "s16"], int32: ["S32", "s32"], int64: ["S64", "s64"], float32: ["F32", "f32"], float64: ["F64", "f64"] };
const operation = (library, entry) => library.snakeOperations[library.operations.indexOf(entry.operation)].replaceAll("_", "-");
const signature = (library, entry) => corpusSignatures(library).find(item => item.name === library.module + "." + entry.operation);
const key = type => typeof type === "string" ? type : type.array ? `array_${key(type.array)}` : type.record.split(".").at(-1).toLowerCase();
const quote = text => `"${[...Buffer.from(text)].map(byte => `\\${byte.toString(8).padStart(3, "0")}`).join("")}"`;
const literal = text => {
	const value = BigInt(text);
	if(value === -(1n << 63n)) return "INT64_MIN";
	if(value < 0n) return `(-INT64_C(${-value}))`;
	if(value === 1n << 64n) return "(((__uint128_t)UINT64_MAX) + 1)";
	assert.ok(value < 1n << 64n);
	return `UINT64_C(${value})`;
};

export const witInputError = "Unknown export, invalid WIT input or 16 MiB conversion limit";
export const witArgumentError = "Invalid WIT call arguments or unavailable session";
export const witRuntimeCases = Object.freeze({
	"noncanonical-nat": witInputError, "negative-zero": witInputError
	, "noncanonical-int": witInputError, "wrong-unit": witInputError
	, "invalid-utf8": witInputError, "wrong-record-field": witInputError
	, "wrong-scalar-tag": witInputError, "unknown-export": witInputError
	, "wrong-arity": witInputError, "missing-arguments": witArgumentError
	, "missing-result": witArgumentError, "missing-session": witArgumentError
	, "conversion-limit": witInputError
	, "native-budget-trap": "16 MiB call limit exceeded"
});

const types = library => {
	const found = new Map();
	const visit = type => {
		if(type.array) visit(type.array);
		if(type.fields) Object.values(type.fields).forEach(visit);
		found.set(key(type), type);
	};
	corpusSignatures(library).forEach(item => [...item.parameters, item.result].forEach(visit));
	return [...found.values()];
};
const value = (wire, type) => {
	if(wire.integer !== undefined)
	{
		if(["nat", "int"].includes(type))
		{
			let number = BigInt(wire.integer); const negative = number < 0n, words = [];
			if(negative) number = -number;
			while(number)
			{ words.push(Number(number & 0xffffffffn)); number >>= 32n; }
			const natural = `wit_list(${words.length}, ${words.length ? `(wasmtime_component_val_t[]){${words.map(word => value({ integer: String(word) }, "uint32")).join(", ")}}` : "NULL"})`;
			return type === "int" || negative ? `wit_integer(${negative}, ${natural})` : natural;
		}
		const selected = scalar[type] && /^(?:u?int)\d+$/.test(type) ? type : "int64";
		const [kind, field] = scalar[selected];
		return `(wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_${kind}, .of.${field} = ${literal(wire.integer)}}`;
	}
	if(wire.bool !== undefined) return `(wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = ${wire.bool}}`;
	if(wire.unit) return 'wit_unit("unit")';
	if(wire.string !== undefined) return `wit_text(${quote(wire.string)}, ${Buffer.byteLength(wire.string)})`;
	if(wire.bytes || wire.array)
	{
		const items = wire.bytes ? wire.bytes.map(number => ({ integer: String(number) })) : wire.array;
		return `wit_list(${items.length}, ${items.length ? `(wasmtime_component_val_t[]){${items.map(item => value(item, wire.bytes ? "uint8" : type.array)).join(", ")}}` : "NULL"})`;
	}
	if(wire.record)
	{
		const fields = Object.entries(type.fields);
		return `wit_record(${fields.length}, (const char *[]){${fields.map(([name]) => quote(name)).join(", ")}}, (wasmtime_component_val_t[]){${fields.map(([name, type]) => value(wire.fields[name], type)).join(", ")}})`;
	}
	for(const [kind, bits] of [["float32", 32], ["float64", 64]]) if(wire[kind] !== undefined)
		return `(wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_F${bits}, .of.f${bits} = wire_from_f${bits}(UINT${bits}_C(${wire[kind] === "nan" ? bits === 32 ? "2143289344" : "9221120237041090560" : wire[kind]}))}`;
	assert.fail("Unknown WIT corpus input");
};

const serializer = type => {
	let body;
	if(type.array) body = `assert(value->kind == WASMTIME_COMPONENT_LIST); fputs("{\\"array\\":[", stream);
  for (size_t i = 0; i < value->of.list.size; ++i) { if (i) fputc(',', stream); emit_${key(type.array)}(stream, &value->of.list.data[i]); }
  fputs("]}", stream);`;
	else if(type.record) body = `assert(value->kind == WASMTIME_COMPONENT_RECORD && value->of.record.size == ${Object.keys(type.fields).length});
  fputs("{\\"record\\":\\"${type.record.split(".").at(-1)}\\",\\"fields\\":{", stream);
${Object.entries(type.fields).map(([name, field], index) => `  assert(wit_name(&value->of.record.data[${index}].name, "${name}"));
  fputs("${index ? "," : ""}\\"${name}\\":", stream); emit_${key(field)}(stream, &value->of.record.data[${index}].val);`).join("\n")}
  fputs("}}", stream);`;
	else if(type === "nat") body = "wit_big(stream, value, false);";
	else if(type === "int") body = `assert(value->kind == WASMTIME_COMPONENT_RECORD && value->of.record.size == 2);
  assert(wit_name(&value->of.record.data[0].name, "negative") && value->of.record.data[0].val.kind == WASMTIME_COMPONENT_BOOL);
  assert(wit_name(&value->of.record.data[1].name, "limbs"));
  wit_big(stream, &value->of.record.data[1].val, value->of.record.data[0].val.of.boolean);`;
	else if(type === "unit") body = 'assert(value->kind == WASMTIME_COMPONENT_ENUM && wit_name(&value->of.enumeration, "unit")); fputs("{\\"unit\\":true}", stream);';
	else if(type === "string") body = 'assert(value->kind == WASMTIME_COMPONENT_STRING); fputs("{\\"string\\":", stream); wire_quote(stream, value->of.string.data, value->of.string.size); fputc(\'}\', stream);';
	else if(type === "bytes") body = `assert(value->kind == WASMTIME_COMPONENT_LIST); fputs("{\\"bytes\\":[", stream);
  for (size_t i = 0; i < value->of.list.size; ++i) { assert(value->of.list.data[i].kind == WASMTIME_COMPONENT_U8); if (i) fputc(',', stream); fprintf(stream, "%u", value->of.list.data[i].of.u8); }
  fputs("]}", stream);`;
	else
	{
		const [kind, field] = scalar[type];
		body = `assert(value->kind == WASMTIME_COMPONENT_${kind}); `;
		if(type.startsWith("float")) body += `wire_${type}(stream, value->of.${field});`;
		else if(type === "bool") body += 'fputs(value->of.boolean ? "{\\"bool\\":true}" : "{\\"bool\\":false}", stream);';
		else body += `fprintf(stream, "{\\"integer\\":\\"%" ${type.startsWith("uint") ? "PRIu64" : "PRId64"} "\\"}", (${type.startsWith("uint") ? "uint64_t" : "int64_t"})value->of.${field});`;
	}
	return `static void emit_${key(type)}(FILE *stream, const wasmtime_component_val_t *value) {\n  ${body}\n}`;
};

/**
 * Typed field initializers must fail before an out-of-range value can wrap.
 *
 * @param library - Independent catalog library.
 * @param entry - Selected compile-rejection case.
 */
export const corpusWitRejection = (library, entry) => {
	assert.equal(entry.expectation.kind, "compile-rejection");
	return `#include "${library.cModule}_wasmtime.h"
#include <stdint.h>
int main(void) {
  wasmtime_component_val_t input = ${value(entry.arguments[0], signature(library, entry).parameters[0])};
  wasmtime_component_val_t output = {0};
  return ${library.cModule}_wasmtime_call(NULL, "${operation(library, entry)}", &input, 1, &output) != NULL;
}
`;
};

/**
 * No oracle outputs or generated implementation details enter this program.
 *
 * @param library - Independent catalog library.
 */
export const corpusWitSource = library => {
	const p = library.cModule, entries = corpusCases(library).map(entry => corpusHostCase(entry, "wit-wasi"));
	const record = entries.find(entry => entry.checkIndependentCopy), recordType = signature(library, record).result;
	const natural = value({ integer: "1" }, "nat"), signed = value({ integer: "-1" }, "int");
	const dependencies = `(wasmtime_component_val_t[]){${value({ integer: "7" }, "uint32")}}`;
	const setup = {
		"noncanonical-nat": `args[0] = wit_list(1, (wasmtime_component_val_t[]){{.kind = WASMTIME_COMPONENT_U32, .of.u32 = 0}}); args[1] = ${value({ integer: "0" }, "uint32")}; name = "${operation(library, entries[1])}"; count = 2;`
		, "negative-zero": `args[0] = wit_integer(true, wit_list(0, NULL)); args[1] = ${signed}; name = "${library.snakeOperations[2].replaceAll("_", "-")}"; count = 2;`
		, "noncanonical-int": `args[0] = wit_integer(false, wit_list(1, (wasmtime_component_val_t[]){{.kind = WASMTIME_COMPONENT_U32, .of.u32 = 0}})); args[1] = ${signed}; name = "${library.snakeOperations[2].replaceAll("_", "-")}"; count = 2;`
		, "wrong-unit": `args[0] = wit_unit("empty"); name = "${library.snakeOperations[10].replaceAll("_", "-")}";`
		, "invalid-utf8": `args[0] = wit_text("\\300\\257", 2); args[1] = wit_text("", 0); name = "${library.snakeOperations[3].replaceAll("_", "-")}"; count = 2;`
		, "wrong-record-field": `args[0] = ${value(record.arguments[0], recordType)}; args[0].of.record.data[0].name.data[0] = '?'; name = "${operation(library, record)}";`
		, "wrong-scalar-tag": `args[0] = ${value({ integer: "7" }, "uint64")};`
		, "unknown-export": `args[0] = ${natural}; name = "missing-corpus-export";`
		, "wrong-arity": "count = 0;"
		, "missing-arguments": "inputs = NULL;"
		, "missing-result": "result = NULL;"
		, "missing-session": "selected = NULL;"
		, "conversion-limit": `args[0] = wit_large_list(600000); name = "${library.snakeOperations[4].replaceAll("_", "-")}"; args[1] = ${value({ integer: "0" }, "uint32")}; count = 2;`
		, "native-budget-trap": `args[0] = wit_large_text(9u * 1024u * 1024u); args[1] = wit_text("", 0); name = "${library.snakeOperations[3].replaceAll("_", "-")}"; count = 2;`
	};
	return `#define _GNU_SOURCE
#include "${p}_wasmtime.h"
#include "wit.h"
${types(library).map(serializer).join("\n")}
static ${p}_wasmtime *session;
static void recovery(void) {
  wasmtime_component_val_t out = {0}; wit_ok(${p}_wasmtime_call(session, "${operation(library, entries[0])}", ${dependencies}, 1, &out));
  fputs(",\\"recovery\\":", stdout); emit_uint32(stdout, &out); wasmtime_component_val_delete(&out);
}
int main(void) {
  wit_ok(${p}_wasmtime_open(&session));
  printf("{\\"schemaVersion\\":1,\\"profile\\":\\"wit-wasi\\",\\"module\\":\\"${p}\\",\\"hostVersion\\":\\"%s\\",\\"results\\":[", WASMTIME_VERSION);
${entries.filter(entry => entry.expectation.kind !== "compile-rejection").map((entry, index) => {
	const types = signature(library, entry), argumentsSource = entry.arguments.map((wire, index) => value(wire, types.parameters[index])).join(", ");
	const call = `${p}_wasmtime_call(session, "${operation(library, entry)}", args, ${entry.arguments.length}, &out)`;
	return `  {
    wasmtime_component_val_t args[] = {${argumentsSource}}, out = {.kind = WASMTIME_COMPONENT_U64, .of.u64 = UINT64_MAX};
    fputs("${index ? "," : ""}{\\"id\\":\\"${entry.id}\\",", stdout);
${entry.expectation.kind === "lean-oracle" ? `    wit_ok(${call});
${entry.checkIndependentCopy ? `    wasmtime_component_val_t second_args[] = {${argumentsSource}}, second = {0};
    wit_ok(${p}_wasmtime_call(session, "${operation(library, entry)}", second_args, ${entry.arguments.length}, &second));
    wit_disjoint(&args[0], &out); wit_disjoint(&second_args[0], &second); wit_disjoint(&out, &second);
    char *before = NULL; size_t size = 0; FILE *copy = open_memstream(&before, &size); assert(copy);
    emit_${key(types.result)}(copy, &second); assert(fclose(copy) == 0);
    wit_mutate(&args[0]); wit_mutate(&out);
    wit_delete(args, ${entry.arguments.length}); wit_delete(second_args, ${entry.arguments.length}); wasmtime_component_val_delete(&out);
    ${p}_wasmtime_close(session); session = NULL;
    char *after = NULL; size_t after_size = 0; copy = open_memstream(&after, &after_size); assert(copy);
    emit_${key(types.result)}(copy, &second); assert(fclose(copy) == 0);
    assert(size == after_size && memcmp(before, after, size) == 0); free(before); free(after);
    out = second; wit_ok(${p}_wasmtime_open(&session));` : `    wit_delete(args, ${entry.arguments.length});`}
    fputs("\\"status\\":\\"matched\\",\\"observed\\":", stdout); emit_${key(types.result)}(stdout, &out);
    fputs(",\\"independentCopy\\":${entry.checkIndependentCopy}}", stdout);
    wasmtime_component_val_delete(&out);` : `    wasmtime_error_t *error = ${call}; wit_error(error, &out);
    fputs("\\"status\\":\\"rejected-as-expected\\",\\"exception\\":\\"WasmtimeError\\",\\"stage\\":\\"public-call\\",\\"outputUnchanged\\":true,\\"message\\":", stdout);
    wit_message(error); wasmtime_error_delete(error); wit_delete(args, ${entry.arguments.length});
    fputs(",\\"recovered\\":true", stdout); recovery(); fputc('}', stdout);`}
  }`;
}).join("\n")}
  fputs("],\\"copiesSurviveSessionClose\\":true,\\"errors\\":[", stdout);
${Object.keys(witRuntimeCases).map((id, index) => `  for (int iteration = 0; iteration < 3; ++iteration) {
    wasmtime_component_val_t args[2] = {{0}, {0}}, out = {.kind = WASMTIME_COMPONENT_U64, .of.u64 = UINT64_MAX};
    wasmtime_component_val_t *inputs = args, *result = &out; ${p}_wasmtime *selected = session;
    const char *name = "${operation(library, entries[0])}"; size_t count = 1;
    ${setup[id]}
    wasmtime_error_t *error = ${p}_wasmtime_call(selected, name, inputs, count, result); wit_error(error, &out);
    if (${index} || iteration) fputc(',', stdout);
    printf("{\\"id\\":\\"${id}\\",\\"iteration\\":%d,\\"exception\\":\\"WasmtimeError\\",\\"outputUnchanged\\":true,\\"message\\":", iteration);
    wit_message(error); wasmtime_error_delete(error); wit_delete(args, 2); recovery(); fputc('}', stdout);
  }`).join("\n")}
  ${p}_wasmtime_close(session); fputc(']', stdout); wit_libraries(); puts("}"); return 0;
}
`;
};

const shape = type => typeof type !== "string" ? type.array ? { list: shape(type.array) } : { record: Object.entries(type.fields).map(([name, type]) => ({ name, type: shape(type) })) }
	: type === "nat" ? { list: "u32" } : type === "int" ? { record: [{ name: "negative", type: "bool" }, { name: "limbs", type: { list: "u32" } }] }
		: type === "bytes" ? { list: "u8" } : type === "unit" ? { enum: ["unit"] } : ({ uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64", int8: "s8", int16: "s16", int32: "s32", int64: "s64", float32: "f32", float64: "f64" })[type] ?? type;

/**
 * Alias-independent WIT signatures specified by the source catalog.
 *
 * @param library - Independent catalog library.
 */
export const corpusWitSignatures = library => corpusSignatures(library).map((signature, index) => ({
	name: library.snakeOperations[index].replaceAll("_", "-")
	, parameters: signature.parameters.map(shape), result: shape(signature.result)
})).sort((a, b) => a.name.localeCompare(b.name));

/**
 * Compare both parsed WIT and parsed binary interfaces with the catalog.
 *
 * @param document - Parsed wasm-tools JSON from installed WIT or component bytes.
 * @param library - Independent catalog library.
 */
export const validateWitSignatures = (document, library) => {
	const resolve = (value, visiting = new Set()) => {
		if(typeof value === "string") return value;
		assert.ok(Number.isInteger(value) && !visiting.has(value));
		const next = new Set(visiting).add(value), type = document.types[value].kind;
		if(type.type !== undefined) return resolve(type.type, next);
		if(type.list !== undefined) return { list: resolve(type.list, next) };
		if(type.record) return { record: type.record.fields.map(field => ({ name: field.name, type: resolve(field.type, next) })) };
		assert.ok(type.enum); return { enum: type.enum.cases.map(entry => entry.name) };
	};
	const interfaces = document.interfaces.filter(entry => ["api", "native"].includes(entry.name));
	assert.equal(interfaces.length, 2);
	assert.equal(document.interfaces.length, 2);
	assert.equal(document.worlds.length, 1);
	for(const [direction, name] of [["imports", "native"], ["exports", "api"]])
		assert.deepEqual(Object.values(document.worlds[0][direction]), [{ interface: { id: document.interfaces.findIndex(entry => entry.name === name) } }]);
	const expected = corpusWitSignatures(library);
	for(const api of interfaces)
	{
		const signatures = Object.values(api.functions).map(fn => {
			assert.equal(fn.kind, "freestanding");
			return { name: fn.name, parameters: fn.params.map(param => resolve(param.type)), result: resolve(fn.result) };
		}).sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(signatures, expected);
	}
	return expected;
};
