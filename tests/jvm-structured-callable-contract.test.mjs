/**
 * Typed structured SAMs, shared ownership and unchanged predecessor projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { compileCopiedKotlinModel, generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { assertJvmStructuredCodegenRegression } from "./helpers/jvm-structured-callable-regression.mjs";
import { instrumentJvmStructuredCallables, assertJvmStructuredFaults } from "./helpers/jvm-structured-callable-faults.mjs";

test("structured JVM callbacks preserve every older Java and Kotlin generated file", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-structured-codegen-regression-20260924.json"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assertJvmStructuredCodegenRegression(record);
	const altered = structuredClone(record);
	Object.values(altered.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertJvmStructuredCodegenRegression(altered));
});

test("structured JVM callbacks keep Kotlin values distinct and share closure leases", () => {
	const ir = structuredCallableReviewedIr(), java = compileCopiedJvmModel(ir), kotlin = compileCopiedKotlinModel(ir);
	assert.equal(java.surface.functions.length, 26); assert.equal(java.surface.callbacks.size, 14);
	assert.equal(java.surface.copies.length, 25);
	const files = generateCopiedJvmKotlinPackage(ir), manifest = JSON.parse(files["binding-manifest.json"]);
	const prefix = "src/main/java/org/leanbridge/structured/";
	const runtime = files[`${prefix}KotlinRuntime.java`];
	assert.match(runtime, /import org\.leanbridge\.structured\.Runtime\.ClosureLease/);
	assert.match(runtime, /import org\.leanbridge\.structured\.Runtime\.ProcessGuard/);
	assert.match(runtime, /findStatic\(KotlinRuntime\.class/);
	assert.doesNotMatch(runtime, /class ClosureLease|class ProcessGuard|Runtime\.borrow/);
	for(const callback of kotlin.surface.callbacks.values())
	{
		const name = callback.publicName.split(".").at(-1), source = files[`${prefix}${name}.java`];
		assert.ok(callback.structured); assert.ok(callback.aliasName.startsWith("FnCallback"));
		assert.match(source, /Runtime\.ClosureLease/); assert.match(source, /KotlinRuntime\.invoke/);
		assert.match(source, /org\.leanbridge\.structured\.kotlin\./);
	}
	for(const path of manifest.publicFiles) assert.doesNotMatch(files[path], /MemorySegment|MethodHandle|Linker|Arena|SymbolLookup/);
	assert.match(files["README.md"], /Copied alias targets work in callback and closure payloads/);
	assert.doesNotMatch(files["README.md"], /compound callable payloads|List callback payloads remain unsupported/);
	assert.match(files["binding-manifest.json"], /acyclic structured callables/);
});

test("adding structured callbacks does not rename primitive Kotlin callback types", () => {
	const ir = structuredCallableReviewedIr(), primitive = callableReviewedIr();
	ir.producers.push(...primitive.producers);
	const callback = primitive.types.find(type => type.callable?.parameters.length === 1
		&& type.callable.parameters[0].type.name === "uint32" && type.callable.result.type.name === "uint32");
	assert.ok(callback);
	const fn = primitive.declarations.find(declaration => declaration.parameters.some(site => site.type.id === callback.id));
	assert.ok(fn); ir.types.push(callback); ir.declarations.push(fn);
	const model = compileCopiedKotlinModel(ir), mapped = [...model.surface.callbacks.values()].find(item => item.type.id === callback.id);
	assert.equal(mapped.publicName, "org.leanbridge.structured.FnUInt32ToUInt32");
	assert.equal(mapped.aliasName, undefined);
	const files = generateCopiedJvmKotlinPackage(ir);
	assert.ok(files["src/main/java/org/leanbridge/structured/FnUInt32ToUInt32.java"]);
	assert.ok(!files["src/main/java/org/leanbridge/structured/KotlinFnUInt32ToUInt32.java"]);
});

test("Kotlin structured SAM names cannot replace an existing Java copied record", () => {
	const ir = structuredCallableReviewedIr(), base = compileCopiedJvmModel(ir);
	const first = [...base.surface.callbacks.values()][0];
	const occupied = `Kotlin${first.publicName}`;
	ir.types.find(type => type.kind === "record").name = occupied;
	const model = compileCopiedKotlinModel(ir), files = generateCopiedJvmKotlinPackage(ir);
	assert.equal([...model.surface.callbacks.values()][0].publicName, `org.leanbridge.structured.${occupied}1`);
	for(const name of [occupied, `${occupied}1`]) assert.ok(files[`src/main/java/org/leanbridge/structured/${name}.java`]);
});

test("primitive alias callback payloads keep their checked target types", () => {
	const ir = callableReviewedIr();
	const callback = ir.types.find(type => type.callable?.parameters.length === 1
		&& type.callable.parameters[0].type.name === "uint32" && type.callable.result.type.name === "uint32");
	const alias = structuredClone(structuredCallableReviewedIr().types.find(type => type.kind === "alias"));
	Object.assign(alias, { id: "lean:Callables.Word", name: "Word"
		, target: { kind: "primitive", name: "uint32" }
		, source: { ...callback.source, declaration: "Callables.Word" } });
	ir.types.push(alias);
	callback.callable.parameters[0].type = { kind: "named", id: alias.id };
	callback.callable.result.type = { kind: "named", id: alias.id };
	const model = compileCopiedJvmModel(ir), projected = model.surface.callbacks.get(callback.id);
	assert.equal(projected.structured, true);
	assert.ok(projected.publicName.startsWith("FnCallback"));
	const files = generateCopiedJvmKotlinPackage(ir);
	assert.match(files[`src/main/java/org/leanbridge/callables/${projected.publicName}.java`], /long invoke\(long arg0\)/);
	assert.doesNotMatch(Object.keys(files).join("\n"), /\/Word\.(java|kt)/);
});

test("JVM structured callables retain explicit ownership and higher-order restrictions", () => {
	for(const change of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); change(ir);
		assert.throws(() => compileCopiedJvmModel(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => compileCopiedJvmModel(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
});

test("JVM failure instrumentation covers both adapters without altering original sources", () => {
	const files = generateCopiedJvmKotlinPackage(structuredCallableReviewedIr()), original = structuredClone(files);
	const probe = instrumentJvmStructuredCallables(files), prefix = "src/main/java/org/leanbridge/structured/";
	assert.deepEqual(files, original);
	for(const name of ["Runtime", "KotlinRuntime"])
	{
		const path = `${prefix}${name}.java`;
		assert.equal(probe.replacements[`${path}:conversions`], 50);
		assert.equal(probe.replacements[`${path}:clears`], 40);
		assert.equal(probe.replacements[`${path}:adoption`], 14);
		assert.doesNotMatch(files[path], /StructuredProbe/);
		assert.match(probe.files[path], /StructuredProbe\.cleared\(output\)/);
	}
	const record = { profile: "java", checks: 1601, faults: 1600
		, clears: 5, disposals: 5
		, liveIdentities: 0, openArenas: 0, liveHosts: 0, malformed: 15
		, deferredCloseChecks: 8
		, shapes: ["array", "list", "option", "result", "tuple", "record", "variant", "alias"].map(shape => ({ shape
			, paths: { callback: 20, repeated: 20, create: 20
					, "create-call": 20, "held-call": 20 }
				, faults: 200 })) };
	assertJvmStructuredFaults(record);
	for(const change of [
		value => { value.liveIdentities = 1; }, value => { value.openArenas = 1; }
		, value => { value.liveHosts = 1; }
		, value => { value.deferredCloseChecks = 7; }
		, value => { value.shapes.pop(); }
		, value => { value.shapes[0].paths.callback = 0; }
		, value => { value.shapes[0].faults = 100; }
		, value => { value.malformed = 14; }
	]) {
		const invalid = structuredClone(record); change(invalid);
		assert.throws(() => assertJvmStructuredFaults(invalid));
	}
});
