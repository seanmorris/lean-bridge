/**
 * Compile the public owned Java/Kotlin package with the production tool contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { compileJvmSources, validateKotlinCompilation } from "../src/build/compile-jvm-sources.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedJvmInstalledFixture } from "./helpers/owned-jvm-installed.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, jvmDiagnostics } from "./helpers/type-corpus-jvm-tools.mjs";
import { captureCorpusCompiler } from "./helpers/type-corpus-compiler.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned JVM package declares its own compiler, loading and lifetime profile", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), original = structuredClone(ir);
	const generated = generateOwnedJvmPackage(ir);
	assert.deepEqual(ir, original);
	assert.deepEqual(generateOwnedJvmPackage(ir).files, generated.files);
	const manifest = JSON.parse(generated.files["binding-manifest.json"]);
	assert.equal(manifest.generator, "jvm-owned-values-v1");
	assert.equal(manifest.backend, "owned-jvm-v1");
	assert.equal(manifest.ownedValues.loadingPolicy, "linux-x64-deepbind-v1");
	assert.equal(manifest.ownedValues.gmp, "libgmp-lean-bridge.so.10");
	const source = name => generated.files[Object.keys(generated.files).find(path => path.endsWith("/" + name))];
	assert.match(source("Api.java"), /public static void viaUnit/u);
	assert.match(source("_OwnedLoader.java"), /_OwnedNative.lookup\(\);[^]*synchronized/u);
	assert.match(source("_OwnedNative.java"), /Build a prepared Maven release/u);
	assert.throws(() => generateOwnedJvmPackage(ir, { componentId: "other" }), /loading evidence/u);
});

for(const scalars of [false, true]) test(`public owned JVM ${scalars ? "scalar" : "callback"} package uses the actual Kotlin compiler profile`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 300000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-jvm-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = generateOwnedJvmPackage(scalars ? ownedPythonScalarsReviewedIr() : ownedDotnetCallbacksReviewedIr());
	for(const [path, source] of Object.entries(model.files)) await saveLakeFile(root, path, source);
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const compilers = await compileJvmSources({ root, files: model.files, environment });
	assert.ok(compilers.kotlin.options.includes("-Xuse-type-table"));
	validateKotlinCompilation(compilers.kotlin, model.namespace, { ownedValues: true });
	assert.throws(() => validateKotlinCompilation(compilers.kotlin, model.namespace), /compiler contract/u);
	const forged = structuredClone(compilers.kotlin);
	forged.options = forged.options.filter(option => option !== "-Xuse-type-table");
	assert.throws(() => validateKotlinCompilation(forged, model.namespace, { ownedValues: true }), /compiler contract/u);
	await rm(join(root, "src"), { recursive: true });
	const fixture = await ownedJvmInstalledFixture(scalars, model.namespace, model.functions.map(fn => fn.publicName));
	for(const [name, source] of Object.entries(fixture.javaSupport)) await saveLakeFile(root, "consumer-src/" + name, source);
	await saveLakeFile(root, "consumer-src/Wire.java", await readFile("tests/fixtures/type-corpus/consumers/Wire.java"));
	await saveLakeFile(root, "consumer-src/Consumer.java", fixture.source("java"));
	await saveLakeFile(root, "consumer-src/Consumer.kt", fixture.source("kotlin"));
	for(const profile of ["java", "kotlin"]) for(const example of fixture.examples(profile))
		await saveLakeFile(root, "consumer-src/" + example.file, example.source);
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), stdlib = join(home, "lib/kotlin-stdlib.jar");
	const javaArgs = [...javaCompilerOptions
		, "-sourcepath", "empty-classpath", "-classpath", "classes:" + stdlib
		, "-d", "consumer-classes"];
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaArgs
		, "consumer-src/Consumer.java"
		, "consumer-src/Wire.java"
		, ...fixture.examples("java").map(example => "consumer-src/" + example.file)
		, ...Object.keys(fixture.javaSupport).map(name => "consumer-src/" + name)], root);
	const kotlinArgs = [
		"-cp", join(home, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
		, "-kotlin-home", home, ...kotlinCompilerOptions
		, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", "classes:consumer-classes:" + stdlib
		, "-d", "consumer-kotlin"
	];
	const kotlinSources = fixture.examples("kotlin")
		.map(example => "consumer-src/" + example.file);
	await runCopied(environment.LEAN_BRIDGE_JAVA, [...kotlinArgs
		, "consumer-src/Consumer.kt", ...kotlinSources], root);
	for(const profile of ["java", "kotlin"])
	{
		const java = profile === "java";
		await runCopied(environment.LEAN_BRIDGE_JAVA, ["-cp"
			, "classes:consumer-classes:consumer-kotlin:" + stdlib
			, java ? "Consumer" : "ConsumerKt", "--signatures"], root);
		for(const entry of fixture.rejections(profile))
		{
			const file = `consumer-src/reject-${entry.id.split("/")[1]}.${java ? "java" : "kt"}`;
			await saveLakeFile(root, file, entry.source);
			const result = await captureCorpusCompiler(java ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_JAVA
				, [...java ? [...javaArgs, "-XDrawDiagnostics"] : kotlinArgs, file], root, copiedCleanEnvironment);
			jvmDiagnostics(result, entry, profile, root, file);
		}
	}
	t.diagnostic(`${model.functions.length} public Java/Kotlin functions compile with owned type-table metadata`);
});
