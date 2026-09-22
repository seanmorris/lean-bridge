/**
 * Kotlin copied surfaces retain exact types and share private JVM ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCopiedKotlinModel, renderCopiedKotlinPackage, generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { jvmValue } from "../src/backends/jvm/callables.mjs";
import { validateKotlinCompilation } from "../src/build/compile-jvm-sources.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

test("Maven packaging rejects missing or altered Kotlin compiler metadata", () => {
	const evidence = { namespace: "org.leanbridge.collections.kotlin"
		, standardLibraryVersion: "2.2.0"
		, version: "info: kotlinc-jvm 2.2.0 (JRE 22.0.2)"
		, module: "lean_bridge_org_leanbridge_collections"
		, options: ["-module-name", "lean_bridge_org_leanbridge_collections"
			, "-jvm-target", "22", "-no-reflect", "-no-stdlib", "-Werror"
			, "-Xrender-internal-diagnostic-names"]
		, compilerFiles: Object.fromEntries(["kotlin-compiler.jar", "kotlin-stdlib.jar", "annotations-13.0.jar"].map(name => [name, "a".repeat(64)])) };
	const validate = value => validateKotlinCompilation(value, "org.leanbridge.collections");
	assert.doesNotThrow(() => validate(evidence)); assert.throws(() => validate(null));
	for(const change of [
		value => { value.namespace = "org.other.kotlin"; }
		, value => { value.module = "../../other"; }
		, value => { value.options[3] = "21"; }
		, value => { value.options.pop(); }
		, value => { value.version = "info: kotlinc-jvm 2.1.0 (JRE 22.0.2)"; }
		, value => { value.standardLibraryVersion = "2.1.0"; }
		, value => { delete value.compilerFiles["kotlin-stdlib.jar"]; }
		, value => { value.compilerFiles["kotlin-compiler.jar"] = "not-a-hash"; }
		, value => { value.compilerFiles["../other.jar"] = "a".repeat(64); }
	]) {
		const invalid = structuredClone(evidence); change(invalid);
		assert.throws(() => validate(invalid), /compiler contract/);
	}
});

test("Kotlin collections retain every primitive and all 24 explicitly typed array levels", () => {
	const ir = collectionReviewedIr(), before = JSON.stringify(ir);
	const original = generateCopiedJvmPackage(ir), model = compileCopiedKotlinModel(ir), rendered = renderCopiedKotlinPackage(ir);
	assert.equal(JSON.stringify(ir), before); assert.deepEqual(generateCopiedJvmPackage(ir), original);
	assert.equal(model.surface.functions.length, 35);
	const deep = model.surface.functions.find(fn => fn.publicName === "deep");
	const expected = "kotlin.Array<".repeat(23) + "kotlin.LongArray" + ">".repeat(23);
	assert.equal(model.kotlinType(jvmValue(model, deep.declaration.parameters[0].type)), expected);
	assert.equal(model.kotlinType(jvmValue(model, deep.declaration.result.type)), expected);
	const fields = model.surface.copies.find(copy => copy.record?.name === "Primitives").fields;
	assert.deepEqual(fields.map(field => model.kotlinType(field.type)), [
		"`org`.`leanbridge`.`collections`.Unit", "kotlin.Boolean"
		, "kotlin.Int", "kotlin.Int", "kotlin.Long", "java.math.BigInteger"
		, "kotlin.Byte", "kotlin.Short", "kotlin.Int", "kotlin.Long"
		, "java.math.BigInteger", "java.math.BigInteger"
		, "kotlin.Float", "kotlin.Double", "kotlin.String", "kotlin.ByteArray"
		, "kotlin.Int", "java.math.BigInteger", "kotlin.Long"
	]);
	const api = rendered.files[rendered.publicFiles.find(path => path.endsWith("/Api.kt"))];
	assert.ok(api.includes(`fun \`deep\`(arg0: ${expected}): ${expected}`));
	assert.equal([...api.matchAll(/fun `/g)].length, 35);
	assert.doesNotMatch(api, /kotlin\.Any|Object\b|MemorySegment|java\.lang\.reflect/);
	const bridge = rendered.files[rendered.internalFiles.find(path => path.endsWith("/KotlinBridge.java"))];
	assert.match(bridge, /final class KotlinBridge/); assert.doesNotMatch(bridge, /public class/);
	const calls = rendered.files[rendered.internalFiles.find(path => path.endsWith("/KotlinCalls.kt"))];
	assert.match(calls, /internal object KotlinCalls/); assert.match(calls, /@kotlin.jvm.JvmSynthetic/);
});

test("Kotlin annotations remain qualified when copied types use annotation or language names", () => {
	const ir = collectionReviewedIr();
	for(const [before, after] of [["Single", "JvmField"], ["Count", "Suppress"], ["Empty", "JvmStatic"]])
		ir.types.find(type => type.name === before).name = after;
	ir.types.find(type => type.name === "Pair").fields[0].name = "when";
	const output = renderCopiedKotlinPackage(ir);
	const sources = Object.values(output.files).join("\n");
	assert.doesNotMatch(sources, /@(JvmField|JvmStatic|JvmSynthetic|Suppress)\b/);
	assert.match(sources, /val `when`: kotlin.Long/);
	assert.ok(output.publicFiles.some(path => path.endsWith("/JvmField.kt")));
});

test("Kotlin generated helper names cannot replace existing Java records", () => {
	const ir = collectionReviewedIr();
	ir.types.find(type => type.name === "Primitives").name = "KotlinRuntime";
	ir.types.find(type => type.name === "Single").name = "KotlinCalls";
	ir.types.find(type => type.name === "Count").name = "KotlinBridge";
	const model = compileCopiedKotlinModel(ir);
	assert.deepEqual(model.helpers, { runtime: "KotlinRuntime1", calls: "KotlinCalls1", bridge: "KotlinBridge1" });
	const output = renderCopiedKotlinPackage(ir);
	assert.ok(output.internalFiles.some(path => path.endsWith("/KotlinRuntime1.java")));
	assert.ok(output.publicFiles.some(path => path.endsWith("/kotlin/KotlinRuntime.kt")));
});

for(const [name, fixture] of Object.entries({
	collections: collectionReviewedIr, compounds: compoundReviewedIr
	, variants: nativeVariantReviewedIr, aliases: nativeAliasReviewedIr
	, lists: listReviewedIr, callables: callableReviewedIr
}))
	test(`Kotlin ${name} preserve Java native layouts and the shared native owner`, () => {
		const ir = fixture(), java = compileCopiedJvmModel(ir), kotlin = compileCopiedKotlinModel(ir), output = renderCopiedKotlinPackage(ir);
		const combined = generateCopiedJvmKotlinPackage(ir), original = generateCopiedJvmPackage(ir);
		for(const [path, source] of Object.entries(original).filter(([path]) => path.endsWith(".java")))
			assert.equal(combined[path], source, path);
		assert.deepEqual(kotlin.surface.copies.map(copy => [copy.name, copy.size, copy.alignment, copy.layout]), java.surface.copies.map(copy => [copy.name, copy.size, copy.alignment, copy.layout]));
		assert.deepEqual(kotlin.surface.functions.map(fn => fn.name), java.surface.functions.map(fn => fn.name));
		const source = output.files[output.internalFiles.find(path => path.endsWith("/KotlinRuntime.java"))];
		assert.match(source, /NativeAssets\.lookup\(\)/);
		assert.doesNotMatch(source, /class ClosureLease|class ProcessGuard|createTempDirectory|System\.load\(/);
		for(const path of output.publicFiles) assert.doesNotMatch(output.files[path], /MemorySegment|SymbolLookup|Linker|Arena/);
		if(name === "callables")
		{
			assert.match(source, /Runtime\.borrow\d+\(/); assert.match(source, /Runtime\.own\d+\(/);
			assert.match(source, /Runtime\.DROP\d+\.invokeExact/); assert.match(source, /Runtime\.ProcessGuard/);
		}
		if(name === "compounds")
		{
			const root = "src/main/kotlin/org/leanbridge/compounds/kotlin/";
			assert.match(output.files[`${root}Option.kt`], /sealed interface Option<out T : kotlin.Any>/);
			assert.match(output.files[`${root}Result.kt`], /sealed interface Result<out T : kotlin.Any, out E : kotlin.Any>/);
			assert.match(output.files[`${root}Pair.kt`], /class Pair<out A : kotlin.Any, out B : kotlin.Any>/);
			for(const file of ["Option.kt", "Result.kt", "Pair.kt"]) assert.doesNotMatch(output.files[root + file], /\bvar\b/);
			assert.match(source, /org\.leanbridge\.compounds\.kotlin\.Option\.some\(/);
			assert.match(source, /org\.leanbridge\.compounds\.kotlin\.Result\.err\(/);
			assert.match(source, /new org\.leanbridge\.compounds\.kotlin\.Pair<>/);
		}
	});
