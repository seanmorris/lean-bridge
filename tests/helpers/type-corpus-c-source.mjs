/**
 * Independent typed C11/C++20 public callers and observation encoders.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const aggregate = type => typeof type !== "string" || ["nat", "int", "string", "bytes"].includes(type);
const key = type => typeof type === "string" ? type : type.array ? `array_${key(type.array)}` : type.record.split(".").at(-1).toLowerCase();
const scalar = { unit: "uint8_t", bool: "bool", float32: "float", float64: "double" };
const ctype = (library, type) => !aggregate(type) ? scalar[type] ?? `${type}_t` : `${library.cModule}_${key(type)}${type.array ? "_span" : ""}`;
const cpptype = type => typeof type !== "string" ? type.array ? `std::vector<${cpptype(type.array)}>` : `api::${type.record.split(".").at(-1)}`
	: ({ unit: "std::monostate", nat: "api::Nat", int: "api::Int", string: "std::string", bytes: "std::vector<uint8_t>" })[type] ?? scalar[type] ?? `${type}_t`;
const quoted = text => `"${[...Buffer.from(text)].map(byte => `\\${byte.toString(8).padStart(3, "0")}`).join("")}"`;
const limbs = text => {
	let value = BigInt(text); if(value < 0n) value = -value;
	const result = [];
	while(value)
	{ result.push(Number(value & 0xffffffffn)); value >>= 32n; }
	return result;
};
const integer = text => {
	const value = BigInt(text);
	if(value === -(1n << 63n)) return "INT64_MIN";
	if(value < 0n) return `(-INT64_C(${-value}))`;
	if(value > (1n << 64n) - 1n)
	{ assert.equal(value, 1n << 64n); return "(((__uint128_t)UINT64_MAX) + 1)"; }
	return `UINT64_C(${value})`;
};
const types = library => {
	const found = new Map();
	const visit = type => {
		if(type.array) visit(type.array);
		if(type.fields) Object.values(type.fields).forEach(visit);
		found.set(key(type), type);
	};
	corpusSignatures(library).forEach(signature => [...signature.parameters, signature.result].forEach(visit));
	return [...found.values()];
};
const signature = (library, entry) => corpusSignatures(library).find(item => item.name === `${library.module}.${entry.operation}`);
const operation = (library, entry, profile) => `${profile === "cpp" ? "api::" : `${library.cModule}_`}${library.snakeOperations[library.operations.indexOf(entry.operation)]}`;
const header = (library, profile) => `#ifndef _GNU_SOURCE\n#define _GNU_SOURCE\n#endif\n#include "${library.cModule}.${profile === "cpp" ? "hpp" : "h"}"\n#include <stdint.h>\n${profile === "cpp" ? "#include <type_traits>\nnamespace api = lean_bridge::" + library.cModule + ";\n" : ""}`;

const cppValue = (wire, type) => {
	if(wire.integer !== undefined)
	{
		if(["nat", "int"].includes(type)) return `api::${type === "int" ? "Int" : "Nat"}("${wire.integer}")`;
		return `${typeof type === "string" && /^(?:u?int)\d+$/.test(type) ? cpptype(type) : "int64_t"}{${integer(wire.integer)}}`;
	}
	if(wire.string !== undefined) return `std::string(${quoted(wire.string)}, ${Buffer.byteLength(wire.string)})`;
	if(wire.bool !== undefined) return String(wire.bool);
	if(wire.unit !== undefined) return "std::monostate{}";
	if(wire.bytes) return `std::vector<uint8_t>{${wire.bytes.join(", ")}}`;
	if(wire.array) return `${cpptype(type)}{${wire.array.map(item => cppValue(item, type.array)).join(", ")}}`;
	if(wire.record) return `${cpptype(type)}{${Object.entries(type.fields).map(([name, field]) => cppValue(wire.fields[name], field)).join(", ")}}`;
	for(const [kind, bits] of [["float32", 32], ["float64", 64]]) if(wire[kind] !== undefined)
		return `wire_from_f${bits}(UINT${bits}_C(${wire[kind] === "nan" ? bits === 32 ? "2143289344" : "9221120237041090560" : wire[kind]}))`;
	assert.fail("Unknown C++ corpus input");
};
const cValue = (library, wire, type, name) => {
	const lines = [];
	let actual = type, expression;
	if(wire.integer !== undefined)
	{
		if(["nat", "int"].includes(type))
		{
			if(wire.integer.startsWith("-")) actual = "int";
			const words = limbs(wire.integer);
			if(words.length) lines.push(`uint32_t ${name}_data[] = {${words.map(value => `UINT32_C(${value})`).join(", ")}};`);
			expression = `{${words.length ? `${name}_data` : "NULL"}, ${words.length}, NULL, NULL${actual === "int" ? `, ${wire.integer.startsWith("-")}` : ""}}`;
		} else
		{
			if(typeof type !== "string" || !/^(?:u?int)\d+$/.test(type)) actual = "int64";
			expression = integer(wire.integer);
		}
	} else if(wire.string !== undefined)
	{
		lines.push(`char ${name}_data[] = ${quoted(wire.string)};`);
		expression = `{${name}_data, ${Buffer.byteLength(wire.string)}, NULL, NULL}`;
	} else if(wire.bool !== undefined)
	{ actual = "bool"; expression = String(wire.bool); }
	else if(wire.unit !== undefined)
	{ actual = "unit"; expression = "0"; }
	else if(wire.bytes)
	{
		if(wire.bytes.length) lines.push(`uint8_t ${name}_data[] = {${wire.bytes.join(", ")}};`);
		expression = `{${wire.bytes.length ? `${name}_data` : "NULL"}, ${wire.bytes.length}, NULL, NULL}`;
	} else if(wire.array)
	{
		wire.array.forEach((item, i) => lines.push(cValue(library, item, type.array, `${name}_${i}`)));
		if(wire.array.length) lines.push(`${ctype(library, type.array)} ${name}_data[] = {${wire.array.map((_, i) => `${name}_${i}`).join(", ")}};`);
		expression = `{${wire.array.length ? `${name}_data` : "NULL"}, ${wire.array.length}, NULL, NULL}`;
	} else if(wire.record)
	{
		for(const [field, fieldType] of Object.entries(type.fields)) lines.push(cValue(library, wire.fields[field], fieldType, `${name}_${field}`));
		expression = `{${Object.keys(type.fields).map(field => `${name}_${field}`).join(", ")}}`;
	} else for(const [kind, bits] of [["float32", 32], ["float64", 64]]) if(wire[kind] !== undefined)
		expression = `wire_from_f${bits}(UINT${bits}_C(${wire[kind] === "nan" ? bits === 32 ? "2143289344" : "9221120237041090560" : wire[kind]}))`;
	assert.ok(expression);
	lines.push(`${ctype(library, actual)} ${name} = ${expression};`);
	return lines.join("\n");
};
const bindings = (library, entry, profile) => entry.arguments.map((wire, i) => profile === "cpp"
	? `auto arg${i} = ${cppValue(wire, signature(library, entry).parameters[i])};`
	: cValue(library, wire, signature(library, entry).parameters[i], `arg${i}`)).join("\n");
const call = (library, entry, profile) => {
	const sig = signature(library, entry);
	const args = sig.parameters.map((type, i) => `${profile === "c" && aggregate(type) ? "&" : ""}arg${i}`);
	if(profile === "c") args.push(...sig.result === "unit" ? [] : ["&result"], "&error");
	return `${operation(library, entry, profile)}(${args.join(", ")})`;
};

/**
 * Require exact public function types independently of generated declarations.
 *
 * @param library - Catalog library.
 * @param profile - C or C++ profile.
 */
