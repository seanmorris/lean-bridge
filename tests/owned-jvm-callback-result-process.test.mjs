/**
 * Actual JVM callback-result owners survive creator-thread and runtime boundaries safely.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource, ownedDotnetCallbackResultConfiguration
	, ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { ownedJvmCallbackResultProcessSources } from "./helpers/owned-jvm-callback-result-process.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const reviewed of [false, true]) for(const combined of [false, true])
test(`JVM callback-result creator threads${combined ? " and runtime retirement" : ""} (${reviewed ? "reviewed" : "ordinary"}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PROCESS_TEST !== "1"
	, timeout: 900000
}, async t => {
	const mode = reviewed ? "reviewed" : "ordinary";
	const profile = combined ? "combined" : "no-host";
	const options = { callbackResultAnchors: true, hostCallbacks: combined
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const compiled = await compileOwnedAggregateFixture(t, {
		hostCallbacks: combined
		, sourceSuffix: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, ...reviewed ? { reviewedIr: (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() }
			: { configuration: await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)() }
		, evidenceName: `jvm-callback-result-process-${mode}-${profile}-inputs.json`
	});
	assert.equal(Boolean(compiled.sourceIdentity.reviewedBindingIr), reviewed);
	assert.equal(Boolean(compiled.callbackSource), combined);
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options);
	const files = ownedJvmCallbackResultProcessSources(model, combined);
	const toolchain = await compileOwnedJvmCallSources(compiled.directory, files), observations = [], executions = [];
	for(const scenario of ["threads", ...combined ? ["java-raw", "java-whole", "kotlin-raw", "kotlin-whole"] : []])
	{
		const run = await runCopied(toolchain.java, ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".CallbackResultProcessProbe"
			, join(compiled.directory, "libprobe.so"), scenario], compiled.directory);
		assert.equal(run.stderr, "");
		const observed = JSON.parse(run.stdout.trim());
		assert.equal(observed.mode, scenario);
		assert.equal(observed.checks, scenario === "threads" ? 27 : 6);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		assert.equal(observed.threadExits, scenario === "threads" ? 2 : 0);
		assert.equal(observed.threadExitErrors, 0);
		observations.push(observed);
		executions.push(run);
	}
	await saveLakeFile("build/owned-jvm-callback-results", `${mode}${combined ? "" : "-no-host"}-process.json`, canonicalJson({
		schemaVersion: 1
		, mode, profile, combined, capabilities: options, input: native.input
		, scope: { java: true, kotlin: true
			, creatorThreadAffinity: true, nativeThreadExit: true
			, stronglyReachableOwners: true, runtimeRetirementDuringCallback: combined
			, rawAndWholeCallbackReplies: combined, normalSessionCleanup: true
			, installedMaven: false, fork: false }
		, generatedFiles: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, probeFiles: Object.fromEntries(Object.entries(files).filter(([path, source]) => model.files[path] !== source)
			.map(([path, source]) => [path, sha256(source)]))
		, nativeSourceSha256: sha256(native.implementation)
		, guardSha256: sha256(native.cleanup.guardSource)
		, observations, executions
		, sourceHashes: Object.fromEntries(await Promise.all([
			"tests/owned-jvm-callback-result-process.test.mjs"
			, "tests/helpers/owned-jvm-callback-result-process.mjs"
		].map(async path => [path, sha256(await readFile(path))])))
	}));
	t.diagnostic(JSON.stringify(observations));
});
