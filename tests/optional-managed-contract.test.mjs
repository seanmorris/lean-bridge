/**
 * Managed prepared APIs distinguish omitted Lean defaults from supplied values.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { optionalParameterIr } from "./helpers/optional-parameter-ir.mjs";

const optionalIr = optionalParameterIr;

test("C# exposes omission as overloads while preserving its full-arity methods", () => {
	const files = generateCopiedDotnetPackage(optionalIr());
	const source = files["src/LeanBridge.Defaults/Api.cs"];
	assert.match(source, /public static uint Word\(uint @value0\) => Interop\.Runtime\.Call0\(@value0\);/u);
	assert.match(source, /public static uint Word\(\) => Interop\.Runtime\.Call0\(global::System\.UInt32\.Parse\("7", global::System\.Globalization\.CultureInfo\.InvariantCulture\)\);/u);
	assert.match(source, /BigInteger\.Parse\("184467440737095516160", global::System\.Globalization\.CultureInfo\.InvariantCulture\)/u);
	assert.match(source, /Interop\.Runtime\.Call2\("Lean\\nBridge"\)/u);
	assert.match(source, /new global::System\.Text\.Rune\(0x3bb\)/u);
	assert.match(source, /Interop\.Runtime\.Call4\(Option<uint>\.None\)/u);
	assert.match(source, /Interop\.Runtime\.Call5\(Option<uint>\.Some\(global::System\.UInt32\.Parse\("9"/u);
	assert.equal((source.match(/public static uint Word\(/gu) ?? []).length, 2);
});

test("C# rejects a positional default before a required argument", () => {
	const ir = optionalIr(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...structuredClone(declaration.parameters[0])
		, name: "required", optional: false, default: null });
	assert.throws(() => generateCopiedDotnetPackage(ir)
		, /default before a required positional parameter/u);
});

test("Java exposes omission as overloads while preserving its full-arity methods", () => {
	const files = generateCopiedJvmPackage(optionalIr());
	const source = files["src/main/java/org/leanbridge/defaults/Api.java"];
	assert.match(source, /public static long word\(long arg0\) \{ return Runtime\.call0\(arg0\); \}/u);
	assert.match(source, /public static long word\(\) \{ return Runtime\.call0\(7L\); \}/u);
	assert.match(source, /new java\.math\.BigInteger\("184467440737095516160"\)/u);
	assert.match(source, /Runtime\.call2\("Lean\\nBridge"\)/u);
	assert.match(source, /Runtime\.call3\(0x3bb\)/u);
	assert.match(source, /Runtime\.call4\(Option\.none\(\)\)/u);
	assert.match(source, /Runtime\.call5\(Option\.some\(9L\)\)/u);
	assert.equal((source.match(/public static long word\(/gu) ?? []).length, 2);
});

test("Java rejects a positional default before a required argument", () => {
	const ir = optionalIr(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...structuredClone(declaration.parameters[0])
		, name: "required", optional: false, default: null });
	assert.throws(() => generateCopiedJvmPackage(ir)
		, /default before a required positional parameter/u);
});

test("Kotlin metadata carries Lean defaults while its bridge stays full arity", () => {
	const files = generateCopiedJvmKotlinPackage(optionalIr());
	const source = files["src/main/kotlin/org/leanbridge/defaults/kotlin/Api.kt"];
	assert.match(source, /fun `word`\(arg0: kotlin\.Long = 7L\): kotlin\.Long/u);
	assert.match(source, /arg0: java\.math\.BigInteger = java\.math\.BigInteger\("184467440737095516160"\)/u);
	assert.match(source, /arg0: kotlin\.String = "Lean\\nBridge"/u);
	assert.match(source, /arg0: kotlin\.Int = 0x3bb/u);
	assert.match(source, /arg0: `org`\.`leanbridge`\.`defaults`\.`kotlin`\.`Option`<kotlin\.Long> = org\.leanbridge\.defaults\.kotlin\.Option\.none\(\)/u);
	assert.match(source, /Option\.some\(9L\)/u);
	assert.match(source, /KotlinCalls\.call0\(arg0\)/u);
	assert.doesNotMatch(source, /KotlinCalls\.call0\(7L\)/u);
});

test("Kotlin rejects a positional default before a required argument", () => {
	const ir = optionalIr(), declaration = ir.declarations[0];
	declaration.parameters.push({ ...structuredClone(declaration.parameters[0])
		, name: "required", optional: false, default: null });
	assert.throws(() => generateCopiedJvmKotlinPackage(ir)
		, /default before a required positional parameter/u);
});