export const corpusCFamilySignatures = (library, profile) => corpusSignatures(library).map((sig, i) => {
	if(profile === "cpp") return `static_assert(std::is_same_v<decltype(&api::${library.snakeOperations[i]}), ${sig.result === "unit" ? "void" : cpptype(sig.result)} (*)(${sig.parameters.map(type => `${cpptype(type)}${aggregate(type) ? " const&" : ""}`).join(", ")})>);`;
	const args = [...sig.parameters.map(type => `${aggregate(type) ? "const " : ""}${ctype(library, type)}${aggregate(type) ? " *" : ""}`), ...sig.result === "unit" ? [] : [`${ctype(library, sig.result)} *`], `${library.cModule}_error *`];
	return `_Static_assert(_Generic(&${library.cModule}_${library.snakeOperations[i]}, ${library.cModule}_status (*)(${args.join(", ")}): 1, default: 0), "exact signature");`;
}).join("\n");

/**
 * Generate only the invalid input and public call; diagnostics must point here.
 *
 * @param library - Catalog library.
 * @param entry - Shared input case.
 * @param profile - C or C++ profile.
 */
export const corpusCFamilyRejection = (library, entry, profile) => {
	assert.equal(corpusHostCase(entry, profile).expectation.kind, "compile-rejection");
	const type = signature(library, entry).result;
	return `${header(library, profile)}int main(void) {\n${bindings(library, entry, profile)}\n${profile === "c" ? `${library.cModule}_error error = {0};\n${type === "unit" ? "" : `${ctype(library, type)} result = {0};`}` : ""}\n(void)${call(library, entry, profile)};\nreturn 0;\n}\n`;
};

