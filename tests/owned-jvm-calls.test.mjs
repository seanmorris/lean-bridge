/**
 * Actual Lean downcalls, Java/Kotlin callbacks and owned reply cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmCalls } from "../src/backends/jvm/owned-calls.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources, ownedJvmCallProbeMethods } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned JVM bindings use typed downcalls and native callback reply owners", () => {
	const ir = ownedCppCompositionReviewedIr(), original = structuredClone(ir), model = generateOwnedJvmCalls(ir);
	assert.deepEqual(ir, original); assert.deepEqual(generateOwnedJvmCalls(ir).files, model.files);
	const source = Object.values(model.files).join("\n");
	assert.match(source, /C owns this slot even if a later checkpoint throws/u);
	assert.match(source, /owner::adopt, inputs.budget/u);
	assert.match(source, /Callback recovery nesting exceeds its limit/u);
	assert.doesNotMatch(source, /invokeWithArguments|Host upcalls are outside/u);
});

for(const kind of ["values", "scalars", "signatures"]) for(const reviewed of [false, true]) test(`owned JVM calls and callbacks ${kind} (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const scalar = kind === "scalars", signatures = kind === "signatures";
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : signatures ? "owned-dotnet-callables" : "owned-cpp-composition"
		, hostCallbacks: true
		, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : signatures ? ownedDotnetCallbacksReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const native = await compileOwnedJvmCallNative(compiled), model = generateOwnedJvmCalls(compiled.model.bindingIr);
	const files = { ...model.files }, runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	assert.equal(files[runtime].split("static void checkpoint() { }").length, 2);
	files[runtime] = files[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedCallProbe.allocation(); }");
	const template = await readFile("tests/fixtures/structured-types/owned-jvm-calls.java", "utf8");
	const exercise = await readFile(`tests/fixtures/structured-types/owned-jvm-callback-${kind}.java`, "utf8");
	const kotlin = await readFile(`tests/fixtures/structured-types/owned-kotlin-callback-${kind}.kt`, "utf8");
	files["OwnedCallProbe.java"] = template.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model)).replace("/* EXERCISE */", () => exercise);
	files["KotlinCallProbe.kt"] = kotlin.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model, true));
	const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
	const result = await runCopied(toolchain.java, [
		"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
		, model.namespace + ".OwnedCallProbe", join(compiled.directory, "libprobe.so")
	], compiled.directory);
	assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout.trim());
	assert.equal(report.live, 0); assert.equal(report.identities, 0);
	assert.ok(report.javaChecks > 10); assert.ok(report.kotlinChecks > 5);
	assert.ok(report.managedFailures > 0); assert.ok(report.nativeFailures > 0);
	assert.equal(report.threadExits, kind === "values" ? 5 : signatures ? 1 : 0);
	assert.equal(report.threadExitErrors, 0);
	const retirement = [];
	if(kind === "values") for(const language of ["java", "kotlin"])
	{
		const run = await runCopied(toolchain.java, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedCallProbe"
			, join(compiled.directory, "libprobe.so"), language
		], compiled.directory);
		assert.equal(run.stderr, "");
		const retired = JSON.parse(run.stdout.trim());
		assert.deepEqual(retired, { checks: 3, live: 0, identities: 0 });
		retirement.push({ language, ...retired });
	}
	await saveLakeFile(resolve("build/owned-jvm-calls"), `${kind}-${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		...report, retirement, installedPackage: false, input: native.input
		, files: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, instrumentedRuntimeSha256: sha256(files[runtime])
		, javaProbeSha256: sha256(files["OwnedCallProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinCallProbe.kt"])
		, cSourceSha256: sha256(native.implementation)
		, guardSha256: sha256(native.cleanup.guardSource)
	}));
	t.diagnostic(JSON.stringify(report));
});
