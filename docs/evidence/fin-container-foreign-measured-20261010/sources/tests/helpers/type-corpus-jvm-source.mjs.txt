/**
 * Independent Java and Kotlin callers over public installed JVM declarations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const scalar = { unit: "Unit", bool: "boolean", uint8: "int", uint16: "int", uint32: "long", uint64: "BigInteger", int8: "byte", int16: "short", int32: "int", int64: "long", nat: "BigInteger", int: "BigInteger", float32: "float", float64: "double", string: "String", bytes: "byte[]" };
const kotlinTypes = { Unit: "LeanUnit", boolean: "Boolean", int: "Int", long: "Long", byte: "Byte", short: "Short", float: "Float", double: "Double", String: "String", BigInteger: "BigInteger", "byte[]": "ByteArray" };
const typeName = (type, profile) => {
	if(typeof type === "string") return profile === "java" ? scalar[type] : kotlinTypes[scalar[type]];
	if(type.record) return type.record.split(".").at(-1);
	const item = typeName(type.array, profile);
	return profile === "java" ? `${item}[]` : ["Boolean", "Int", "Long", "Byte", "Short", "Float", "Double"].includes(item) ? `${item}Array` : `Array<${item}>`;
};
const header = (library, profile) => profile === "java"
	? `import ${library.jvmModule}.*;\nimport java.math.BigInteger;\npublic final class Consumer {\n`
	: `import ${library.jvmModule}.*\nimport ${library.jvmModule}.Unit as LeanUnit\nimport java.math.BigInteger\n`;
const signature = (library, entry) => corpusSignatures(library).find(sig => sig.name === `${library.module}.${entry.operation}`);
const value = (wire, type, profile) => {
	const java = profile === "java";
	if(wire.integer !== undefined)
	{
		const number = BigInt(wire.integer);
		if(["nat", "int", "uint64"].includes(type)) return `${java ? "new " : ""}BigInteger(${JSON.stringify(wire.integer)})`;
		if(type === "int8" && number >= -128n && number <= 127n) return java ? `(byte)${number}` : `(${number}).toByte()`;
		if(type === "int16" && number >= -32768n && number <= 32767n) return java ? `(short)${number}` : `(${number}).toShort()`;
		if(type === "int64" && number === -(1n << 63n)) return "Long.MIN_VALUE";
		return ["uint32", "int64"].includes(type) || number > 2147483647n || number < -2147483648n ? `${number}L` : `${number}`;
	}
	if(wire.string !== undefined) return JSON.stringify(wire.string).replaceAll("$", java ? "$" : "\\$");
	if(wire.bool !== undefined) return String(wire.bool);
	if(wire.unit !== undefined) return java ? "Unit.INSTANCE" : "LeanUnit.INSTANCE";
	if(wire.bytes) return java ? `new byte[] {${wire.bytes.map(byte => byte > 127 ? byte - 256 : byte).join(", ")}}` : `byteArrayOf(${wire.bytes.map(byte => byte > 127 ? byte - 256 : byte).join(", ")})`;
	if(wire.array)
	{
		const items = wire.array.map(item => value(item, type.array, profile)).join(", ");
		if(java) return `new ${typeName(type, profile)} {${items}}`;
		const name = typeName(type, profile);
		return name.startsWith("Array<") ? `arrayOf<${typeName(type.array, profile)}>(${items})` : `${name[0].toLowerCase()}${name.slice(1)}Of(${items})`;
	}
	if(wire.record) return `${java ? "new " : ""}${typeName(type, profile)}(${Object.entries(type.fields).map(([field, type]) => value(wire.fields[field], type, profile)).join(", ")})`;
	if(wire.float32 !== undefined) return wire.float32 === "nan" ? "Float.NaN" : java ? `Float.intBitsToFloat((int)${wire.float32}L)` : `Float.fromBits(${wire.float32}L.toInt())`;
	if(wire.float64 !== undefined) return wire.float64 === "nan" ? "Double.NaN" : java ? `Double.longBitsToDouble(Long.parseUnsignedLong("${wire.float64}"))` : `Double.fromBits(java.lang.Long.parseUnsignedLong("${wire.float64}"))`;
	assert.fail("Unknown JVM corpus input");
};
const bindings = (library, entry, profile) => entry.arguments.map((input, i) => `${profile === "java" ? "var" : "val"} arg${i} = ${value(input, signature(library, entry).parameters[i], profile)};`).join("\n");
const call = (entry) => `Api.${entry.operation}(${entry.arguments.map((_, i) => `arg${i}`).join(", ")})`;
const encode = (type, expression, profile, depth = 0) => {
	if(type.array) return profile === "java"
		? `Wire.array(${expression}, value${depth} -> ${encode(type.array, `value${depth}`, profile, depth + 1)})`
		: `Wire.array(${expression}) { value${depth} -> ${encode(type.array, `value${depth}`, profile, depth + 1)} }`;
	if(type.record) return `Wire.map("record", ${JSON.stringify(type.record.split(".").at(-1))}, "fields", Wire.map(${Object.entries(type.fields).map(([field, type]) => `${JSON.stringify(field)}, ${encode(type, `${expression}.${field}()`, profile, depth)}`).join(", ")}))`;
	return type === "unit" ? "Wire.unit()" : `Wire.${({ string: "text", bool: "bool", bytes: "bytes", float32: "f32", float64: "f64" })[type] ?? "integer"}(${expression})`;
};
const className = (type, profile) => {
	if(profile === "java") return `${type === "void" ? "void" : typeName(type, profile)}.class`;
	if(type === "void") return "java.lang.Void.TYPE";
	const mapped = typeName(type, profile);
	return ({ Boolean: "java.lang.Boolean.TYPE", Byte: "java.lang.Byte.TYPE", Short: "java.lang.Short.TYPE", Int: "java.lang.Integer.TYPE", Long: "java.lang.Long.TYPE", Float: "java.lang.Float.TYPE", Double: "java.lang.Double.TYPE" })[mapped] ?? `${mapped}::class.java`;
};

/**
 * Public reflection and Kotlin function-reference types, independent of generated sources.
 *
 * @param library - Shared library catalog.
 * @param profile - Java or Kotlin.
 */