const encoders = (library, profile) => types(library).map(type => {
	const pointer = "value", value = "(*value)", cpp = profile === "cpp";
	const data = cpp ? `${value}.data()` : `${value}.data`;
	const length = cpp ? `${value}.size()` : `${value}.length`;
	let body;
	if(type.array) body = `fputs(${JSON.stringify('{"array":[')}, out); for (size_t i = 0; i < ${cpp ? `${value}.size()` : `${value}.length`}; ++i) { if(i) fputc(',', out); encode_${key(type.array)}(out, &${cpp ? `${value}[i]` : `${value}.data[i]`}); } fputs("]}", out);`;
	else if(type.record) body = `fputs(${JSON.stringify(`{"record":"${type.record.split(".").at(-1)}","fields":{`)}, out); ${Object.entries(type.fields).map(([name, field], i) => `fputs(${JSON.stringify(`${i ? "," : ""}"${name}":`)}, out); encode_${key(field)}(out, &${value}.${name});`).join(" ")} fputs("}}", out);`;
	else if(["nat", "int"].includes(type)) body = cpp ? `auto text = value->str(); fputs(${JSON.stringify('{"integer":')}, out); wire_quote(out, text.data(), text.size()); fputc('}', out);` : `wire_big(out, ${data}, ${length}, ${type === "int" ? `${value}.negative` : "false"});`;
	else if(type === "string") body = `fputs(${JSON.stringify('{"string":')}, out); wire_quote(out, ${data}, ${length}); fputc('}', out);`;
	else if(type === "bytes") body = `fputs(${JSON.stringify('{"bytes":[')}, out); for(size_t i = 0; i < ${length}; ++i) { if(i) fputc(',', out); fprintf(out, "%u", (unsigned)${data}[i]); } fputs("]}", out);`;
	else if(type === "unit") body = `(void)${pointer}; fputs(${JSON.stringify('{"unit":true}')}, out);`;
	else if(type === "bool") body = `fputs(${value} ? ${JSON.stringify('{"bool":true}')} : ${JSON.stringify('{"bool":false}')}, out);`;
	else if(type.startsWith("float")) body = `wire_${type}(out, ${value});`;
	else body = `fprintf(out, ${JSON.stringify('{"integer":"%')} PRI${type.startsWith("uint") ? "u" : "d"}64 ${JSON.stringify('"}')}, (${type.startsWith("uint") ? "uint64_t" : "int64_t"})${value});`;
	return `static inline void encode_${key(type)}(FILE *out, const ${cpp ? cpptype(type) : ctype(library, type)} *value) { ${body} }\nstatic inline char *snapshot_${key(type)}(const ${cpp ? cpptype(type) : ctype(library, type)} *value) { char *data = NULL; size_t length = 0; FILE *out = open_memstream(&data, &length); assert(out); encode_${key(type)}(out, value); assert(fclose(out) == 0); return data; }`;
}).join("\n");

/**
 * Required installed runtime failures, separate from compiler rejection cases.
 *
 * @param profile - C or C++ profile.
 */
export const corpusCFamilyRuntimeCases = profile => ["invalid-utf8", "string-limit", "record-utf8", ...(profile === "c" ? ["null-span", "null-output", "unit-marker", "nested-null"] : [])];

/**
 * Reject unrelated compiler/header/linker failures as invalid-input evidence.
 *
 * @param diagnostic - Full GCC diagnostic with normalized category.
 * @param profile - C or C++ profile.
 * @param expected - Catalog rejection category.
 */
export const validateCFamilyDiagnostic = (diagnostic, profile, expected) => {
	assert.equal(diagnostic.code, expected);
	if(expected === "narrowing")
	{
		assert.match(diagnostic.message, /(?:overflow|narrowing conversion|unsigned conversion|conversion from)/i);
		assert.ok((profile === "c" ? ["-Werror=overflow", "-Werror=conversion", "-Werror=sign-conversion"] : ["-Wnarrowing", "-Werror=narrowing"]).includes(diagnostic.option));
	} else
	{
		assert.equal(expected, "incompatible-type");
		assert.match(diagnostic.message, /(?:incompatible pointer type|incompatible types|incompatible type for argument|invalid initializer|invalid initialization|could not convert|cannot convert|no matching function)/i);
	}
};

const clear = (library, type) => {
	if(!aggregate(type)) return "";
	const fields = type.record ? Object.entries(type.fields).filter(([, type]) => aggregate(type)).map(([name]) => `.${name}`) : [""];
	return `${fields.map((field, i) => `WIRE_WATCH(result${field}, watch${i});`).join("\n")}\n${ctype(library, type)}_clear(&result);\n${ctype(library, type)}_clear(&result);\n${fields.map((field, i) => `WIRE_CLEARED(result${field}, watch${i});`).join("\n")}`;
};
const runtimeChecks = (library, profile) => {
	const p = library.cModule, upper = p.toUpperCase(), cpp = profile === "cpp";
	const record = corpusCases(library).find(entry => entry.id.endsWith("/record"));
	const recType = signature(library, record).result;
	const title = Object.keys(recType.fields).find(name => recType.fields[name] === "string");
	const names = library.snakeOperations;
	return corpusCFamilyRuntimeCases(profile).map(id => {
		let setup, invoke, unchanged = "";
		if(id === "record-utf8")
		{
			setup = bindings(library, record, profile) + (cpp ? `\narg0.${title} = std::string("\\300\\200", 2);` : `\narg0.${title}.data = "\\300\\200"; arg0.${title}.length = 2;\n${ctype(library, recType)} result = {0};`);
			invoke = cpp ? `api::${names[6]}(arg0)` : `${p}_${names[6]}(&arg0, &result, &error)`;
			if(!cpp) unchanged = `assert(result.${title}.data == NULL); ${p}_${recType.record.split(".").at(-1).toLowerCase()}_clear(&result);`;
		} else if(id === "unit-marker")
		{
			setup = ""; invoke = `${p}_${names[10]}(1, &error)`;
		} else if(id === "nested-null")
		{
			setup = `${p}_array_array_uint32_span bad = {NULL, 1, NULL, NULL}, result = {0};`;
			invoke = `${p}_${names[5]}(&bad, &result, &error)`;
			unchanged = `assert(result.data == NULL); ${p}_array_array_uint32_span_clear(&result);`;
		} else
		{
			const expr = id === "string-limit" ? cpp ? "std::string(16 * 1024 * 1024 + 1, 'x')" : "NULL" : cpp ? 'std::string("\\300\\200", 2)' : '"\\300\\200"';
			setup = cpp ? `auto bad = ${expr};` : `const char sentinel[] = "held"; ${p}_string result = {sentinel, 4, NULL, NULL}, empty = {0};\n${p}_string bad = {${id === "null-span" ? "NULL" : expr}, ${id === "string-limit" ? "16 * 1024 * 1024 + 1" : id === "null-span" ? "1" : "2"}, NULL, NULL};`;
			if(!cpp && id === "string-limit") setup += `\nchar *large = (char *)malloc(bad.length); assert(large); memset(large, 'x', bad.length); bad.data = large;`;
			invoke = cpp ? `api::${names[3]}(bad, "")` : `${p}_${names[3]}(${id === "null-output" ? "&empty" : "&bad"}, &empty, ${id === "null-output" ? "NULL" : "&result"}, &error)`;
			if(!cpp) unchanged = `assert(result.data == sentinel && result.length == 4 && result.release == NULL); ${p}_string_clear(&result); ${id === "string-limit" ? "free(large);" : ""}`;
			if(id === "null-output") setup += "\n(void)bad;";
		}
		return `for (unsigned iteration = 0; iteration < 3; ++iteration) {\n${setup}\n${cpp ? `bool rejected = false; try { (void)${invoke}; } catch(const api::Error& error) { rejected = error.status == ${upper}_STATUS_INVALID_ARGUMENT && error.code == ${upper}_ERROR_INVALID_ARGUMENT; } assert(rejected);\nuint32_t recovered = api::${names[0]}(7);` : `${p}_error error = {0}; assert(${invoke} == ${upper}_STATUS_INVALID_ARGUMENT); assert(error.code == ${upper}_ERROR_INVALID_ARGUMENT);\n${unchanged}\nuint32_t recovered = 0; assert(${p}_${names[0]}(7, &recovered, &error) == ${upper}_STATUS_OK); assert(error.code == ${upper}_ERROR_NONE);`}\nif (errors++) { fputc(',', stdout); } printf(${JSON.stringify(`{"id":"${id}","iteration":%u,"exception":"INVALID_ARGUMENT","recovery":`)}, iteration); encode_uint32(stdout, &recovered); fputc('}', stdout);\n}`;
	}).join("\n");
};

/**
 * Emit observations and check independent ownership using public values only.
 *
 * @param library - Catalog library.
 * @param profile - C or C++ profile.
 */
export const corpusCFamilySource = (library, profile) => {
	const cpp = profile === "cpp", p = library.cModule;
	const blocks = corpusCases(library).map(entry => corpusHostCase(entry, profile)).filter(entry => entry.expectation.kind === "lean-oracle").map(entry => {
		const type = signature(library, entry).result, copy = entry.checkIndependentCopy;
		let ownership = "";
		if(copy)
		{
			const fields = Object.entries(type.fields), matrix = fields.find(([, type]) => type.array)[0];
			const text = fields.find(([, type]) => type === "string")[0], nat = fields.find(([, type]) => type === "nat")[0], int = fields.find(([, type]) => type === "int")[0];
			const mutate = name => `for (auto& row : ${name}.${matrix}) { row.push_back(17); } ${name}.${text}[0] = 'X'; ${name}.${nat} += 17; ${name}.${int} -= 17;`;
			ownership = `char *after = snapshot_${key(type)}(&arg0); assert(strcmp(before, after) == 0); free(before); free(after);\n${cpp ? mutate("arg0") : `assert(result.${matrix}.data != arg0.${matrix}.data && result.${matrix}.data[0].data != arg0.${matrix}.data[0].data);\narg0_${matrix}_0_data[0] ^= 17; arg0_${text}_data[0] = 'X'; arg0_${nat}_data[0] ^= 17; arg0_${int}_data[0] ^= 17;`}\nchar *independent = snapshot_${key(type)}(&result); assert(strcmp(observed, independent) == 0); free(independent);\nchar *changed = snapshot_${key(type)}(&arg0);\n${cpp ? mutate("result") : clear(library, type)}\nchar *still = snapshot_${key(type)}(&arg0); assert(strcmp(changed, still) == 0); free(changed); free(still);`;
		}
		return `{\n${bindings(library, entry, profile)}\n${copy ? `char *before = snapshot_${key(type)}(&arg0);` : ""}\n${cpp ? type === "unit" ? `${call(library, entry, profile)}; std::monostate result{};` : `auto result = ${call(library, entry, profile)};` : `${p}_error error = {0}; ${ctype(library, type)} result = {0}; assert(${call(library, entry, profile)} == ${p.toUpperCase()}_STATUS_OK); assert(error.code == ${p.toUpperCase()}_ERROR_NONE);`}\nchar *observed = snapshot_${key(type)}(&result);\n${ownership}\nif (results++) { fputc(',', stdout); } fputs(${JSON.stringify(`{"id":"${entry.id}","status":"matched","independentCopy":${copy},"observed":`)}, stdout); fputs(observed, stdout); fputc('}', stdout); free(observed);\n${!cpp && !copy ? clear(library, type) : ""}\n}`;
	});
	if(cpp) for(const entry of corpusCases(library).map(entry => corpusHostCase(entry, profile)).filter(entry => entry.expectation.kind === "host-rejection"))
		blocks.push(`{\n${bindings(library, entry, profile)}\nbool rejected = false; std::string message;
try { (void)${call(library, entry, profile)}; } catch(const api::Error& error) { rejected = error.status == ${p.toUpperCase()}_STATUS_INVALID_ARGUMENT; message = error.what(); }
assert(rejected); (void)api::${library.snakeOperations[0]}(7);
if (results++) { fputc(',', stdout); } fputs(${JSON.stringify(`{"id":"${entry.id}","status":"rejected-as-expected","exception":"Error","recovered":true,"message":`)}, stdout); wire_quote(stdout, message.data(), message.size()); fputc('}', stdout);\n}`);
	return `${header(library, profile)}#include "c-family.h"\n${corpusCFamilySignatures(library, profile)}\n${encoders(library, profile)}\nint main(void) {\nunsigned results = 0, errors = 0;\nfputs(${JSON.stringify(`{"schemaVersion":1,"profile":"${profile}","module":"${p}","results":[`)}, stdout);\n${blocks.join("\n")}\nfputs(${JSON.stringify('],"errors":[')}, stdout);\n${runtimeChecks(library, profile)}\nfputs("]}\\n", stdout); return 0;\n}\n`;
};
