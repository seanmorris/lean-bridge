/**
 * Managed prepared APIs distinguish omitted Lean defaults from supplied values.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";

const optionalIr = () => {
	const signatures = [
		{ name: "Defaults.word", parameters: ["uint32"], result: "uint32" }
		, { name: "Defaults.natural", parameters: ["nat"], result: "nat" }
		, { name: "Defaults.text", parameters: ["string"], result: "string" }
		, { name: "Defaults.character", parameters: ["char"], result: "char" }
		, { name: "Defaults.maybe", parameters: [{ option: "uint32" }], result: { option: "uint32" } }
		, { name: "Defaults.present", parameters: [{ option: "uint32" }], result: { option: "uint32" } }
	];
	const ir = corpusReviewedIr({ id: "defaults" }, signatures);
	const defaults = [
		{ kind: "integer", value: "7" }
		, { kind: "integer", value: "184467440737095516160" }
		, { kind: "string", value: "Lean\nBridge" }
		, { kind: "char", value: "λ" }
		, { kind: "option-none" }
		, { kind: "option-some", value: { kind: "integer", value: "9" } }
	];
	for(const [index, declaration] of ir.declarations.entries())
	{
		declaration.parameters[0].optional = true;
		declaration.parameters[0].default = defaults[index];
	}
	return ir;
};

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