export const corpusJvmSignatures = (library, profile) => {
	const signatures = corpusSignatures(library), record = signatures.find(sig => sig.result.record).result;
	const api = profile === "java" ? "Api.class" : "Api::class.java";
	const lines = signatures.map((sig, i) => `${profile === "kotlin" ? `val signature${i}: (${sig.parameters.map(type => typeName(type, profile)).join(", ")}) -> ${sig.result === "unit" ? "kotlin.Unit" : typeName(sig.result, profile)} = Api::${sig.name.split(".").at(-1)}; Wire.consume(signature${i});\n` : ""}Wire.method(${api}, ${JSON.stringify(sig.name.split(".").at(-1))}, ${className(sig.result === "unit" ? "void" : sig.result, profile)}, ${sig.parameters.map(type => className(type, profile)).join(", ")});`);
	const names = Object.keys(record.fields).map(field => JSON.stringify(field)).join(", "), types = Object.values(record.fields).map(type => className(type, profile)).join(", ");
	return `Wire.check(${api}.getDeclaredMethods()${profile === "java" ? ".length" : ".size"} == ${signatures.length});\n${lines.join("\n")}\nWire.record(${className(record, profile)}, ${profile === "java" ? `new String[] {${names}}, new Class<?>[] {${types}}` : `arrayOf(${names}), arrayOf(${types})`});`;
};

/**
 * Compile one invalid call against the installed public API.
 *
 * @param library - Shared library catalog.
 * @param entry - Invalid catalog input.
 * @param profile - Java or Kotlin.
 */
export const corpusJvmRejection = (library, entry, profile) => {
	assert.equal(corpusHostCase(entry, profile).expectation.kind, "compile-rejection");
	return `${header(library, profile).replace("public final class Consumer", "final class RejectedInput")}${profile === "java" ? "static void rejected() {" : "fun rejected() {"}\n${bindings(library, entry, profile)}\n${call(entry)};\n}${profile === "java" ? "\n}" : ""}\n`;
};

export const jvmRuntimeCases = Object.freeze({
	"null-string": "NullPointerException", "null-bytes": "NullPointerException"
	, "null-array": "NullPointerException", "null-record": "NullPointerException"
	, "null-nested": "NullPointerException", "null-unit": "NullPointerException"
	, "null-nat": "NullPointerException"
	, "malformed-utf16": "IllegalArgumentException"
	, "record-utf16": "IllegalArgumentException"
	, "bytes-limit": "IllegalArgumentException"
	, "string-limit": "IllegalArgumentException"
	, "output-limit": "IllegalArgumentException"
});

/**
 * Emit public observations, storage checks and error recovery without oracle values.
 *
 * @param library - Shared library catalog.
 * @param profile - Java or Kotlin.
 */
