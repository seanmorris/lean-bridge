/**
 * Independently typed C# callers, public declaration checks and invalid programs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusCases, corpusHostCase, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const pascal = value => value[0].toUpperCase() + value.slice(1);
const scalar = { unit: "Unit", bool: "bool", uint8: "byte", uint16: "ushort", uint32: "uint", uint64: "ulong", int8: "sbyte", int16: "short", int32: "int", int64: "long", nat: "BigInteger", int: "BigInteger", float32: "float", float64: "double", string: "string", bytes: "byte[]" };
const typeName = type => typeof type === "string" ? scalar[type] : type.array ? `${typeName(type.array)}[]` : type.record.split(".").at(-1);
const header = library => `using System;\nusing System.Linq;\nusing System.Numerics;\nusing System.Globalization;\nusing System.Reflection;\nusing System.Text.Json;\nusing ${library.dotnetModule};\n`;
const signature = (library, entry) => corpusSignatures(library).find(sig => sig.name === `${library.module}.${entry.operation}`);
const literal = text => BigInt(text) > (1n << 63n) - 1n ? `${text}UL` : `${text}L`;
const value = (wire, type) => {
	if(wire.integer !== undefined)
	{
		if(["nat", "int"].includes(type)) return `BigInteger.Parse(${JSON.stringify(wire.integer)}, CultureInfo.InvariantCulture)`;
		if(BigInt(wire.integer) === 1n << 64n) return "checked(ulong.MaxValue + 1UL)";
		return typeof type === "string" && /^(?:u?int)\d+$/.test(type) ? `checked((${typeName(type)})(${literal(wire.integer)}))` : literal(wire.integer);
	}
	if(wire.string !== undefined) return JSON.stringify(wire.string);
	if(wire.bool !== undefined) return String(wire.bool);
	if(wire.unit !== undefined) return "default(Unit)";
	if(wire.bytes) return `new byte[] {${wire.bytes.join(", ")}}`;
	if(wire.array) return `new ${typeName(type)} {${wire.array.map(item => value(item, type.array)).join(", ")}}`;
	if(wire.record) return `new ${typeName(type)}(${Object.entries(type.fields).map(([name, type]) => value(wire.fields[name], type)).join(", ")})`;
	if(wire.float32 !== undefined) return wire.float32 === "nan" ? "float.NaN" : `BitConverter.UInt32BitsToSingle(${wire.float32}U)`;
	if(wire.float64 !== undefined) return wire.float64 === "nan" ? "double.NaN" : `BitConverter.UInt64BitsToDouble(${wire.float64}UL)`;
	assert.fail("Unknown C# corpus input");
};
const bindings = (library, entry) => entry.arguments.map((input, i) => `var arg${i} = ${value(input, signature(library, entry).parameters[i])};`).join("\n");
const call = (library, entry) => `Api.${pascal(entry.operation)}(${entry.arguments.map((_, i) => `arg${i}`).join(", ")})`;
const encode = (type, expression, depth = 0) => {
	if(type.array) return `Wire.Array(${expression}, value${depth} => ${encode(type.array, `value${depth}`, depth + 1)})`;
	if(type.record) return `new { record = ${JSON.stringify(type.record.split(".").at(-1))}, fields = new { ${Object.entries(type.fields).map(([field, type]) => `@${field} = ${encode(type, `${expression}.${pascal(field)}`, depth)}`).join(", ")} } }`;
	return type === "unit" ? "Wire.Unit()" : `Wire.${({ string: "Text", bool: "Boolean", bytes: "Bytes", float32: "F32", float64: "F64" })[type] ?? "Integer"}(${expression})`;
};

/**
 * Exact reflection checks complement independently typed public C# calls.
 *
 * @param library - Catalog library, never generated metadata.
 */
export const corpusDotnetSignatures = library => {
	const signatures = corpusSignatures(library), record = signatures.find(sig => sig.result.record).result;
	return `Wire.Check(typeof(Api).GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly).Length == ${signatures.length});\n${signatures.map(sig => `Wire.Method(typeof(Api), ${JSON.stringify(pascal(sig.name.split(".").at(-1)))}, typeof(${sig.result === "unit" ? "void" : typeName(sig.result)}), ${sig.parameters.map(type => `typeof(${typeName(type)})`).join(", ")});`).join("\n")}\nWire.Record(typeof(${typeName(record)}), new string[] {${Object.keys(record.fields).map(name => JSON.stringify(pascal(name))).join(", ")}}, new Type[] {${Object.values(record.fields).map(type => `typeof(${typeName(type)})`).join(", ")}});`;
};

/**
 * One invalid catalog input per source file, compiled against the installed DLL.
 *
 * @param library - Catalog library.
 * @param entry - Compiler-rejected input.
 */
export const corpusDotnetRejection = (library, entry) => {
	assert.equal(corpusHostCase(entry, "dotnet").expectation.kind, "compile-rejection");
	return `${header(library)}public static class RejectedInput { public static void Call() {\n${bindings(library, entry)}\n${call(library, entry)};\n} }\n`;
};

export const dotnetRuntimeCases = Object.freeze({
	"null-string": "ArgumentNullException", "null-bytes": "ArgumentNullException"
	, "null-array": "ArgumentNullException", "null-record": "ArgumentNullException"
	, "null-nested": "ArgumentNullException"
	, "malformed-utf16": "EncoderFallbackException"
	, "record-utf16": "EncoderFallbackException"
	, "bytes-limit": "ArgumentException"
	, "string-limit": "ArgumentException", "output-limit": "ArgumentException"
});

