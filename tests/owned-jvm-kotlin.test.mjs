/**
 * Compile independently typed Kotlin values without exposing native handles.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedKotlinValues } from "../src/backends/jvm/owned-kotlin.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned Kotlin declarations retain nominal types and private identity construction", () => {
	const ir = ownedCppCompositionReviewedIr(), original = structuredClone(ir);
	const generated = generateOwnedKotlinValues(ir);
	assert.deepEqual(ir, original); assert.deepEqual(generateOwnedKotlinValues(ir).files, generated.files);
	const source = name => generated.files[Object.keys(generated.files).find(path => path.endsWith("/" + name))];
	assert.match(source("Ticket.kt"), /typealias .Ticket. = .*_OwnedKotlinTicket/u);
	assert.match(source("_KotlinOwnedTypes.java"), /_OwnedTypes.Catalog CATALOG/u);
	assert.doesNotMatch(source("_KotlinOwnedTypes.java"), /kotlin\.Ticket[.> )]/u);
	assert.match(source("_OwnedKotlinValue.java"), /\n {4}final _OwnedRuntime.Handle handle;/u);
	assert.match(source("_OwnedKotlinValue.java"), /\n {4}_OwnedKotlinValue\(/u);
	for(const node of generated.model.types.filter(node => node.identity))
	{
		const implementation = source(`_OwnedKotlin${node.publicType}.kt`);
		assert.match(implementation, /private constructor/u);
		assert.match(implementation, /@kotlin.jvm.JvmSynthetic internal fun create/u);
	}
	assert.match(source("DispatchResultClosureCallback.kt"), /arg0: .*CallbackRecordArgument1Closure/u);
	const scalars = generateOwnedKotlinValues(ownedPythonScalarsReviewedIr());
	assert.equal(scalars.model.types.filter(node => node.kind === "primitive").length, 19);
	const ticket = model => model.types.find(node => node.publicType === "Ticket");
	assert.notEqual(ticket(generated.model).index, ticket(scalars.model).index);
	assert.equal(source("Ticket.kt"), scalars.files[Object.keys(scalars.files).find(path => path.endsWith("/Ticket.kt"))],
		"Public identity class names must not depend on catalog order");
});

for(const scalar of [false, true]) test(`owned Kotlin ${scalar ? "scalar" : "composed"} values compile in a source-free consumer`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-kotlin-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = generateOwnedKotlinValues(scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr());
	const files = { ...generated.model.files, ...generated.files };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC));
	const stdlib = join(home, "lib/kotlin-stdlib.jar"), annotations = join(home, "lib/annotations-13.0.jar");
	const launch = ["-cp", join(home, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", home];
	const module = "lean_bridge_" + generated.model.namespace.replaceAll(".", "_");
	const options = [...kotlinCompilerOptions, "-module-name", module, "-Xuse-type-table"];
	const java = Object.keys(files).filter(path => path.endsWith(".java"));
	const kotlin = Object.keys(files).filter(path => path.endsWith(".kt"));
	await runCopied(environment.LEAN_BRIDGE_JAVA, [
		...launch, ...options
		, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", stdlib + ":" + annotations, "-d", "classes", ...kotlin, ...java
	], root);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "classes:" + stdlib, "-d", "classes", ...java], root);
	await rm(join(root, "src"), { recursive: true });
	const probe = await readFile(`tests/fixtures/structured-types/owned-kotlin-${scalar ? "scalars" : "values"}.kt`, "utf8");
	await saveLakeFile(root, "Consumer.kt", probe);
	const consumerArguments = [
		...launch, ...kotlinCompilerOptions
		, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", "classes:" + stdlib
	];
	await runCopied(environment.LEAN_BRIDGE_JAVA, [...consumerArguments, "-d", "consumer", "Consumer.kt"], root);
	const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["-cp", "classes:consumer:" + stdlib, "consumer.ConsumerKt"], root);
	assert.equal(result.stderr, ""); const checks = Number(result.stdout.trim()); assert.ok(checks >= 10);
	const rejected = scalar ? [
		["NullBytes", "val value = Scalars(Unit.INSTANCE, false, 0, java.math.BigInteger.ZERO, java.math.BigInteger.ZERO, 0, 0, 0, java.math.BigInteger.ZERO, 0, 0, 0, 0, java.math.BigInteger.ZERO, 0, 0f, 0.0, \"\", null)", "NULL_FOR_NONNULL_TYPE"]
		, ["WrongWord", "val value: java.math.BigInteger = 1", "INITIALIZER_TYPE_MISMATCH"]
	] : [
		["WrongField", "Payload(\"bad\", byteArrayOf())", "ARGUMENT_TYPE_MISMATCH"]
		, ["NullField", "Payload(null, byteArrayOf())", "NULL_FOR_NONNULL_TYPE"]
		, ["NullOption", "Option.some<Ticket>(null)", "NULL_FOR_NONNULL_TYPE"]
		, ["WrongOption", "val value: Option<Ticket> = Option.some(Payload(java.math.BigInteger.ZERO, byteArrayOf()))", "TYPE_MISMATCH"]
		, ["Immutable", "Payload(java.math.BigInteger.ZERO, byteArrayOf()).count = java.math.BigInteger.ONE", "VAL_REASSIGNMENT"]
		, ["JavaFamily", "val value: Tree = org.leanbridge.owned_aggregates.TreeBranch(emptyArray())", "INITIALIZER_TYPE_MISMATCH"]
		, ["CallbackArgument", "val value = CallbackRecordArgument1ClosureCallback { item: Ticket -> error(\"unused\") }", "ARGUMENT_TYPE_MISMATCH"]
		, ["AsyncCallback", "val value = CallbackRecordArgument1ClosureCallback { item -> java.util.concurrent.CompletableFuture.completedFuture(item) }", "TYPE_MISMATCH"]
		, ["ClosureDirection", "fun call(outer: DispatchResultClosure, inner: CallbackRecordArgument1Closure) { outer.invoke(inner) }", "ARGUMENT_TYPE_MISMATCH"]
	];
	rejected.push(
		["Handle", "ticket.handle", "INVISIBLE_REFERENCE"]
		, ["Constructor", "Ticket()", "INVISIBLE_REFERENCE"]
		, ["PrivateOps", "org.leanbridge.owned_aggregates._KotlinOwnedValueOps.hash(ticket)", "INVISIBLE_REFERENCE"]
	);
	const negativeSources = {};
	for(const [name, body] of rejected)
	{
		const source = `package consumer\nimport org.leanbridge.owned_aggregates.kotlin.*\nimport org.leanbridge.owned_aggregates.kotlin.Unit\nfun invalid${name}(ticket: Ticket) { ${body} }\n`;
		negativeSources[name] = source; await saveLakeFile(root, "negative/" + name + ".kt", source);
	}
	let failure;
	try
	{
		await runCopied(environment.LEAN_BRIDGE_JAVA, [...consumerArguments, "-d", "invalid", ...rejected.map(([name]) => "negative/" + name + ".kt")], root);
	} catch(error)
	{ failure = error; }
	assert.ok(failure, "Invalid Kotlin consumers must fail compilation");
	const diagnostics = failure.details.stderr.split(/\\n|\n/u).filter(line => line.includes("error:"));
	for(const [name, , expected] of rejected)
		assert.ok(diagnostics.some(line => line.includes("negative/" + name + ".kt:") && line.includes("[" + expected + "]")), name + ": " + failure.details.stderr);
	await saveLakeFile(resolve("build/owned-jvm-kotlin"), `${scalar ? "scalars" : "composed"}.json`, canonicalJson({
		checks, sourceFreeConsumer: true
		, compiledLean: false, nativeLibraryLoaded: false
		, installedPackage: false, namespace: generated.namespace, module, options
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, probeSha256: sha256(probe)
		, rejected: rejected.map(([name, , diagnostic]) => ({ name, diagnostic, sourceSha256: sha256(negativeSources[name]) }))
	}));
	t.diagnostic(`${checks} Kotlin metadata/value checks, ${rejected.length} rejected consumers; no native library loaded`);
});
