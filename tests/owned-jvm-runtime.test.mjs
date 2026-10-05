/**
 * Exercise actual Lean owners through Java FFM and creator-thread cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedJvmException, ownedJvmRuntime } from "../src/backends/jvm/owned-runtime.mjs";
import { ownedJvmThreadExit } from "../src/backends/jvm/owned-thread-exit.mjs";
import { compileOwnedJvmRuntimeProbe } from "./helpers/owned-jvm-runtime-native.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned JVM support rejects native identifier injection", () => {
	for(const value of ["", "Bad", "a__b", "a;\n#error injected"])
	{
		assert.throws(() => ownedJvmRuntime(value), /Invalid owned JVM prefix/u);
		assert.throws(() => ownedJvmThreadExit(value), /Invalid owned JVM prefix/u);
	}
});

for(const reviewed of [false, true]) test(`Java ownership and native TLS reclaim real Lean values (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedJvmRuntimeProbe(t, reviewed);
	const runtime = ownedJvmRuntime(compiled.prefix);
	const processSymbol = '"lean_bridge_native_process_valid"', checkpoint = "static void checkpoint() { }";
	assert.equal(runtime.split(processSymbol).length, 2); assert.equal(runtime.split(checkpoint).length, 2);
	const instrumented = runtime.replace(processSymbol, '"owned_test_process_valid"')
		.replace(checkpoint, "static void checkpoint() { OwnedRuntimeProbe.allocation(); }");
	const probe = await readFile("tests/fixtures/structured-types/OwnedRuntimeProbe.java", "utf8");
	const files = { "_OwnedRuntime.java": "package org.leanbridge.ownedtest;\n" + instrumented
		, "LeanBridgeException.java": "package org.leanbridge.ownedtest;\n" + ownedJvmException
		, "OwnedRuntimeProbe.java": probe };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(compiled.directory, path, source);
	const env = nativeFixtureEnvironment(["java"]);
	await runCopied(env.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...Object.keys(files)], compiled.directory);
	const observations = [];
	for(const mode of ["ordinary", "retirement"])
	{
		const run = await runCopied(env.LEAN_BRIDGE_JAVA, [
			"--enable-native-access=ALL-UNNAMED", "-Xss256k", "-cp", "classes"
			, "org.leanbridge.ownedtest.OwnedRuntimeProbe", compiled.library, mode
		], compiled.directory);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.mode, mode); assert.equal(result.live, 0); assert.equal(result.identities, 0); assert.equal(result.exitErrors, 0);
		assert.ok(result.checks >= (mode === "ordinary" ? 100 : 4));
		assert.equal(result.exits, mode === "ordinary" ? 3 : 1); observations.push(result);
	}
	await saveLakeFile(process.cwd(), `build/owned-jvm-runtime/${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({ schemaVersion: 1
		, scope: { compiledLean: true, nativeTls: true, installedPackage: false }
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, hostCallbacks: true, component: compiled.model.component }
		, runtimeSha256: sha256(runtime), instrumentedSha256: sha256(instrumented)
		, nativeSha256: sha256(compiled.implementation)
		, guardSha256: sha256(compiled.guard)
		, probeSha256: sha256(probe), observations }));
});