export const corpusJvmSource = (library, profile) => {
	const java = profile === "java", cases = corpusCases(library).map(entry => corpusHostCase(entry, profile));
	const record = cases.find(entry => entry.checkIndependentCopy), recordType = signature(library, record).result;
	const matrix = Object.keys(recordType.fields).find(field => recordType.fields[field].array);
	const names = library.operations, recovery = `Wire.integer(Api.${names[0]}(7L))`;
	const declare = java ? "var" : "val", scope = body => java ? `{\n${body}\n}` : `run {\n${body}\n}`;
	const reject = (error, call) => java ? `Wire.reject(${error}.class, () -> ${call})` : `Wire.reject(${error}::class.java) { ${call} }`;
	const blocks = cases.filter(entry => entry.expectation.kind !== "compile-rejection").map(entry => {
		const type = signature(library, entry).result;
		if(entry.expectation.kind === "host-rejection") return scope(`${bindings(library, entry, profile)}\n${declare} error = ${reject("IllegalArgumentException", call(entry))};\nWire.rejected(${JSON.stringify(entry.id)}, error, ${recovery});`);
		const copy = entry.checkIndependentCopy, input = encode(type, "arg0", profile), result = encode(type, "result", profile);
		return scope(`${bindings(library, entry, profile)}\n${copy ? `${declare} before = Wire.json(${input});` : ""}\n${type === "unit" ? `${call(entry)};` : `${declare} result = ${call(entry)};`}\n${declare} observed = ${result};\n${copy ? `Wire.check(before.equals(Wire.json(${input})));
Wire.check(${java ? `arg0 != result && arg0.${matrix}() != result.${matrix}()` : `arg0 !== result && arg0.${matrix}() !== result.${matrix}()`});
${declare} saved = Wire.json(observed);
arg0.${matrix}()[0][0] = 17L;
arg0.${matrix}()[1] = ${java ? "new long[] {29L}" : "longArrayOf(29L)"};
Wire.check(saved.equals(Wire.json(${result})));
${declare} changed = Wire.json(${input});
${java ? `for (var row : result.${matrix}()) if (row.length > 0) row[0] = 31L;` : `for (row in result.${matrix}()) if (row.isNotEmpty()) row[0] = 31L;`}
result.${matrix}()[0] = ${java ? "new long[] {47L}" : "longArrayOf(47L)"};
Wire.check(changed.equals(Wire.json(${input})));` : ""}\nWire.result(${JSON.stringify(entry.id)}, observed, ${copy});`);
	});
	const malformed = '"\\ud800"';
	const badRecord = structuredClone(record), title = Object.keys(recordType.fields).find(field => recordType.fields[field] === "string");
	badRecord.arguments[0].fields[title].string = "\ud800";
	const bad = {
		"null-string": `Api.${names[3]}(null, "")`
		, "null-bytes": `Api.${names[11]}(null)`
		, "null-array": `Api.${names[4]}(null, 0L)`
		, "null-record": `Api.${names[6]}(null)`
		, "null-nested": `Api.${names[5]}(${java ? "new long[][] {null}" : "arrayOfNulls<LongArray>(1)"})`
		, "null-unit": `Api.${names[10]}(null)`
		, "null-nat": `Api.${names[1]}(null, 0L)`
		, "malformed-utf16": `Api.${names[3]}(${malformed}, "")`
		, "record-utf16": call(badRecord)
		, "bytes-limit": `Api.${names[11]}(${java ? "new byte[16 * 1024 * 1024 + 1]" : "ByteArray(16 * 1024 * 1024 + 1)"})`
		, "string-limit": `Api.${names[3]}("x".repeat(16 * 1024 * 1024 + 1), "")`
		, "output-limit": `Api.${names[3]}("x".repeat(4 * 1024 * 1024), "y".repeat(4 * 1024 * 1024))`
	};
	const errors = Object.entries(jvmRuntimeCases).map(([id, error]) => `${java ? "for (int iteration = 0; iteration < 3; ++iteration) {" : "for (iteration in 0 until 3) {"}\n${id === "record-utf16" ? bindings(library, badRecord, profile) : ""}\n${declare} error = ${reject(error, bad[id])};\nWire.error(${JSON.stringify(id)}, iteration, error, ${recovery});\n}`).join("\n");
	return `${header(library, profile)}${java ? "public static void main(String[] args) throws Exception {" : "fun main() {"}\n${corpusJvmSignatures(library, profile)}\n${blocks.join("\n")}\n${errors}\nWire.finish(${JSON.stringify(profile)}, ${JSON.stringify(library.jvmModule)}, ${java ? 'System.getProperty("java.version")' : "KotlinVersion.CURRENT.toString()"}, ${java ? "Api.class" : "Api::class.java"});\n}${java ? "\n}" : ""}\n`;
};
