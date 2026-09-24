/**
 * C# structured admission, predecessor outputs and exact fault-path coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { assertDotnetStructuredCodegenRegression } from "./helpers/dotnet-structured-callable-regression.mjs";
import { assertDotnetStructuredFaults, instrumentDotnetStructuredCallables } from "./helpers/dotnet-structured-callable-faults.mjs";

test("C# structured callbacks preserve all earlier generated packages byte for byte", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-structured-codegen-regression-20260924.json"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assertDotnetStructuredCodegenRegression(record);
	const altered = structuredClone(record);
	Object.values(altered.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertDotnetStructuredCodegenRegression(altered));
});

test("C# structured callbacks admit typed copied values while retaining ownership restrictions", () => {
	const { surface } = compileCopiedDotnetModel(structuredCallableReviewedIr());
	assert.equal(surface.functions.length, 26); assert.equal(surface.callbacks.size, 14);
	assert.equal(surface.copies.length, 25);
	for(const mutate of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => compileCopiedDotnetModel(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => compileCopiedDotnetModel(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
	const files = generateCopiedDotnetPackage(structuredCallableReviewedIr());
	assert.doesNotMatch(files["src/LeanBridge.Structured/Api.cs"], /unsafe|DllImport|nint|nuint|DynamicInvoke/);
	assert.match(files["README.md"], /Acyclic copied compounds work in callback arguments and results/);
	assert.doesNotMatch(files["README.md"], /List callback payloads remain unsupported|Compound callable values|compound callable payloads/);
	assert.match(files["README.md"], /Copied alias targets work in callback and closure payloads/);
	assert.match(files["binding-manifest.json"], /acyclic structured callables/);
});

test("C# structured fault records require every shape, exception class and execution path", () => {
	const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
	const valid = { checks: 3000, faults: 1600, clears: 2000
		, malformed: 15, liveAllocations: 0, liveIdentities: 0, deferredCloseChecks: 8
		, shapes: shapes.map(shape => ({ shape, paths: { callback: 20, repeated: 20, create: 20, "create-call": 20, "held-call": 20 }, faults: 200 })) };
	assertDotnetStructuredFaults(valid);
	for(const change of [
		value => { value.shapes.pop(); }
		, value => { value.shapes[7].shape = "array"; }
		, value => { value.shapes[0].paths.callback = 0; }
		, value => { delete value.shapes[0].paths.create; }
		, value => { value.shapes[0].faults /= 2; }
		, value => { value.faults -= 1; }
		, value => { value.malformed = 0; }
		, value => { value.liveAllocations = 1; }
		, value => { value.liveIdentities = 1; }
		, value => { value.deferredCloseChecks = 7; }
	]) {
		const altered = structuredClone(valid); change(altered);
		assert.throws(() => assertDotnetStructuredFaults(altered));
	}
});

test("C# fault instrumentation preserves original sources and guards every native output", () => {
	const files = generateCopiedDotnetPackage(structuredCallableReviewedIr());
	const source = files["src/LeanBridge.Structured/Runtime.cs"], original = structuredClone(files);
	const probe = instrumentDotnetStructuredCallables(source);
	assert.deepEqual(files, original); assert.doesNotMatch(source, /StructuredProbe/);
	assert.equal(probe.replacements.conversions, 50);
	assert.equal(probe.replacements.borrow, 14); assert.equal(probe.replacements.dispose, 14);
	assert.match(probe.runtime, /StructuredProbe.Zero\(value\)/);
	assert.match(probe.runtime, /StructuredProbe.Zero\(self\)/);
	assert.match(probe.runtime, /StructuredProbe.Roots -= roots.Count/);
});
