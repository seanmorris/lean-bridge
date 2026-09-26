/**
 * Checked C# recursive callable layouts, public names and regenerated packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { callableReviewedIr, callableSignatures } from "./helpers/callable-fixture.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { compileCallableDotnetGraphPackageModel } from "../src/backends/dotnet/callable-graph-model.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCallableDotnetGraphPackage } from "../src/backends/dotnet/callable-graph-package.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";

test("NuGet-only recursive admission preserves original signatures and cross-target layout", () => {
	const ir = nativeRecursiveCallableReviewedIr(), model = compileNativeGraphProjection(ir, ["nuget"]);
	assert.equal(model.ir, ir); assert.equal(model.functions.length, 33); assert.equal(model.callbacks.size, 18);
	for(const targets of [["c", "nuget"], ["nuget", "cpp"], ["pypi", "nuget"], ["cargo", "nuget"], ["rubygems", "nuget"], ["cpan", "nuget"], ["nuget", "maven"], ["c", "cpp", "pypi", "cargo", "rubygems", "cpan", "nuget", "maven"]])
		assert.equal(compileNativeGraphProjection(ir, targets, "LeanBridge::Structured").layoutSha256, model.layoutSha256);
	for(const targets of [[], ["nuget", "nuget"], ["nuget", "php-native"], ["nuget", "wit-wasi"], ["unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
});

test("recursive C# callable models retain original public functions and parameter names", () => {
	const ir = nativeRecursiveCallableReviewedIr(), before = structuredClone(ir);
	const model = compileCallableDotnetGraphPackageModel(ir);
	assert.deepEqual(ir, before);
	assert.equal(model.functions.length, 33); assert.equal(model.callbacks.size, 18);
	assert.deepEqual(model.functions.map(fn => fn.definition.id), ir.declarations.map(fn => fn.id));
	for(const fn of model.functions) assert.deepEqual(fn.parameterNames, fn.definition.parameters.map(site => site.name));
	assert.equal(model.namespace, "LeanBridge.Structured");
});

test("private payload catalogs cannot bypass public C# name validation", () => {
	const reserved = nativeRecursiveCallableReviewedIr(); reserved.declarations[0].name = "to_string";
	assert.throws(() => compileCallableDotnetGraphPackageModel(reserved), /Reserved or duplicate C# function: ToString/);
	const repeated = nativeRecursiveCallableReviewedIr();
	repeated.declarations[0].name = "same_name"; repeated.declarations[1].name = "sameName";
	assert.throws(() => compileCallableDotnetGraphPackageModel(repeated), /Reserved or duplicate C# function: SameName/);
	const parameters = nativeRecursiveCallableReviewedIr();
	parameters.declarations.find(fn => fn.parameters.length === 2).parameters[1].name = "value0";
	assert.throws(() => compileCallableDotnetGraphPackageModel(parameters), /bindingIr\.declarations\[0\]\.parameters contains duplicate value0/);
});

test("C# keyword parameter names are escaped without changing the contract", () => {
	const ir = nativeRecursiveCallableReviewedIr();
	ir.declarations.find(fn => fn.name === "callRecursive").parameters[0].name = "class";
	const api = generateCallableDotnetGraphPackage(ir)["src/LeanBridge.Structured/Api.cs"];
	assert.match(api, /CallRecursive\(_V\.Tree @class,/);
	assert.match(api, /GraphCalls\.Call\d+\(@class, @value1\)/);
});

test("callable package audits require exact public files, including legal FFI-like copied names", () => {
	const ir = nativeRecursiveCallableReviewedIr(); ir.types.find(type => type.name === "Payload").name = "NativeLibrary";
	const files = generateCallableDotnetGraphPackage(ir), manifest = JSON.parse(files["binding-manifest.json"]);
	assert.deepEqual(generateCallableDotnetGraphPackage(ir), files);
	assert.equal(auditManagedBindingPackage(ir, files, "dotnet").publicFiles.length, 2);
	assert.match(files[manifest.publicFiles[0]], /sealed record NativeLibrary/);
	for(const path of manifest.publicFiles)
	{
		for(const extra of ["\n// arbitrary public source drift\n", "\npublic class Raw { public nint Address; }\n"])
			assert.throws(() => auditManagedBindingPackage(ir, { ...files, [path]: files[path] + extra }, "dotnet"), { code: "private-ffi-public" });
	}
	for(const publicFiles of [[], manifest.publicFiles.toReversed(), [...manifest.publicFiles, manifest.internalFiles[0]]])
		assert.throws(() => auditManagedBindingPackage(ir, { ...files, "binding-manifest.json": JSON.stringify({ ...manifest, publicFiles }) }, "dotnet"), { code: "private-ffi-public" });
});

test("recursive C# callables preserve primitive names, Unit Actions and sixteen-argument delegates", () => {
	const ir = nativeRecursiveCallableReviewedIr(), signatures = [...callableSignatures
		, { name: "Callables.callSixteen", parameters: [{ callback: { parameters: Array(16).fill("uint32"), result: "uint32" } }], result: "uint32" }
		, { name: "Callables.callSixteenUnit", parameters: [{ callback: { parameters: Array(16).fill("uint32"), result: "unit" } }], result: "unit" }
		, { name: "Callables.makeSixteen", parameters: ["uint32"], result: { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } } }
		, { name: "Callables.makeSixteenUnit", parameters: ["unit"], result: { callback: { parameters: Array(16).fill("uint32"), result: "unit" } } }
	];
	const primitive = callableReviewedIr(signatures);
	for(const type of primitive.types)
	{
		assert.ok(!ir.types.some(previous => previous.id === type.id)); ir.types.push(type);
	}
	ir.producers.push(...primitive.producers); ir.declarations.push(...primitive.declarations);
	const model = compileCallableDotnetGraphPackageModel(ir), files = generateCallableDotnetGraphPackage(ir);
	assert.equal(model.functions.length, 95); assert.equal(model.callbacks.size, 58);
	for(const fn of compileCopiedDotnetModel(primitive).surface.functions)
		assert.equal(model.functions.find(current => current.definition.id === fn.declaration.id).publicName, fn.publicName, fn.declaration.id);
	const api = files["src/LeanBridge.Structured/Api.cs"];
	assert.match(api, /public static void CallUnit\(_V\.Unit @value0, global::System.Action<_V\.Unit> @value1\)/);
	assert.match(api, /LeanClosure<global::System.Action<bool, _V\.Unit>> MakeUnit/);
	auditManagedBindingPackage(ir, files, "dotnet");
});

test("recursive C# callables reject asynchronous and hidden-identity payloads", () => {
	for(const change of [
		ir => { ir.types.find(type => type.kind === "callback").callable.resultMode = "promise"; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Payload").fields[0].type = { kind: "named", id: ir.types.find(type => type.kind === "callback").id }; }
	]) {
		const ir = nativeRecursiveCallableReviewedIr(); change(ir);
		assert.throws(() => compileCallableDotnetGraphPackageModel(ir));
	}
});
