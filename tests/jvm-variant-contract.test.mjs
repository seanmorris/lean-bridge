/**
 * Named sealed JVM variants, private C layouts and source-name validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";
import { aliasReviewedIr } from "./helpers/alias-fixture.mjs";
import { jvmDiagnostics } from "./helpers/type-corpus-jvm-tools.mjs";

const prefix = "src/main/java/org/leanbridge/variants/";

test("JVM variants expose sealed interfaces and named constructor records", () => {
	const ir = nativeVariantReviewedIr(), files = generateCopiedJvmPackage(ir);
	assert.deepEqual(generateCopiedJvmKotlinPackage(ir), generateJvmBindingPackage(ir));
	assert.deepEqual(files, generateCopiedJvmPackage(structuredClone(ir)));
	assert.match(files[`${prefix}Signal.java`], /public sealed interface Signal permits SignalIdle, SignalStopped, SignalData, SignalMarker/);
	assert.match(files[`${prefix}SignalIdle.java`], /public record SignalIdle\(\) implements Signal/);
	assert.match(files[`${prefix}SignalData.java`], /public record SignalData\(long count, String label\) implements Signal/);
	assert.match(files[`${prefix}SignalMarker.java`], /public record SignalMarker\(Unit value\) implements Signal/);
	assert.match(files[`${prefix}AnonymousCollision.java`], /long arg1, String arg1_/);
	assert.match(files[`${prefix}Api.java`], /public static Signal echo\(Signal arg0\)/);
	const manifest = JSON.parse(files["binding-manifest.json"]);
	for(const path of manifest.publicFiles) assert.doesNotMatch(files[path], /MemorySegment|ValueLayout|JAVA_INT|constructor_tag|lean_ctor_get/);
	assert.match(files[`${prefix}Runtime.java`], /case SignalData branch ->/);
	assert.match(files[`${prefix}Runtime.java`], /return switch \(value.get\(JAVA_INT, 0\)\)/);
	assert.match(files[`${prefix}Runtime.java`], /Invalid native Signal constructor/);
});

test("JVM tagged-union layouts include branch padding and tag alignment", () => {
	const model = compileCopiedJvmModel(nativeVariantReviewedIr());
	const expected = { Signal: [48, 8, 8], Mode: [8, 4, 4], Nested: [176, 8, 8]
		, Scalars: [224, 8, 8], Anonymous: [48, 8, 8]
		, One: [8, 4, 4], Buffers: [72, 8, 8] };
	for(const copy of model.surface.copies.filter(copy => copy.variant))
		assert.deepEqual([copy.size, copy.alignment, copy.payloadOffset], expected[copy.publicName], copy.publicName);
	const ir = nativeVariantReviewedIr(), fn = ir.declarations.find(item => item.name === "echo_mode");
	fn.parameters[0].type = fn.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "named", id: "lean:Variants.Mode" }] };
	assert.match(generateCopiedJvmPackage(ir)[`${prefix}Runtime.java`], /pointer.address\(\) % 4 != 0/);
});

test("JVM variants reject collisions and escape keyword payload names", () => {
	for(const name of ["Api", "Option", "SignalData", "Runtime"])
	{
		const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Packet").name = name;
		assert.throws(() => compileCopiedJvmModel(ir), /(?:Java .*|C\/C\+\+ record name )collid/);
	}
	for(const names of [["count", "Count"], ["getClass", "label"], ["class", "class_"]])
	{
		const ir = nativeVariantReviewedIr(), branch = ir.types.find(type => type.name === "Signal").cases[2];
		branch.fields.forEach((field, index) => { field.name = names[index]; });
		assert.throws(() => compileCopiedJvmModel(ir), /(?:Java .*collid|C\/C\+\+ variant field is reserved or duplicated)/);
	}
	const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Signal").cases[2].fields[0].name = "class";
	assert.match(generateCopiedJvmPackage(ir)[`${prefix}SignalData.java`], /long class_, String label/);
});

test("JVM variant aliases retain both host names and recursive payloads remain gated", () => {
	const ir = nativeVariantReviewedIr(), target = { kind: "named", id: "lean:Variants.Signal" };
	const alias = { ...aliasReviewedIr().types.find(type => type.name === "ModeView")
		, id: "lean:Variants.SignalView", name: "SignalView", target };
	ir.types.push(alias);
	const fn = ir.declarations.find(item => item.name === "echo"); fn.parameters[0].type = fn.result.type = { kind: "named", id: alias.id };
	const manifest = JSON.parse(generateCopiedJvmPackage(ir)["binding-manifest.json"]);
	assert.deepEqual(manifest.aliases, [{ id: alias.id, name: alias.name, target, javaType: "Signal", kotlinType: "Signal" }]);
	const recursive = nativeVariantReviewedIr(); recursive.types.find(type => type.name === "Signal").cases[2].fields[0].type = target;
	assert.throws(() => compileCopiedJvmModel(recursive), /acyclic/);
});

test("JVM diagnostics retain source coordinates for argument-free compiler errors", () => {
	const entry = { id: "variants/incomplete-match", expectation: { diagnostic: "compiler.err.not.exhaustive" } };
	const result = { code: 1, stdout: "", stderr: "reject-incomplete-match.java:3:14: compiler.err.not.exhaustive\n1 error\n" };
	const check = result => jvmDiagnostics(result, entry, "java", "/tmp/jvm-diagnostic-contract", "src/reject-incomplete-match.java");
	assert.deepEqual(check(result), [{ code: "compiler.err.not.exhaustive", file: "src/reject-incomplete-match.java", line: 3, column: 14, message: "" }]);
	assert.throws(() => check({ ...result, stderr: result.stderr.replace("not.exhaustive", "unknown") }));
	assert.throws(() => check({ ...result, stderr: result.stderr.replace("reject-incomplete-match", "unrelated") }));
	assert.throws(() => check({ ...result, code: 0 }));
});
