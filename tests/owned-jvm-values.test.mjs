/**
 * Compile independently typed Java consumers without loading a native library.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmValues } from "../src/backends/jvm/owned-values.mjs";
import { ownedJvmException, ownedJvmRuntime } from "../src/backends/jvm/owned-runtime.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned Java signatures preserve aliases, higher-order direction and closed values", () => {
	const ir = ownedCppCompositionReviewedIr(), original = structuredClone(ir);
	const model = generateOwnedJvmValues(ir);
	assert.deepEqual(ir, original);
	assert.deepEqual(model.files, generateOwnedJvmValues(ir).files);
	assert.equal(model.types.find(node => node.name === "Mixed").fields.length, 13);
	assert.equal(model.aliases.find(alias => alias.name === "BundleAlias").managedType, "Bundle");
	assert.equal(model.aliases.find(alias => alias.name === "TicketRow").managedType, "Option<Ticket>[]");
	const higher = model.callbacks.find(callback => callback.publicType === "DispatchResultClosure");
	assert.deepEqual(higher.hostParameters, ["CallbackRecordArgument1Closure"]);
	assert.deepEqual(higher.invokeParameters, ["CallbackRecordArgument1ClosureCallback"]);
	for(const path of model.publicFiles)
	{
		const source = model.files[path];
		assert.doesNotMatch(source, /public[^;\n]*(?:MemorySegment|MemoryLayout|long raw|int tag|bridgeField)/u);
	}
	const wide = structuredClone(ir), payload = wide.types.find(node => node.name === "Payload");
	payload.fields = Array.from({ length: 128 }, (_, index) => ({
		...payload.fields[0], name: "wide" + index
		, type: { kind: "primitive", name: "float64" }
	}));
	assert.equal(generateOwnedJvmValues(wide).records.find(record => record.name === "Payload").builder, true);
	const collision = structuredClone(ir);
	collision.types.find(node => node.name === "Payload").name = "String";
	assert.throws(() => generateOwnedJvmValues(collision), /reserved or duplicate/u);
	const reserved = structuredClone(ir);
	reserved.types.find(node => node.name === "Payload").fields[0].name = "equals";
	assert.throws(() => generateOwnedJvmValues(reserved), /duplicate or reserved field/u);
});

test("owned Java consumers compile against class files and reject unsafe public uses", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-jvm-values-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedJvmValues(ownedCppCompositionReviewedIr());
	const prefix = "src/main/java/" + model.namespace.replaceAll(".", "/");
	const files = { ...model.files
		, [prefix + "/_OwnedRuntime.java"]: "package " + model.namespace + ";\n" + ownedJvmRuntime(model.c.prefix)
		, [prefix + "/LeanBridgeException.java"]: "package " + model.namespace + ";\n" + ownedJvmException };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	const env = nativeFixtureEnvironment(["java"]);
	await runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "library", ...Object.keys(files)], directory);
	// Remove the producer's source tree before compiling the downstream caller.
	await rm(join(directory, "src"), { recursive: true });
	const source = await readFile("tests/fixtures/structured-types/OwnedValueProbe.java", "utf8");
	await saveLakeFile(directory, "OwnedValueProbe.java", source);
	const compile = path => runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "library", "-d", "consumer", path], directory);
	await compile("OwnedValueProbe.java");
	const observed = await runCopied(env.LEAN_BRIDGE_JAVA, ["-cp", "consumer:library", "consumer.OwnedValueProbe"], directory);
	assert.equal(observed.stderr, ""); assert.equal(Number(observed.stdout.trim()), 26);
	const rejections = [
		["resource constructor", "new Ticket();", /constructor Ticket/u]
		, ["raw handle", "Ticket value = null; System.out.println(value.handle);", /handle is not public/u]
		, ["typed resource field", 'new Bundle("bad", Option.none(), new Ticket[0], new Ticket[0], new Payload(java.math.BigInteger.ZERO, new byte[0]));', /incompatible types/u]
		, ["immutable record", "Payload value = null; value.count = java.math.BigInteger.ONE;", /count has private access/u]
		, ["typed option", 'Option<Ticket> value = Option.some("bad");', /incompatible (?:types|bounds)/u]
		, ["typed callback", "CallbackRecordArgument1ClosureCallback value = (Ticket ticket) -> null;", /incompatible types/u]
		, ["higher-order input", "DispatchResultClosure fn = null; CallbackRecordArgument1Closure value = null; fn.invoke(value);", /incompatible types/u]
		, ["asynchronous callback", "CallbackRecordArgument1ClosureCallback value = item -> java.util.concurrent.CompletableFuture.completedFuture(item);", /incompatible (?:types|bounds)/u]
		, ["transparent alias", "BundleAlias value = null;", /cannot find symbol/u]
		, ["closed variant", "final class External implements Choice { }", /not allowed to extend sealed class/u]
		, ["sealed resource", "final class External extends Ticket { }", /cannot inherit from final Ticket/u]
	];
	for(const [name, body, diagnostic] of rejections)
	{
		const declaration = body.startsWith("final class ");
		await saveLakeFile(directory, "Invalid.java", `package consumer;\nimport ${model.namespace}.*;\npublic final class Invalid { static void test() { ${declaration ? "" : body} } }\n${declaration ? body : ""}\n`);
		await assert.rejects(() => compile("Invalid.java"), error => {
			assert.match(JSON.stringify(error.details ?? error.message), diagnostic, name); return true;
		});
	}
	await saveLakeFile(resolve("build/owned-jvm-values"), "public.json", canonicalJson({
		checks: 26, rejectedConsumers: rejections.length, nativeLibraryLoaded: false
		, installedPackage: false, sourceFreeConsumer: true
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, consumerSourceSha256: sha256(source)
		, rejections: rejections.map(([name, source, diagnostic]) => ({ name, source, diagnostic: diagnostic.source }))
	}));
	t.diagnostic("26 value assertions and 11 rejected external consumers; no native library loaded");
});