/**
 * Emit actual observations; expected Lean results are never embedded here.
 *
 * @param library - Independent library and input catalog.
 */
export const corpusDotnetSource = library => {
	const cases = corpusCases(library).map(entry => corpusHostCase(entry, "dotnet"));
	const record = cases.find(entry => entry.checkIndependentCopy), recordType = signature(library, record).result;
	const matrix = pascal(Object.keys(recordType.fields).find(field => recordType.fields[field].array));
	const title = pascal(Object.keys(recordType.fields).find(field => recordType.fields[field] === "string"));
	const names = library.operations.map(pascal), recovery = `Wire.Integer(Api.${names[0]}(7))`;
	const blocks = cases.filter(entry => entry.expectation.kind !== "compile-rejection").map(entry => {
		const type = signature(library, entry).result, copy = entry.checkIndependentCopy;
		if(entry.expectation.kind === "host-rejection") return `{\n${bindings(library, entry)}\nvar error = Wire.Reject(typeof(ArgumentOutOfRangeException), () => ${call(library, entry)});\nWire.Results.Add(new { id = ${JSON.stringify(entry.id)}, status = "rejected-as-expected", exception = error.GetType().Name, message = error.Message, recovered = true, recovery = ${recovery} });\n}`;
		return `{\n${bindings(library, entry)}\n${copy ? `var before = Wire.Snapshot(${encode(type, "arg0")});` : ""}\n${type === "unit" ? `${call(library, entry)};` : `var result = ${call(library, entry)};`}\nvar observed = ${encode(type, "result")};\n${copy ? `Wire.Check(before == Wire.Snapshot(${encode(type, "arg0")}));
Wire.Check(!ReferenceEquals(result, arg0) && !ReferenceEquals(result.${matrix}, arg0.${matrix}));
var originalResult = Wire.Snapshot(observed);
arg0.${matrix}[0][0] ^= 17;
arg0.${matrix}[1] = new uint[] { 29 };
Wire.Check(originalResult == Wire.Snapshot(${encode(type, "result")}));
var changed = Wire.Snapshot(${encode(type, "arg0")});
foreach (var row in result.${matrix}) if (row.Length > 0) row[0] ^= 31;
result.${matrix}[0] = new uint[] { 47 };
Wire.Check(changed == Wire.Snapshot(${encode(type, "arg0")}));` : ""}\nWire.Results.Add(new { id = ${JSON.stringify(entry.id)}, status = "matched", independentCopy = ${copy}, observed });\n}`;
	});
	const malformed = '"\\ud800"', large = "new string('x', 16 * 1024 * 1024 + 1)";
	const bad = {
		"null-string": `Api.${names[3]}(null!, "")`
		, "null-bytes": `Api.${names[11]}(null!)`
		, "null-array": `Api.${names[4]}(null!, 0)`
		, "null-record": `Api.${names[6]}(null!)`
		, "null-nested": `Api.${names[5]}(new uint[][] { new uint[] { 1 }, null! })`
		, "malformed-utf16": `Api.${names[3]}(${malformed}, "")`
		, "record-utf16": `Api.${names[6]}(arg0 with { ${title} = ${malformed} })`
		, "bytes-limit": `Api.${names[11]}(new byte[16 * 1024 * 1024 + 1])`
		, "string-limit": `Api.${names[3]}(${large}, "")`
		, "output-limit": `Api.${names[3]}(new string('x', 4 * 1024 * 1024), new string('y', 4 * 1024 * 1024))`
	};
	const errors = Object.entries(dotnetRuntimeCases).map(([id, error]) => `for (int iteration = 0; iteration < 3; ++iteration) {\n${id === "record-utf16" ? bindings(library, record) : ""}\nvar error = Wire.Reject(typeof(${error === "EncoderFallbackException" ? "System.Text." : ""}${error}), () => ${bad[id]});\nWire.Errors.Add(new { id = ${JSON.stringify(id)}, iteration, exception = error.GetType().Name, recovery = ${recovery} });\n}`).join("\n");
	return `${header(library)}internal static class Program {
[System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
static (WeakReference input, WeakReference output) CollectibleRecords() {
${bindings(library, record)}
var result = ${call(library, record)};
return (new WeakReference(arg0), new WeakReference(result));
}
static void Main() {
${corpusDotnetSignatures(library)}
${blocks.join("\n")}
${errors}
var copies = CollectibleRecords();
GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
Wire.Check(!copies.input.IsAlive && !copies.output.IsAlive);
Console.WriteLine(JsonSerializer.Serialize(new { schemaVersion = 1, profile = "dotnet", module = ${JSON.stringify(library.dotnetModule)}, hostVersion = Environment.Version.ToString(), results = Wire.Results, errors = Wire.Errors, collectibleCopies = true, assembly = typeof(Api).Assembly.Location,
nativeLibraries = System.IO.File.ReadAllLines("/proc/self/maps").Where(line => line.Contains("/runtimes/linux-x64/native/")).Select(line => line.Split(' ', StringSplitOptions.RemoveEmptyEntries).Last()).Distinct().Order().ToArray() }));
} }\n`;
};
