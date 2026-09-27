/**
 * Execute typed JVM conversions against ordinary and reviewed Lean builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmConversions } from "../src/backends/jvm/owned-conversions.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedJvmConversionProbeSource } from "./helpers/owned-jvm-conversion-calls.mjs";
import { ownedJvmConversionNative } from "./helpers/owned-jvm-conversion-native.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("owned JVM converters preserve finite nominal types and all scalar carriers", () => {
	const ir = ownedCppCompositionReviewedIr(), original = structuredClone(ir);
	const model = generateOwnedJvmConversions(ir);
	assert.deepEqual(ir, original); assert.deepEqual(generateOwnedJvmConversions(ir).files, model.files);
	assert.equal(model.types.length, 41);
	assert.match(model.typesSource, /Function<Object, _OwnedRuntime.Handle> identity/u);
	assert.match(model.typesSource, /Ticket\)value\).handle/u);
	assert.match(model.typesSource, /new .*ChainLink/u);
	assert.equal(generateOwnedJvmConversions(ownedPythonScalarsReviewedIr()).types.filter(node => node.kind === "primitive").length, 19);
	for(const path of model.publicFiles) assert.doesNotMatch(model.files[path], /MemorySegment|SymbolLookup|Linker/u);
});

for(const scalar of [false, true]) for(const reviewed of [false, true]) test(`real Lean JVM owned ${scalar ? "scalars" : "compositions"} (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true
		, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const model = generateOwnedJvmConversions(compiled.model.bindingIr);
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true };
	const { c, cleanup, implementation } = ownedJvmConversionNative(input);
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await saveLakeFile(compiled.directory, "guard.cpp", cleanup.guardSource);
	const env = { PATH: "/usr/bin:/bin" }, includes = ["-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "api.c", "-o", "api.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", [
		"-shared", "-pthread", "api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libprobe.so"
	], compiled.directory, env);
	const files = { ...model.files }, runtimePath = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	const checkpoint = "static void checkpoint() { }";
	assert.equal(files[runtimePath].split(checkpoint).length, 2);
	files[runtimePath] = files[runtimePath].replace(checkpoint, "static void checkpoint() { OwnedConversionProbe.allocation(); }");
	const template = await readFile("tests/fixtures/structured-types/owned-jvm-conversions.java", "utf8");
	const exercise = await readFile(`tests/fixtures/structured-types/owned-jvm-${scalar ? "scalars" : "compositions"}.java`, "utf8");
	const source = ownedJvmConversionProbeSource(model, template, exercise);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(compiled.directory, path, source);
	await saveLakeFile(compiled.directory, "OwnedConversionProbe.java", source);
	const java = nativeFixtureEnvironment(["java"]);
	await runCopied(java.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...Object.keys(files), "OwnedConversionProbe.java"], compiled.directory);
	const observed = await runCopied(java.LEAN_BRIDGE_JAVA, [
		"--enable-native-access=ALL-UNNAMED", "-cp", "classes"
		, model.namespace + ".OwnedConversionProbe"
		, join(compiled.directory, "libprobe.so")
	], compiled.directory);
	assert.equal(observed.stderr, ""); const report = JSON.parse(observed.stdout.trim());
	assert.equal(report.live, 0); assert.equal(report.identities, 0);
	assert.ok(report.checks > 30); assert.ok(report.managedFailures > 0); assert.ok(report.nativeFailures > 0);
	await saveLakeFile(resolve("build/owned-jvm-conversions"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		...report, installedPackage: false, hostUpcalls: false, input
		, files: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, instrumentedRuntimeSha256: sha256(files[runtimePath])
		, probeSha256: sha256(source), cSourceSha256: sha256(implementation)
		, guardSha256: sha256(cleanup.guardSource)
	}));
	t.diagnostic(JSON.stringify(report));
});
