/**
 * Named C# constructors and unmanaged active-case layouts.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";

test("C# variants expose named constructor records and private explicit-layout unions", () => {
	const ir = nativeVariantReviewedIr(), files = generateCopiedDotnetPackage(ir);
	assert.deepEqual(files, generateDotnetBindingPackage(ir));
	assert.deepEqual(files, generateCopiedDotnetPackage(structuredClone(ir)));
	const source = files["src/LeanBridge.Variants/Api.cs"], runtime = files["src/LeanBridge.Variants/Runtime.cs"];
	assert.match(source, /public abstract record Signal/);
	assert.match(source, /public sealed record SignalIdle\(\) : Signal;/);
	assert.match(source, /public sealed record SignalData\(uint Count, string Label\) : Signal;/);
	assert.match(source, /public sealed record SignalMarker\(Unit Value\) : Signal;/);
	assert.match(source, /public sealed record OneOnly\(uint Value\) : One;/);
	assert.match(source, /public sealed record AnonymousCollision\(uint Arg1, string Arg1_\)/);
	assert.match(source, /public static Signal Echo\(Signal @value0\)/);
	assert.doesNotMatch(source, /unsafe|DllImport|FieldOffset|\b(?:nint|nuint)\b/);
	assert.match(runtime, /\[StructLayout\(LayoutKind.Explicit\)\]/);
	assert.match(runtime, /\[FieldOffset\(0\)\] internal C\d+_\d+ Case\d+;/);
	assert.match(runtime, /return value.Kind switch/);
	assert.match(runtime, /Invalid native Signal constructor/);
	assert.match(runtime, /SignalData branch => new N\d+/);
	assert.doesNotMatch(runtime, /lean_obj_tag|lean_ctor_get/);
});

test("C# variant constructors and member names fail on collisions", () => {
	for(const name of ["Api", "Option", "V3", "C3_2", "SignalData"])
	{
		const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Packet").name = name;
		assert.throws(() => compileCopiedDotnetModel(ir), /C# .*collid/);
	}
	for(const names of [["count", "Count"], ["equals", "label"], ["memberwiseClone", "label"], ["signalData", "label"]])
	{
		const ir = nativeVariantReviewedIr(), branch = ir.types.find(type => type.name === "Signal").cases[2];
		branch.fields.forEach((field, index) => { field.name = names[index]; });
		assert.throws(() => compileCopiedDotnetModel(ir), /(?:C# .*collid|C\/C\+\+ variant field is reserved or duplicated)/);
	}
});

test("C# variants preserve native alignment and keep recursion gated", () => {
	const ir = nativeVariantReviewedIr();
	const fn = ir.declarations.find(item => item.name === "echo_mode");
	fn.parameters[0].type = fn.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "named", id: "lean:Variants.Mode" }] };
	assert.match(generateCopiedDotnetPackage(ir)["src/LeanBridge.Variants/Runtime.cs"], /value.Data % 4 != 0/);
	const recursive = nativeVariantReviewedIr(); recursive.types.find(type => type.name === "Signal").cases[2].fields[0].type = { kind: "named", id: "lean:Variants.Signal" };
	assert.throws(() => compileCopiedDotnetModel(recursive), /acyclic/);
});
