/**
 * Force Thread.join() to precede native cleanup in the actual signature corpus.
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
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { compileOwnedJvmThreadExitNative, ownedJvmThreadExitGuard, ownedJvmThreadExitSources, withoutOwnedJvmThreadExitWait } from "./helpers/owned-jvm-thread-exit.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("JVM cleanup gate rejects missing and ambiguous instrumentation sites", () => {
	for(const source of ["", "~OwnedJvmThreadExit() noexcept { ~OwnedJvmThreadExit() noexcept {"])
		assert.throws(() => ownedJvmThreadExitGuard(source), /Missing or ambiguous/u);
	assert.throws(() => withoutOwnedJvmThreadExitWait(""), /Missing or ambiguous/u);
});

for(const reviewed of [false, true]) test(`owned JVM native cleanup precedes allocation baselines (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: "owned-dotnet-callables", hostCallbacks: true
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {}
	});
	const native = await compileOwnedJvmThreadExitNative(compiled), model = generateOwnedJvmCalls(compiled.model.bindingIr);
	const [template, exercise, kotlin] = await Promise.all([
		"owned-jvm-calls.java", "owned-jvm-callback-signatures.java"
		, "owned-kotlin-callback-signatures.kt"
	].map(path => readFile(join("tests/fixtures/structured-types", path), "utf8")));
	const { files, runtime } = ownedJvmThreadExitSources(model, template, exercise, kotlin);
	const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
	const args = ["--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib, model.namespace + ".OwnedCallProbe", join(compiled.directory, "libprobe.so")];
	const result = await runCopied(toolchain.java, args, compiled.directory);
	assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout.trim());
	assert.deepEqual(report, {
		javaChecks: 651, kotlinChecks: 192, managedFailures: 255, nativeFailures: 121
		, live: 0, identities: 0, threadExits: 1, threadExitErrors: 0
		, heldExits: 1, releasedExits: 1
	});
	const mutant = withoutOwnedJvmThreadExitWait(files["OwnedCallProbe.java"]);
	await saveLakeFile(compiled.directory, "OwnedCallProbe.java", mutant);
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "classes:" + toolchain.stdlib, "-d", "classes", "OwnedCallProbe.java"], compiled.directory);
	let rejected;
	await assert.rejects(() => runCopied(toolchain.java, args, compiled.directory), error => {
		rejected = error.details;
		assert.match(error.details?.stderr ?? "", /java\.lang\.AssertionError: allocation rollback false\/0: 4 != 5/u);
		return true;
	});
	await saveLakeFile(resolve("build/owned-jvm-thread-exit"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		...report, installedPackage: false, input: native.input
		, files: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, instrumentedRuntimeSha256: sha256(files[runtime])
		, javaProbeSha256: sha256(files["OwnedCallProbe.java"])
		, mutantJavaProbeSha256: sha256(mutant)
		, kotlinProbeSha256: sha256(files["KotlinCallProbe.kt"])
		, cSourceSha256: sha256(native.implementation)
		, guardSha256: sha256(native.cleanup.guardSource)
		, mutation: { kind: "remove-native-cleanup-wait", ...rejected }
	}));
	t.diagnostic(JSON.stringify(report));
});
